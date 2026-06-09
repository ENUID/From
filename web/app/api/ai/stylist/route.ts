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

RESPONSE RULES:
- Be direct and conversational. Answer in 1–3 sentences — no filler, no preambles like "Of course!" or "Great question!".
- Ground every claim in the PRODUCT DATA provided. If a detail isn't in the data, say you can't see it listed. Never invent specs, materials, or features.
- Have a clear point of view — when asked which to buy, make a confident, decisive recommendation.
- Mirror the shopper's language.
- NEVER output raw JSON, code, markdown, or any structured data in your text reply. Plain conversational sentences only.

VISUAL COMPARISON (2+ products, comparison or choice question only):
- After your text reply, output ONE comparison block on its own final line, exactly:
[COMPARE: {"rows":[{"label":"Price","values":["£40","£95"]},{"label":"Material","values":["Cotton","Linen"]}],"pick":{"index":1,"reason":"Better quality for the price"}}]
- STRICT RULES — violating any of these will break the UI:
  * 2 to 4 rows max. Only include rows where values differ or that directly answer the question (e.g. Price, Material, Fit, Style, Best for).
  * Each "values" array must have exactly one short entry (≤5 words) per product, in order.
  * Use "—" only for truly unknown values. Never use "can't pick", "unspecified", "n/a", or repeat the same filler across all products.
  * "pick": include index (0 = first product, 1 = second, etc.) and a short, specific reason ONLY if one product is clearly better.
  * Output this block EXACTLY ONCE at the very end of your response. Nothing after it.
- Do NOT output a comparison for single-product questions or general knowledge questions.`

function parseReply(raw: string): { reply: string; comparison?: Comparison } {
  const compareStart = raw.indexOf('[COMPARE:')
  if (compareStart === -1) return { reply: raw.trim() }

  // Walk forward from the opening brace, counting depth, to find the matching }
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

  // Always strip the [COMPARE:...] block from visible text — even if JSON fails to parse
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
