import { NextRequest, NextResponse } from 'next/server'
import { groqChat } from '@/lib/groq'

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

// Structured comparison the UI renders as a visual card.
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

const SYSTEM = `You are "From" — a warm, sharp personal stylist with genuinely good taste. The shopper is looking at specific product(s) and wants your help understanding or comparing them.

RULES:
- Answer their question directly and conversationally in 1–4 sentences. Be specific and useful, never generic filler.
- Ground every claim in the PRODUCT DATA provided. NEVER invent materials, measurements, or features that aren't in the data. If something isn't stated, say you can't see it listed rather than guessing.
- Have a point of view — when asked which to pick, make a confident, reasoned recommendation.
- Mirror the language the shopper writes in.

VISUAL COMPARISON:
- When there are 2+ products AND the shopper is comparing them or asking which to choose, end your reply with ONE comparison block on its own final line, in EXACTLY this format:
[COMPARE: {"rows":[{"label":"Price","values":["…","…"]},{"label":"Material","values":["…","…"]}],"pick":{"index":0,"reason":"short reason"}}]
- Include only rows that matter to the question or where the products genuinely differ (e.g. Price, Material, Fit, Style, Best for). Keep each value short (a few words). "values" must have one entry per product, in order.
- Omit "pick" if no single product is clearly better for their need.
- If there is only ONE product, or the question is general (e.g. "what is merino wool?"), DO NOT output a comparison block — just answer in text.`

function parseReply(raw: string): { reply: string; comparison?: Comparison } {
  const m = raw.match(/\[COMPARE:\s*(\{[\s\S]*\})\s*\]\s*$/)
  if (!m) return { reply: raw.trim() }
  const reply = raw.slice(0, m.index).trim()
  try {
    const parsed = JSON.parse(m[1])
    if (Array.isArray(parsed?.rows) && parsed.rows.length > 0) {
      const rows = parsed.rows
        .filter((r: any) => r && typeof r.label === 'string' && Array.isArray(r.values))
        .map((r: any) => ({ label: String(r.label), values: r.values.map((v: any) => String(v ?? '')) }))
      const comparison: Comparison = { rows }
      if (parsed.pick && typeof parsed.pick.index === 'number') {
        comparison.pick = { index: parsed.pick.index, reason: String(parsed.pick.reason ?? '') }
      }
      return { reply: reply || 'Here is how they compare:', comparison }
    }
  } catch {}
  return { reply: reply || raw.trim() }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const products: StylistProduct[] = Array.isArray(body?.products) ? body.products.slice(0, 4) : []
    const history: StylistMessage[] = Array.isArray(body?.messages) ? body.messages.slice(-8) : []
    const question: string = typeof body?.question === 'string' ? body.question.trim().slice(0, 500) : ''

    if (!question || products.length === 0) {
      return NextResponse.json({ reply: null, comparison: null })
    }

    const context = products.map(productBlock).join('\n\n---\n\n')

    const messages = [
      { role: 'system' as const, content: `PRODUCT DATA the shopper is viewing:\n\n${context}` },
      ...history.map(m => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: question },
    ]

    const msg = await groqChat(messages, SYSTEM, undefined, { max_tokens: 420, temperature: 0.4 })
    const raw = (msg?.content ?? '').trim()
    if (!raw) return NextResponse.json({ reply: null, comparison: null })

    const { reply, comparison } = parseReply(raw)
    return NextResponse.json({ reply, comparison: comparison ?? null })
  } catch (e) {
    console.error('[stylist] error:', e)
    return NextResponse.json({ reply: null, comparison: null })
  }
}
