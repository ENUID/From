export const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'
export const OPENROUTER_STYLIST_MODEL =
  process.env.OPENROUTER_STYLIST_MODEL ?? 'deepseek/deepseek-v4-flash'

export type OpenRouterMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string | null
}

export async function openrouterChat(
  messages: OpenRouterMessage[],
  system?: string,
  opts?: { max_tokens?: number; temperature?: number },
  retryCount = 0
): Promise<{ role: string; content: string | null }> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set')

  const allMessages = system
    ? [{ role: 'system' as const, content: system }, ...messages]
    : messages

  const payload = {
    model: OPENROUTER_STYLIST_MODEL,
    messages: allMessages,
    temperature: opts?.temperature ?? 0.4,
    max_tokens: opts?.max_tokens ?? 700,
  }

  try {
    const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://from.enuid.com',
        'X-Title': 'FROM',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    })

    if (res.status === 429 && retryCount < 2) {
      const retryAfter = Number(res.headers.get('retry-after') ?? 3)
      await new Promise(r => setTimeout(r, retryAfter * 1000))
      return openrouterChat(messages, system, opts, retryCount + 1)
    }

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`OpenRouter HTTP ${res.status}: ${err}`)
    }

    const data = await res.json()
    return data.choices?.[0]?.message ?? { role: 'assistant', content: null }
  } catch (err: any) {
    if (retryCount < 1 && !err.message?.includes('API key')) {
      await new Promise(r => setTimeout(r, 2_000))
      return openrouterChat(messages, system, opts, retryCount + 1)
    }
    throw err
  }
}
