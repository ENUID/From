// ── Cerebras — a 4th independent free-tier inference pool ───────────────────
// Mirrors lib/groq.ts's plain-fetch, OpenAI-compatible pattern deliberately
// (same retry/429/timeout shape) so every existing "fire-and-forget usage
// logging, graceful multi-tier fallback, isolated diagnostic ping" convention
// documented over there carries over here unchanged. This file only ever
// ADDS a fallback rung to an existing chain (stylistChat, relevanceRerank's
// LLM judge) — it never replaces OpenRouter/Gemini/Groq-direct, so a missing
// key or an exhausted free tier here degrades exactly like any other
// provider already does: silently, to the next one in line.
//
// Free tier (as of 2026): 1,000,000 tokens/day, 30 req/min, no credit card —
// but only an 8K token CONTEXT cap (not related to the daily volume number).
// Cerebras' custom chip hardware makes even their largest free model fast,
// so there's no speed reason to prefer a smaller model here the way there
// might be on GPU-hosted providers.
//
// Default model: gpt-oss-120b — OpenAI's open-weight reasoning model,
// already the trusted "smart tier" choice elsewhere in this codebase
// (GROQ_DIRECT_SMART_MODEL in lib/groq.ts is the same model family via
// Groq direct). Native context on Cerebras is 131K, well above what any
// prompt here needs; the free-tier account cap above still applies
// regardless of the model chosen. Supports a reasoning_effort param
// (low/medium/high) if this ever needs tuning — not wired up here since no
// other provider in this codebase exposes that knob.
//
// Requires CEREBRAS_API_KEY (https://cloud.cerebras.ai — free signup, no
// card). If unset, every call below throws immediately and the caller's
// existing fallback loop just moves on to the next provider.
const CEREBRAS_BASE = process.env.CEREBRAS_BASE_URL ?? 'https://api.cerebras.ai/v1'
const CEREBRAS_API_KEY = process.env.CEREBRAS_API_KEY ?? ''
export const CEREBRAS_MODEL = process.env.CEREBRAS_MODEL ?? 'gpt-oss-120b'
export const CEREBRAS_CONFIGURED = !!CEREBRAS_API_KEY

type CerebrasMessage = {
  role: string
  content: string | null
  name?: string
}

async function cerebrasCompletion(
  messages: CerebrasMessage[],
  system?: string,
  opts?: { max_tokens?: number; temperature?: number; model?: string },
  retryCount = 0,
): Promise<any> {
  if (!CEREBRAS_API_KEY) throw new Error('CEREBRAS_API_KEY is not set. Get one at https://cloud.cerebras.ai and add it to .env.local / Vercel.')

  const allMessages = system
    ? [{ role: 'system', content: system }, ...messages]
    : messages

  const payload = {
    model: opts?.model ?? CEREBRAS_MODEL,
    messages: allMessages,
    temperature: opts?.temperature ?? 0.1,
    max_tokens: opts?.max_tokens ?? 1200,
  }

  try {
    const res = await fetch(`${CEREBRAS_BASE}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${CEREBRAS_API_KEY}` },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(25000),
    })

    if (res.status === 429 && retryCount < 2) {
      const errorText = await res.clone().text()
      let delay = 2000
      try {
        const errorJson = JSON.parse(errorText)
        const match = errorJson.error?.message?.match(/try again in ([\d.]+)s/i)
        if (match) delay = Math.ceil(parseFloat(match[1]) * 1000) + 200
      } catch {}
      // Cap at 8s so a long provider-suggested wait doesn't timeout the
      // Vercel function — bail immediately and let the caller's fallback
      // loop try the next provider instead.
      if (delay > 8000) throw new Error(`Rate limit: suggested wait ${delay}ms exceeds cap`)
      await new Promise(resolve => setTimeout(resolve, delay))
      return cerebrasCompletion(messages, system, opts, retryCount + 1)
    }

    if (!res.ok) {
      const errorText = await res.text()
      throw new Error(`Cerebras HTTP ${res.status}: ${errorText}`)
    }

    const data = await res.json()
    return data.choices?.[0]?.message
  } catch (err: any) {
    if (retryCount < 2 && !err.message?.includes('API key')) {
      await new Promise(resolve => setTimeout(resolve, 2000))
      return cerebrasCompletion(messages, system, opts, retryCount + 1)
    }
    throw err
  }
}

export async function cerebrasChat(
  messages: CerebrasMessage[],
  system?: string,
  opts?: { max_tokens?: number; temperature?: number; model?: string },
): Promise<any> {
  return cerebrasCompletion(messages, system, opts)
}

// Isolated diagnostic seam — bypasses any fallback loop, same shape as
// pingOpenRouter/pingGroqDirect in lib/groq.ts, so /api/ai/stylist/health
// can report Cerebras' status independently.
export async function pingCerebras(): Promise<any> {
  if (!CEREBRAS_API_KEY) throw new Error('CEREBRAS_API_KEY is not set')
  return cerebrasCompletion([{ role: 'user', content: 'Reply with the single word ok.' }], undefined, { max_tokens: 10 })
}
