const OPENAI_BASE = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1'
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? ''

export const EMBED_MODEL = process.env.OPENAI_EMBED_MODEL ?? 'text-embedding-3-small'
export const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL ?? 'gpt-4o-mini'
export const EMBED_DIMENSIONS = Number(process.env.OPENAI_EMBED_DIMENSIONS ?? 768)

type ChatMessage = {
  role: string
  content: string
}

function getHeaders() {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set')
  }

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${OPENAI_API_KEY}`,
  }
}

export async function aiEmbed(text: string): Promise<number[]> {
  const res = await fetch(`${OPENAI_BASE}/embeddings`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      model: EMBED_MODEL,
      input: text,
      encoding_format: 'float',
      dimensions: EMBED_DIMENSIONS,
    }),
  })

  if (!res.ok) {
    throw new Error(`OpenAI embed ${res.status}: ${await res.text()}`)
  }

  const data = await res.json()
  return data.data?.[0]?.embedding ?? []
}

export async function aiChat(
  messages: ChatMessage[],
  system?: string,
  opts?: { max_tokens?: number; temperature?: number }
): Promise<string> {
  const allMessages = system
    ? [{ role: 'system', content: system }, ...messages]
    : messages

  const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages: allMessages,
      temperature: opts?.temperature ?? 0.3,
      max_tokens: opts?.max_tokens ?? 300,
    }),
  })

  if (!res.ok) {
    throw new Error(`OpenAI chat ${res.status}: ${await res.text()}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content?.trim() ?? ''
}

export async function aiHealth(): Promise<{ ok: boolean; provider: string; models: string[] }> {
  return {
    ok: Boolean(OPENAI_API_KEY),
    provider: 'openai',
    models: [CHAT_MODEL, EMBED_MODEL],
  }
}
