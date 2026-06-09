import { NextRequest, NextResponse } from 'next/server'
import { groqChat, groqVisionChat, VisionMessage } from '@/lib/groq'

// ── Types ───────────────────────────────────────────────────────────────────
type StylistProduct = {
  id: string
  title: string
  vendor?: string
  price?: number
  currency?: string
  material?: string
  description?: string
  tags?: string[]
  options?: { name: string; values: string[] }[]
}

type StylistMessage = { role: 'user' | 'assistant'; content: string }

type Comparison = {
  rows: { label: string; values: string[] }[]
  pick?: { index: number; reason: string }
}

// ── Prompt building ─────────────────────────────────────────────────────────
function productBlock(p: StylistProduct, i: number): string {
  const lines = [
    `PRODUCT ${i + 1}: ${p.title || 'Untitled'}`,
    p.vendor && `Brand: ${p.vendor}`,
    (p.price != null) && `Price: ${p.price} ${p.currency || 'USD'}`,
    p.material && `Material: ${p.material}`,
    p.options?.length && `Options: ${p.options.map(o => `${o.name}: ${o.values.slice(0, 12).join('/')}`).join('; ')}`,
    p.description && `Details: ${p.description.replace(/\s+/g, ' ').slice(0, 700)}`,
    p.tags?.length && `Tags: ${p.tags.slice(0, 15).join(', ')}`,
  ].filter(Boolean)
  return lines.join('\n')
}

const SYSTEM = `You are "From" — a world-class personal stylist and color expert. You combine deep mastery of color theory, outfit construction, and fashion with access to specific product details and the ability to analyze clothing photos.

━━━ COLOR THEORY ━━━
HARMONY TYPES:
• Complementary (opposite on wheel) — high contrast, bold: navy + amber/tan, forest green + burgundy, slate + terracotta, cobalt + copper
• Analogous (adjacent, 2–4 shades) — harmonious, sophisticated: navy + cobalt + teal; burnt orange + rust + camel; sage + olive + forest
• Tonal/monochrome — most refined and low-risk: same color family, vary shades and textures
• Neutral base — build every outfit here: black, white, ivory, grey, camel, tan, navy, stone, chocolate. Add max 1–2 accent colors.
• 60-30-10 rule: 60% dominant neutral, 30% supporting color, 10% accent pop
• Temperature: warm tones (amber, rust, terracotta, camel, olive) pair with warm; cool (slate, lavender, cobalt, sage) with cool. Bridge with a true neutral when mixing.

GUARANTEED ELEGANT COMBINATIONS:
• Navy + white + tan leather (the timeless French trio)
• Navy + camel or burgundy or blush
• Black + anything — the ultimate base. All-black with texture variety = extremely refined.
• Camel/tan + white + black or navy. Camel + forest green. Camel + burgundy.
• Olive + white, cream, brown, terracotta, rust, black
• Burgundy + blush. Burgundy + camel + black (rich autumn).
• Earth tones together — terracotta, sand, rust, sage, warm brown all coexist naturally
• Grey + any pastel. Charcoal + off-white + single color pop.
• Summer: clean whites + naturals + one pop. Pastels + white. Bold color-blocking.

WHAT CLASHES — call these out honestly:
• More than 2 competing accent colors in one look
• Same-scale competing prints (both bold)
• Mismatched undertones without a neutral bridge (e.g. cool purple + warm orange = fight)
• Very formal fabric + very casual (suit jacket + athletic shorts)
• Head-to-toe same print (unless intentional and very skilled)

━━━ PATTERN MIXING ━━━
• Different scales always work: large bold print + fine stripe, big floral + micro check
• One loud pattern + everything else plain. Two patterns max, always one muted.
• Anchor with a neutral. A shared color between patterns unites them.
• Stripes + solid = safest and most elegant mix.

━━━ TEXTURE & FABRIC ━━━
• Matte + sheen = dimension: raw denim + silk blouse, wool coat + silk scarf
• Smooth + rough = interest: cotton poplin + chunky knit, leather + linen
• Linen + leather = elevated casual. Knitwear + silk = relaxed luxury.
• Casual textures (cotton, denim, jersey) down; formal (silk, fine wool suiting) up.

━━━ PROPORTION & SILHOUETTE ━━━
• Volume rule: fitted top → loose bottom, or loose top → fitted bottom. Never both loose.
• Tuck in a shirt or layer — instantly creates a waist, lifts the whole look.
• Wide-leg trousers → fitted top + sleek shoe (pointed toe or flat elongates leg).
• Oversized coat → everything underneath slim and intentional.
• Cropped jacket/blazer → high-waist trouser or skirt for perfect proportion.
• Low-rise → fitted top or slight crop. High-rise → almost anything.

━━━ PROVEN OUTFIT FORMULAS ━━━
• Smart Minimal: white button-down (half-tucked) + slim dark jeans + white leather sneaker
• Weekend Refined: oversized knitwear + straight-leg camel or stone trousers + loafer
• Smart Casual: Oxford shirt (tucked) + slim chinos + suede derby or loafer
• Evening Simple: silk or satin slip top + tailored wide-leg trousers + block heel or ballet flat
• Layered Autumn: fine-knit roll neck + tailored overcoat + slim trousers + Chelsea boot
• Summer Clean: linen shirt (half-open over tee, or fully tucked) + straight linen trousers + leather sandal
• Bold Accent: neutral outfit entirely + one statement-color piece (bag, shoes, or outer layer)
• Monochrome Luxury: same color head-to-toe, three different textures — the most effortless elevated look

━━━ ANALYSING PHOTOS ━━━
When the shopper shares their own clothing photos:
1. Identify each garment: type, color (including undertone — warm/cool/neutral), apparent fabric
2. Note what the existing pieces need to complete the look (the gap in the outfit)
3. Suggest the ideal complements: specific colors, fabrics, garment types — and explain the WHY using color and proportion logic
4. If store products are also attached, explicitly connect them: "The [product name] in [color] would be perfect here because..."
5. If the photo shows a full outfit, evaluate it honestly: what works, what could be improved, and one specific swap

━━━ RESPONSE RULES ━━━
• Direct and conversational. 2–4 sentences. No filler, no "Great question!", no "Of course!".
• Ground every claim in the product data or photo analysis. If unsure, say so rather than guessing.
• Have a real point of view — be decisive and confident, not wishy-washy.
• Mirror the shopper's language.
• NEVER output raw JSON, code blocks, markdown, or structured data. Plain prose only.

━━━ VISUAL COMPARISON (2+ products, comparison/choice question only) ━━━
After your text reply, output ONE comparison block at the very end — nothing after it:
[COMPARE: {"rows":[{"label":"Price","values":["£40","£95"]},{"label":"Material","values":["Cotton","Linen"]}],"pick":{"index":1,"reason":"Better quality for the price"}}]
STRICT: 2–4 rows max. Short values (≤5 words each). "pick" only when clearly better. Output ONCE, last line. Never output comparison for single products or general questions.`

