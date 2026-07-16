import { NextRequest, NextResponse } from 'next/server'
import { groqChat, FAST_MODEL } from '@/lib/groq'
import { BoundedCache } from '@/lib/boundedCache'
import { makeIpRateLimiter } from '@/lib/rateLimit'

const cache = new BoundedCache<string, string>(2000)

// Unauthenticated + one LLM call per cache miss — without a limiter this is
// a free-tier-quota drain anyone can script. 30/min is far above what a real
// shopper browsing product sheets generates.
const isRateLimited = makeIpRateLimiter(30, 60_000)

const SYSTEM = `You are a product information writer for a curated independent fashion marketplace.

Your job: given a raw Shopify product description plus the product title, brand, and type, write clean factual product information that a customer would find genuinely useful.

RULES:
- Never use em dashes (—) or en dashes (–). Use a comma or plain sentence break instead.
- No bullet points, no headers, no lists.
- No marketing language whatsoever.
- No calls to action ("Add to cart", "Buy now", "Shop now", "Order today", "Get yours").
- No shipping, returns, or discount information.
- No social media references or links.
- No urgency language ("Limited stock", "Selling fast", "Hurry").
- No placeholder text or broken variables.
- Do not copy filler phrases ("This product is perfect for", "You will love").

ALWAYS WRITE SOMETHING USEFUL:
- If the raw description is full of junk with little substance, ignore it and write 1 to 2 factual sentences about the product based on its title, brand name, and product type. Draw on what a knowledgeable fashion buyer would say about an item of this kind.
- If the raw description has genuine content, keep only: fabric and material composition, construction details, fit notes, silhouette, specific product features, model sizing info, country of origin.

FORMAT: 1 to 3 short plain sentences. No special characters. No markdown. Minimal and direct.`

export async function POST(req: NextRequest) {
  if (isRateLimited(req)) return NextResponse.json({ text: '' }, { status: 429 })
  try {
    const { id, title, vendor, type, rawText } = await req.json()

    const cacheKey = id || (rawText ?? '').slice(0, 120)
    const cached = cache.get(cacheKey)
    if (cached !== undefined) return NextResponse.json({ text: cached })

    const context = [title, vendor && `by ${vendor}`, type].filter(Boolean).join(', ')
    const raw = (rawText ?? '').trim()
    const userMsg = `Product: ${context}\n\nRaw description:\n${raw.slice(0, 1800)}`

    const msg = await groqChat(
      [{ role: 'user', content: userMsg }],
      SYSTEM,
      undefined,
      { max_tokens: 180, temperature: 0.2, model: FAST_MODEL }
    )

    const text = (msg?.content ?? '').trim()
    cache.set(cacheKey, text)
    return NextResponse.json({ text })
  } catch {
    return NextResponse.json({ text: '' })
  }
}
