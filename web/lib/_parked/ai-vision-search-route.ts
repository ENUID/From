// ── PARKED, NOT LIVE ──────────────────────────────────────────────────────
// This was `/api/ai/vision-search` — turned a shopper's photo into a text
// search query for the old grid-search route. Fabrics now handles photos
// natively in one model call (see `sendStylist` in FromPage.tsx), so this
// two-call round-trip is no longer used anywhere. Moved OUT of `app/api/` so
// Next.js no longer builds/serves it. Kept verbatim, not deleted, for
// possible reuse. To resurrect: move back under `app/api/<name>/route.ts`.
// ─────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { wardrobeVisionChat } from '@/lib/groq'

export const maxDuration = 30

const MAX_IMAGES = 3
const MAX_DATA_URL_CHARS = 6_000_000 // ~4.5MB binary per image

// IP-based rate limit: 10 vision requests per minute per IP
const visionBuckets = new Map<string, { count: number; resetAt: number }>()
function visionRateLimited(req: NextRequest): boolean {
  const ip = req.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? 'unknown'
  const now = Date.now()
  const b = visionBuckets.get(ip)
  if (!b || now > b.resetAt) { visionBuckets.set(ip, { count: 1, resetAt: now + 60_000 }); return false }
  if (b.count >= 10) return true
  b.count++
  return false
}

const SYSTEM = `You are FROM's visual search eye — a fashion buyer who can look at any photo and name exactly what it is in the language a catalog understands. Your output becomes a product search, so precision is everything.

Look at the photo(s) and produce ONE concise catalog query for the single most prominent garment, shoe, bag, or accessory.

Read these signals in order and include the ones you can actually see:
- GENDER cut (men / women) when the styling makes it clear
- COLOUR — the true shade, not a vague family ("washed indigo" → "blue"; "oatmeal" → "cream")
- MATERIAL — what the texture and drape reveal (leather, linen, wool, denim, suede, knit, satin)
- GARMENT — the specific item (chelsea boot, camp-collar shirt, wide-leg trouser, trench coat)
- ONE distinctive detail that defines the piece — and only the strongest one (chunky sole, double-breasted, cropped, pleated, oversized)

Rules:
- Maximum 10 words. No brand names. No sentences, no punctuation except spaces.
- Describe the GARMENT itself, not the background, the person, or the setting.
- If the shopper added a note, let it decide which item to read and which attribute matters most.
- Confidence over hedging — name what you see plainly. Output ONLY the query text, nothing else.

Good output:
women black leather chelsea boots chunky sole
men navy linen camp collar shirt
beige wide leg pleated wool trousers`

export async function POST(req: NextRequest) {
  if (visionRateLimited(req)) return NextResponse.json({ query: null }, { status: 429 })
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

    const question = hint ? `Shopper's note: "${hint}"\n\nIdentify the piece to search for.` : 'Identify the piece to search for.'
    const raw = await wardrobeVisionChat(SYSTEM, question, images, { max_tokens: 60, temperature: 0.1 })

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
