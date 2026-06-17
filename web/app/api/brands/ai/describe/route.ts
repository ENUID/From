/**
 * POST /api/brands/ai/describe
 *
 * Merchant AI: turn a product name + a few notes into a polished, on-brand
 * description, SEO title, meta description, and tag suggestions. Brand-session
 * protected. This is the "AI for the store side" — the value a brand gets back
 * for connecting.
 *
 * Body: { title: string, notes?: string, materials?: string, audience?: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { groqChat, STYLIST_MODEL } from '@/lib/groq'
import { getBrandSession } from '@/lib/brands/session'

export const runtime = 'nodejs'
export const maxDuration = 30

const SYSTEM = `You are a senior fashion copywriter for independent brands. You write product copy that is evocative but precise — it sells the feeling and names the concrete details (fabric, fit, construction, occasion). Never invent specs you weren't given. No hype words ("game-changing", "must-have"), no clichés. British-neutral tone, confident, tactile.

Return ONLY valid JSON, no markdown fence:
{
  "description": "2-3 short paragraphs (~70-110 words total)",
  "seoTitle": "<=60 chars, product + key attribute",
  "metaDescription": "<=155 chars, compelling search snippet",
  "tags": ["6-10 lowercase search tags: material, style, occasion, fit"]
}`

export async function POST(req: NextRequest) {
  const domain = await getBrandSession()
  if (!domain) return NextResponse.json({ error: 'Not connected' }, { status: 401 })

  let body: { title?: string; notes?: string; materials?: string; audience?: string } = {}
  try { body = await req.json() } catch {}
  const title = (body.title ?? '').trim().slice(0, 140)
  if (!title) return NextResponse.json({ error: 'Product title required' }, { status: 400 })

  const brief = [
    `Product: ${title}`,
    body.materials ? `Materials: ${body.materials.slice(0, 200)}` : '',
    body.audience ? `Audience: ${body.audience.slice(0, 120)}` : '',
    body.notes ? `Notes: ${body.notes.slice(0, 400)}` : '',
  ].filter(Boolean).join('\n')

  try {
    const completion = await groqChat(
      [{ role: 'user', content: brief }],
      SYSTEM,
      undefined,
      { model: STYLIST_MODEL, temperature: 0.6, max_tokens: 700 },
    )
    const raw: string = completion?.choices?.[0]?.message?.content ?? ''
    const jsonText = raw.replace(/^```json\s*/i, '').replace(/```$/i, '').trim()

    let parsed: unknown
    try {
      parsed = JSON.parse(jsonText)
    } catch {
      // Model didn't return clean JSON — hand back the prose so the merchant still gets value.
      return NextResponse.json({ description: raw.trim(), seoTitle: title, metaDescription: '', tags: [] })
    }
    return NextResponse.json(parsed)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
