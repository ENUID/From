import { NextRequest, NextResponse } from 'next/server'
import { geminiChat } from '@/lib/gemini'
import {
  CHAT_MODEL, FAST_MODEL, GROQ_DIRECT_SMART_MODEL, GROQ_DIRECT_FAST_MODEL, GROQ_DIRECT_CONFIGURED,
  pingOpenRouter, pingGroqDirect,
} from '@/lib/groq'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'

// Diagnostic for the "a lot of people are styling with me" busy message. That
// message only appears when EVERY model call fails with a rate-limit/quota
// error — so we need to see which provider is actually failing and why. This
// pings Gemini, OpenRouter, and the Groq-direct fallback IN ISOLATION (not
// through groqChat's automatic fallback, which would mask which one failed)
// and reports each result separately.
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
      GROQ_DIRECT_configured: GROQ_DIRECT_CONFIGURED,
      gemini_model: process.env.GEMINI_STYLIST_MODEL ?? 'gemini-2.0-flash (default)',
      openrouter_smart_model: CHAT_MODEL,
      openrouter_fast_model: FAST_MODEL,
      groq_direct_smart_model: GROQ_DIRECT_SMART_MODEL,
      groq_direct_fast_model: GROQ_DIRECT_FAST_MODEL,
    },
  }

  // Gemini test (primary for vision, first attempt for heavy Fabrics queries)
  try {
    const r = await geminiChat([{ role: 'user', content: 'Reply with the single word ok.' }], undefined, { max_tokens: 10 })
    out.gemini = { ok: true, reply: (r?.content ?? '').slice(0, 60) }
  } catch (e) {
    out.gemini = { ok: false, error: (e as Error).message?.slice(0, 300) ?? 'unknown' }
  }

  // OpenRouter test — smart tier, isolated (no fallback)
  try {
    const r = await pingOpenRouter(CHAT_MODEL)
    out.openrouter_smart = { ok: true, model: CHAT_MODEL, reply: (r?.content ?? '').slice(0, 60) }
  } catch (e) {
    out.openrouter_smart = { ok: false, model: CHAT_MODEL, error: (e as Error).message?.slice(0, 300) ?? 'unknown' }
  }

  // OpenRouter test — fast tier, isolated (no fallback)
  try {
    const r = await pingOpenRouter(FAST_MODEL)
    out.openrouter_fast = { ok: true, model: FAST_MODEL, reply: (r?.content ?? '').slice(0, 60) }
  } catch (e) {
    out.openrouter_fast = { ok: false, model: FAST_MODEL, error: (e as Error).message?.slice(0, 300) ?? 'unknown' }
  }

  // Groq-direct test — smart tier (second-line fallback, only if configured)
  if (GROQ_DIRECT_CONFIGURED) {
    try {
      const r = await pingGroqDirect(GROQ_DIRECT_SMART_MODEL)
      out.groq_direct_smart = { ok: true, model: GROQ_DIRECT_SMART_MODEL, reply: (r?.content ?? '').slice(0, 60) }
    } catch (e) {
      out.groq_direct_smart = { ok: false, model: GROQ_DIRECT_SMART_MODEL, error: (e as Error).message?.slice(0, 300) ?? 'unknown' }
    }

    // Groq-direct test — fast tier
    try {
      const r = await pingGroqDirect(GROQ_DIRECT_FAST_MODEL)
      out.groq_direct_fast = { ok: true, model: GROQ_DIRECT_FAST_MODEL, reply: (r?.content ?? '').slice(0, 60) }
    } catch (e) {
      out.groq_direct_fast = { ok: false, model: GROQ_DIRECT_FAST_MODEL, error: (e as Error).message?.slice(0, 300) ?? 'unknown' }
    }
  } else {
    out.groq_direct_smart = { ok: false, error: 'GROQ_API_KEY not set — fallback not configured' }
    out.groq_direct_fast = { ok: false, error: 'GROQ_API_KEY not set — fallback not configured' }
  }

  // Usage summary — trailing 24h and trailing 1h, from the ai_usage events
  // logged by every exit point of /api/ai/stylist (see logAiUsage there).
  // Estimated tokens (chars/4), not exact provider-reported usage.
  if (process.env.NEXT_PUBLIC_CONVEX_URL) {
    try {
      const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL)
      const [last24h, lastHour] = await Promise.all([
        convex.query(api.users.getAiUsageSummary, { windowMs: 24 * 60 * 60 * 1000 }),
        convex.query(api.users.getAiUsageSummary, { windowMs: 60 * 60 * 1000 }),
      ])
      out.usage = { last24h, lastHour }
    } catch (e) {
      out.usage = { error: (e as Error).message?.slice(0, 300) ?? 'unknown' }
    }
  } else {
    out.usage = { error: 'NEXT_PUBLIC_CONVEX_URL not set' }
  }

  return NextResponse.json(out)
}
