const OLLAMA_BASE = process.env.OLLAMA_URL ?? 'http://localhost:11434'

export const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL ?? 'nomic-embed-text'
export const CHAT_MODEL = process.env.OLLAMA_CHAT_MODEL ?? 'llama3.2:3b'

// ── Embed với nomic-embed-text (768 dims) ─────────────────────────────────
export async function ollamaEmbed(text: string): Promise<number[]> {
  const res = await fetch(`${OLLAMA_BASE}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: EMBED_MODEL, input: text }),
  })
  if (!res.ok) throw new Error(`Ollama embed ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.embeddings?.[0] ?? []
}

// ── Chat completion ────────────────────────────────────────────────────────
export async function ollamaChat(
  messages: { role: string; content: string }[],
  system?: string,
  opts?: { max_tokens?: number; temperature?: number }
): Promise<string> {
  const allMessages = system
    ? [{ role: 'system', content: system }, ...messages]
    : messages

  const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages: allMessages,
      stream: false,
      options: {
        num_predict: opts?.max_tokens ?? 300,
        temperature: opts?.temperature ?? 0.3,
      },
    }),
  })
  if (!res.ok) throw new Error(`Ollama chat ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.message?.content?.trim() ?? ''
}

// ── Health check ──────────────────────────────────────────────────────────
export async function ollamaHealth(): Promise<{ ok: boolean; models: string[] }> {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) return { ok: false, models: [] }
    const data = await res.json()
    return { ok: true, models: (data.models ?? []).map((m: any) => m.name as string) }
  } catch {
    return { ok: false, models: [] }
  }
}