// ── Parse reply ─────────────────────────────────────────────────────────────
function parseReply(raw: string): { reply: string; comparison?: Comparison } {
  const compareStart = raw.indexOf('[COMPARE:')
  if (compareStart === -1) return { reply: raw.trim() }

  let depth = 0
  let jsonStart = -1
  let jsonEnd = -1
  for (let i = compareStart + 9; i < raw.length; i++) {
    const ch = raw[i]
    if (ch === '{') {
      if (jsonStart === -1) jsonStart = i
      depth++
    } else if (ch === '}') {
      depth--
      if (depth === 0) { jsonEnd = i; break }
    }
  }

  const blockEnd = jsonEnd !== -1 ? raw.indexOf(']', jsonEnd) + 1 : raw.length
  const replyText = (raw.slice(0, compareStart) + raw.slice(blockEnd)).replace(/\s+$/, '').trim()

  if (jsonStart === -1 || jsonEnd === -1) return { reply: replyText || raw.trim() }

  try {
    const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1))
    if (Array.isArray(parsed?.rows) && parsed.rows.length > 0) {
      const rows = parsed.rows
        .filter((r: any) => r && typeof r.label === 'string' && Array.isArray(r.values))
        .slice(0, 4)
        .map((r: any) => ({ label: String(r.label), values: r.values.map((v: any) => String(v ?? '')) }))
      const comparison: Comparison = { rows }
      if (parsed.pick && typeof parsed.pick.index === 'number') {
        comparison.pick = { index: parsed.pick.index, reason: String(parsed.pick.reason ?? '') }
      }
      return { reply: replyText || 'Here is how they compare:', comparison }
    }
  } catch {}
  return { reply: replyText || raw.trim() }
}

// ── Route ───────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const products: StylistProduct[] = Array.isArray(body?.products) ? body.products.slice(0, 4) : []
    const history: StylistMessage[] = Array.isArray(body?.messages) ? body.messages.slice(-8) : []
    const question: string = typeof body?.question === 'string' ? body.question.trim().slice(0, 500) : ''
    const images: string[] = Array.isArray(body?.images)
      ? (body.images as unknown[]).filter((x): x is string => typeof x === 'string' && x.startsWith('data:')).slice(0, 8)
      : []

    const hasContent = products.length > 0 || images.length > 0
    if (!question || !hasContent) {
      return NextResponse.json({ reply: null, comparison: null })
    }

    const hasImages = images.length > 0

    // Build context block shown to the model regardless of vision/text
    const productContext = products.length > 0
      ? `STORE PRODUCTS the shopper is considering:\n\n${products.map(productBlock).join('\n\n---\n\n')}`
      : ''

    const imageNote = hasImages
      ? `The shopper has also shared ${images.length} photo${images.length > 1 ? 's' : ''} of their own clothing. Analyze the garment(s) in the photo${images.length > 1 ? 's' : ''} and incorporate that into your advice.`
      : ''

    const contextBlock = [productContext, imageNote].filter(Boolean).join('\n\n')

    let raw = ''

    if (hasImages) {
      // Build multimodal messages for vision model
      const visionMessages: VisionMessage[] = [
        { role: 'system' as const, content: contextBlock },
        ...history.map(m => ({ role: m.role, content: m.content })),
      ]

      // Build the final user message with text + images
      const imageParts = images.map(url => ({
        type: 'image_url' as const,
        image_url: { url, detail: 'low' as const },
      }))
      const textPart = { type: 'text' as const, text: question }
      visionMessages.push({ role: 'user', content: [textPart, ...imageParts] })

      const msg = await groqVisionChat(visionMessages, SYSTEM, { max_tokens: 700, temperature: 0.3 })
      raw = (msg?.content ?? '').trim()
    } else {
      // Text-only path (no images)
      const messages = [
        { role: 'system' as const, content: contextBlock },
        ...history.map(m => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: question },
      ]
      const msg = await groqChat(messages, SYSTEM, undefined, { max_tokens: 500, temperature: 0.3 })
      raw = (msg?.content ?? '').trim()
    }

    if (!raw) return NextResponse.json({ reply: null, comparison: null })

    const { reply, comparison } = parseReply(raw)
    return NextResponse.json({ reply, comparison: comparison ?? null })
  } catch (e) {
    console.error('[stylist] error:', e)
    return NextResponse.json({ reply: null, comparison: null })
  }
}
