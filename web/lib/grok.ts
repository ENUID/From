export const GROK_BASE = process.env.GROK_BASE_URL ?? 'https://api.x.ai/v1'
export const GROK_API_KEY = process.env.GROK_API_KEY ?? ''
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

/**
 * Raw chat completion call to the AI Provider.
 */
export async function grokChat(
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
    temperature: opts?.temperature ?? 0.1,
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
    throw new Error(`AI Provider HTTP ${res.status}: ${await res.text()}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message
}

/**
 * Robust wrapper that executes the chat and natively repairs any 
 * open-source model tool syntax leaks (like Llama 3's <function> tags).
 */
export async function generateRobustAIResponse(
  messages: ChatMessage[],
  systemPrompt: string,
  tools: any[]
): Promise<ChatMessage> {
  const aiResponse = await grokChat(messages, systemPrompt, tools)

  // 1. If it properly outputted standard tool_calls, return it directly.
  if (aiResponse.tool_calls && aiResponse.tool_calls.length > 0) {
    return aiResponse;
  }

  // 2. If it leaked Llama-3 style <function> tags into content, repair it!
  if (aiResponse.content && aiResponse.content.includes('<function=')) {
    const match = aiResponse.content.match(/<function=(\w+)>(.*?)<\/function>/);
    if (match) {
      const toolCallName = match[1];
      const toolCallArgs = match[2];
      const toolCallId = 'call_' + Math.random().toString(36).slice(2, 10);
      
      // Clean the raw tags out of the visual content
      const finalContent = aiResponse.content.replace(match[0], '').trim();
      
      return {
        role: 'assistant',
        content: finalContent || null,
        tool_calls: [{
          id: toolCallId,
          type: "function",
          function: {
            name: toolCallName,
            arguments: toolCallArgs
          }
        }]
      };
    }
  }

  // 3. Otherwise, it's just a normal text response
  return aiResponse;
}
