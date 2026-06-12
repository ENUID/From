import { NextRequest, NextResponse } from 'next/server'
import { groqVisionChat, VisionMessage } from '@/lib/groq'

export const maxDuration = 30

const MAX_IMAGES = 3
const MAX_DATA_URL_CHARS = 6_000_000 // ~4.5MB binary per image

const SYSTEM = `You are a fashion visual search engine. Look at the photo(s) and produce ONE concise catalog search query for the main garment, shoe, bag, or accessory shown.

Include, in natural order when visible: gender (men/women), colour, material, garment type, and at most one distinctive style detail (e.g. "camp collar", "chunky sole", "double-breasted", "wide leg").

Rules:
- Maximum 10 words. No brand names. No sentences. No punctuation except spaces.
- If multiple items are shown, pick the most prominent one.
- If the shopper added a note, let it steer which item or attribute matters.
- Output ONLY the query text. Nothing else.

Examples of good output:
women black leather chelsea boots chunky sole
men navy linen camp collar shirt
beige wide leg wool trousers`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const images: string[] = Array.isArray(body?.images)
      ? (body.images as unknown[])
          .filter((x): x is string => typeof x === 'string' && x.startsWith('data:image/') && x.length <= MAX_DATA_URL_CHARS)
          .slice(0, MAX_IMAGES)
      : []
    const hint: string = typeof body?.hint === 'string' ? body.hint.trim().slice(0, 200) : ''

    if (images.length === 0) {
      return NextResponse.json({ query: null })
    }

    const parts: any[] = [
      { type: 'text', text: hint ? `Shopper's note: "${hint}"` : 'Identify the piece to search for.' },
      ...images.map(url => ({ type: 'image_url', image_url: { url, detail: 'low' as const } })),
    ]
    const messages: VisionMessage[] = [{ role: 'user', content: parts }]

    const msg = await groqVisionChat(messages, SYSTEM, { max_tokens: 60, temperature: 0.1 })
    const raw = typeof msg?.content === 'string' ? msg.content : ''

    // Sanitize: first line only, strip quotes/punctuation noise, cap length.
    const query = raw
      .split('\n')[0]
      .replace(/["'`*#\[\]():;.,!?]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 90)

    // Reject degenerate outputs — frontend falls back gracefully.
    if (!query || query.length < 4 || /\b(sorry|cannot|unable|image)\b/i.test(query)) {
      return NextResponse.json({ query: null })
    }

    return NextResponse.json({ query })
  } catch (e) {
    console.error('[vision-search] error:', e)
    // Never fail the search flow — the frontend falls back to text/filenames.
    return NextResponse.json({ query: null })
  }
}
