import { NextRequest, NextResponse } from 'next/server'
import { geminiChat } from '@/lib/gemini'
import { groqChat, CHAT_MODEL } from '@/lib/groq'

// Temporary diagnostic for the "a lot of people are styling with me" busy
// message. That message only appears when EVERY model call fails with a
// rate-limit/quota error — so we need to see which provider is actually
// failing and why. This pings Gemini and Groq directly and reports the result.
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
      GROQ_API_KEY_set: !!process.env.GROQ_API_KEY,
      gemini_model: process.env.GEMINI_STYLIST_MODEL ?? 'gemini-2.0-flash (default)',
    },
  }

  // Gemini test
  try {
    const r = await geminiChat([{ role: 'user', content: 'Reply with the single word ok.' }], undefined, { max_tokens: 10 })
    out.gemini = { ok: true, reply: (r?.content ?? '').slice(0, 60) }
  } catch (e) {
    out.gemini = { ok: false, error: (e as Error).message?.slice(0, 300) ?? 'unknown' }
  }

  // Groq test
  try {
    const r = await groqChat([{ role: 'user', content: 'Reply with the single word ok.' }], undefined, undefined, { max_tokens: 10, model: CHAT_MODEL })
    out.groq = { ok: true, reply: (r?.content ?? '').slice(0, 60) }
  } catch (e) {
    out.groq = { ok: false, error: (e as Error).message?.slice(0, 300) ?? 'unknown' }
  }

  return NextResponse.json(out)
}
