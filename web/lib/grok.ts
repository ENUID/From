const GROK_BASE = process.env.GROK_BASE_URL ?? 'https://api.x.ai/v1'
const GROK_API_KEY = process.env.GROK_API_KEY ?? ''
export const CHAT_MODEL = process.env.GROK_CHAT_MODEL ?? 'grok-2-latest'

export type ChatMessage = {
  role: string
  content: string | null
  name?: string
  tool_calls?: any[]
  tool_call_id?: string
}

function getHeaders() {
  if (!GROK_API_KEY) {
    throw new Error('GROK_API_KEY is not set')
  }

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${GROK_API_KEY}`,
  }
}

export async function grokChatWithTools(
  messages: ChatMessage[],
  system?: string,
  tools?: any[],
  opts?: { max_tokens?: number; temperature?: number }
): Promise<any> {
  const allMessages = system
    ? [{ role: 'system', content: system }, ...messages]
    : messages

  const payload: any = {
    model: CHAT_MODEL,
    messages: allMessages,
    temperature: opts?.temperature ?? 0.3,
    max_tokens: opts?.max_tokens ?? 500,
  }

  if (tools && tools.length > 0) {
    payload.tools = tools
    payload.tool_choice = 'auto'
  }

  const res = await fetch(`${GROK_BASE}/chat/completions`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    throw new Error(`Grok chat ${res.status}: ${await res.text()}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message
}
