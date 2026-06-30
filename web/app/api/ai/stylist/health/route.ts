import { NextRequest, NextResponse } from 'next/server'
import { geminiChat } from '@/lib/gemini'
import { groqChat, CHAT_MODEL, FAST_MODEL } from '@/lib/groq'

// Diagnostic for the "a lot of people are styling with me" busy message. That
// message only appears when EVERY model call fails with a rate-limit/quota
// error — so we need to see which provider is actually failing and why. This
// pings Gemini and OpenRouter (both the smart and fast tiers) directly and
// reports the result.
//
// Secret-gated (no API keys are ever returned — only booleans + error text).
// Open on the live site:
//   https://from.enuid.com/api/ai/stylist/health?secret=YOUR_CRON_SECRET
export const maxDuration = 30
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const out: Record<string, unknown> = {
    env: {
      GOOGLE_AI_API_KEY_set: !!process.env.GOOGLE_AI_API_KEY,
      OPENROUTER_API_KEY_set: !!process.env.OPENROUTER_API_KEY,
      gemini_model: process.env.GEMINI_STYLIST_MODEL ?? 'gemini-2.0-flash (default)',
      openrouter_smart_model: CHAT_MODEL,
      openrouter_fast_model: FAST_MODEL,
    },
  }

  // Gemini test
  try {
    const r = await geminiChat([{ role: 'user', content: 'Reply with the single word ok.' }], undefined, { max_tokens: 10 })
    out.gemini = { ok: true, reply: (r?.content ?? '').slice(0, 60) }
  } catch (e) {
    out.gemini = { ok: false, error: (e as Error).message?.slice(0, 300) ?? 'unknown' }
  }

  // OpenRouter test — smart tier (used for search planning + Fabrics heavy path)
  try {
    const r = await groqChat([{ role: 'user', content: 'Reply with the single word ok.' }], undefined, undefined, { max_tokens: 10, model: CHAT_MODEL })
    out.openrouter_smart = { ok: true, model: CHAT_MODEL, reply: (r?.content ?? '').slice(0, 60) }
  } catch (e) {
    out.openrouter_smart = { ok: false, model: CHAT_MODEL, error: (e as Error).message?.slice(0, 300) ?? 'unknown' }
  }

  // OpenRouter test — fast tier (chitchat routing, rerank, descriptions, etc.)
  try {
    const r = await groqChat([{ role: 'user', content: 'Reply with the single word ok.' }], undefined, undefined, { max_tokens: 10, model: FAST_MODEL })
    out.openrouter_fast = { ok: true, model: FAST_MODEL, reply: (r?.content ?? '').slice(0, 60) }
  } catch (e) {
    out.openrouter_fast = { ok: false, model: FAST_MODEL, error: (e as Error).message?.slice(0, 300) ?? 'unknown' }
  }

  return NextResponse.json(out)
}
