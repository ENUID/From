// Google Gemini via the OpenAI-compatible endpoint
// Docs: https://ai.google.dev/gemini-api/docs/openai

export const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/openai'
export const GEMINI_STYLIST_MODEL =
  process.env.GEMINI_STYLIST_MODEL ?? 'gemini-2.0-flash'

export type GeminiMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string | null
}

export async function geminiChat(
  messages: GeminiMessage[],
  system?: string,
  opts?: { max_tokens?: number; temperature?: number },
  retryCount = 0
): Promise<{ role: string; content: string | null }> {
  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) throw new Error('GOOGLE_AI_API_KEY is not set')

  const allMessages = system
    ? [{ role: 'system' as const, content: system }, ...messages]
    : messages

  const payload = {
    model: GEMINI_STYLIST_MODEL,
    messages: allMessages,
    temperature: opts?.temperature ?? 0.4,
    max_tokens: opts?.max_tokens ?? 700,
  }

  try {
    const res = await fetch(`${GEMINI_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    })

    if (res.status === 429 && retryCount < 2) {
      const retryAfter = Number(res.headers.get('retry-after') ?? 4)
      await new Promise(r => setTimeout(r, retryAfter * 1000))
      return geminiChat(messages, system, opts, retryCount + 1)
    }

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Gemini HTTP ${res.status}: ${err}`)
    }

    const data = await res.json()
    return data.choices?.[0]?.message ?? { role: 'assistant', content: null }
  } catch (err: any) {
    if (retryCount < 1 && !err.message?.includes('API key')) {
      await new Promise(r => setTimeout(r, 2_000))
      return geminiChat(messages, system, opts, retryCount + 1)
    }
    throw err
  }
}
