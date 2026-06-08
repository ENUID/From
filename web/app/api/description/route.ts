import { NextRequest, NextResponse } from 'next/server'
import { groqChat } from '@/lib/groq'

// In-process cache — avoids re-calling the LLM for the same product in one deployment
const cache = new Map<string, string>()

const SYSTEM = `You are a product information editor for a curated independent fashion marketplace.

Your job: take a raw Shopify product description and return ONLY the genuinely useful product information, rewritten as clean, factual prose.

ALWAYS REMOVE:
- Calls to action ("Add to cart", "Buy now", "Get yours today", "Shop now", "Order today")
- Shipping and returns policy ("Free shipping", "30-day returns", "Ships in 3-5 days")
- Discount or promo codes
- Social media requests ("Follow us on Instagram", "Tag us @brand")
- SEO keyword stuffing (lists of unrelated search terms)
- Urgency/scarcity marketing ("Limited stock!", "Selling fast!", "Hurry")
- References to other products or collections
- Store or website links
- Placeholder text or broken template variables ({{ ... }})
- HTML artefacts or formatting symbols
- Empty filler ("This product is perfect for...", "You will love this...")

KEEP (only what is specific to this item):
- Fabric and material composition (e.g. "100% organic cotton", "shell: 80% wool")
- Construction and craft details (e.g. "French seams", "hand-stitched")
- Fit and silhouette notes (e.g. "relaxed fit", "true to size", "model wears XS")
- Product-specific features (e.g. "two front pockets", "adjustable drawstring", "detachable collar")
- Dimensions or measurements if given
- Country of origin if stated
- Brief care note only if not already covered by care tags

FORMAT: Write 1–3 short paragraphs of clean prose. No bullet points. No headers. No marketing tone. If the raw description contains almost nothing useful, write a single factual sentence inferred from the product title and type.`

export async function POST(req: NextRequest) {
  try {
    const { id, title, vendor, type, rawText } = await req.json()

    if (!rawText || rawText.trim().length < 15) {
      return NextResponse.json({ text: '' })
    }

    const cacheKey = id || rawText.slice(0, 120)
    const cached = cache.get(cacheKey)
    if (cached !== undefined) return NextResponse.json({ text: cached })

    const context = [title, vendor && `by ${vendor}`, type].filter(Boolean).join(' — ')
    const userMsg = `Product: ${context}\n\nRaw description:\n${rawText.slice(0, 1800)}`

    const msg = await groqChat(
      [{ role: 'user', content: userMsg }],
      SYSTEM,
      undefined,
      { max_tokens: 220, temperature: 0.15 }
    )

    const text = (msg?.content ?? '').trim()
    cache.set(cacheKey, text)
    return NextResponse.json({ text })
  } catch {
    return NextResponse.json({ text: '' })
  }
}
