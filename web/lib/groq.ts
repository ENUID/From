// ── LLM provider configuration ──────────────────────────────────────────────
// Provider-agnostic. Every provider below is OpenAI-compatible (same
// /chat/completions endpoint, Bearer auth, tool-calling), so switching brains
// is just config — no code changes.
//
//   To use DeepSeek:  set  LLM_PROVIDER=deepseek  and  DEEPSEEK_API_KEY=sk-...
//   To use Kimi:      set  LLM_PROVIDER=kimi       and  MOONSHOT_API_KEY=sk-...
//   Default:          Groq (existing GROQ_* vars) — keeps current setup working.
//
// Generic overrides (LLM_BASE_URL / LLM_API_KEY / LLM_CHAT_MODEL) win over the
// provider defaults, letting you point at ANY OpenAI-compatible endpoint.

type ProviderConfig = { base: string; key: string; model: string }

const PROVIDER_DEFAULTS: Record<string, ProviderConfig> = {
  groq: {
    base: process.env.GROQ_BASE_URL ?? 'https://api.groq.com/openai/v1',
    key: process.env.GROQ_API_KEY ?? '',
    model: process.env.GROQ_CHAT_MODEL ?? 'llama-3.1-8b-instant',
  },
  deepseek: {
    base: process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com/v1',
    key: process.env.DEEPSEEK_API_KEY ?? '',
    model: process.env.DEEPSEEK_CHAT_MODEL ?? 'deepseek-chat',
  },
  kimi: {
    base: process.env.MOONSHOT_BASE_URL ?? 'https://api.moonshot.ai/v1',
    key: process.env.MOONSHOT_API_KEY ?? '',
    model: process.env.MOONSHOT_CHAT_MODEL ?? 'kimi-k2-0711-preview',
  },
}

const ACTIVE_PROVIDER = (process.env.LLM_PROVIDER ?? 'groq').toLowerCase()
const _resolved = PROVIDER_DEFAULTS[ACTIVE_PROVIDER] ?? PROVIDER_DEFAULTS.groq

export const GROQ_BASE = process.env.LLM_BASE_URL ?? _resolved.base
export const GROQ_API_KEY = process.env.LLM_API_KEY ?? _resolved.key
export const CHAT_MODEL = process.env.LLM_CHAT_MODEL ?? _resolved.model

// DeepSeek/Kimi are a touch slower than Groq's tiny model — give them headroom.
const LLM_TIMEOUT_MS = Number(
  process.env.LLM_TIMEOUT_MS ?? (ACTIVE_PROVIDER === 'groq' ? 10000 : 22000)
)

// Conversational reply after a search — allow more time on the heavier brains so
// we keep the natural stylist reply instead of falling back to a template.
export const POST_TOOL_REPLY_TIMEOUT_MS = ACTIVE_PROVIDER === 'groq' ? 5000 : 9000

export type ChatMessage = {
  role: string
  content: string | null
  name?: string
  tool_calls?: any[]
  tool_call_id?: string
  products?: any[]
}

function getHeaders() {
  if (!GROQ_API_KEY || GROQ_API_KEY.includes('YOUR_') || GROQ_API_KEY.includes('_HERE')) {
    throw new Error(
      `LLM API key is not set for provider "${ACTIVE_PROVIDER}". Set the matching key ` +
      `(e.g. DEEPSEEK_API_KEY for DeepSeek) in your environment.`
    )
  }

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${GROQ_API_KEY}`,
  }
}

/**
 * Raw chat completion call to the AI Provider.
 */
export async function groqChat(
  messages: ChatMessage[],
  system?: string,
  tools?: any[],
  opts?: { max_tokens?: number; temperature?: number },
  retryCount = 0
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

  try {
    const res = await fetch(`${GROQ_BASE}/chat/completions`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
    })

    if (res.status === 429 && retryCount < 2) {
      const errorText = await res.clone().text();
      let delay = 2000;
      try {
        const errorJson = JSON.parse(errorText);
        const match = errorJson.error?.message?.match(/try again in ([\d\.]+)s/i);
        if (match) {
          delay = Math.ceil(parseFloat(match[1]) * 1000) + 200; // Add a small buffer
        }
      } catch (e) {}

      console.warn(`Groq Rate Limited (429). Retrying in ${delay}ms... (Attempt ${retryCount + 1})`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return groqChat(messages, system, tools, opts, retryCount + 1);
    }

    if (!res.ok) {
      const errorText = await res.text();
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error?.code === 'tool_use_failed' && errorJson.error?.failed_generation) {
          console.warn("Caught Groq tool_use_failed error. Self-healing via failed_generation parser...");
          return {
            role: 'assistant',
            content: errorJson.error.failed_generation
          };
        }
      } catch (e) {}

      throw new Error(`AI Provider HTTP ${res.status}: ${errorText}`);
    }

    const data = await res.json()
    return data.choices?.[0]?.message
  } catch (err: any) {
    if (retryCount < 2 && !err.message?.includes('API key')) {
      console.warn(`Groq connection error: ${err.message}. Retrying in 2000ms...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      return groqChat(messages, system, tools, opts, retryCount + 1);
    }
    throw err;
  }
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
  const aiResponse = await groqChat(messages, systemPrompt, tools)

  // 1. If it properly outputted standard tool_calls, return it directly.
  if (aiResponse.tool_calls && aiResponse.tool_calls.length > 0) {
    return aiResponse;
  }

  // 2. If it leaked Llama-3 style <function> tags into content, repair it!
  if (aiResponse.content && aiResponse.content.includes('<function=')) {
    const match = aiResponse.content.match(/<function=(\w+)>(.*?)<\/function>/) ||
                  aiResponse.content.match(/<function=(\w+)>(.*)$/);
    if (match) {
      const toolCallName = match[1];
      let toolCallArgs = match[2];
      
      // Clean up closing tags if we matched the fallback pattern
      if (toolCallArgs.endsWith('</function>')) {
        toolCallArgs = toolCallArgs.substring(0, toolCallArgs.length - 11);
      }
      
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
            arguments: toolCallArgs.trim()
          }
        }]
      };
    }
  }

  // 3. If it leaked bracket-style tool calls (e.g. [search_ucp: "query"])
  if (aiResponse.content && aiResponse.content.includes('[search_ucp:')) {
    const match = aiResponse.content.match(/\[(search_ucp):\s*"(.*?)"\]/);
    if (match) {
      const toolCallName = match[1];
      const query = match[2];
      const toolCallId = 'call_' + Math.random().toString(36).slice(2, 10);
      const finalContent = aiResponse.content.replace(match[0], '').trim();

      return {
        role: 'assistant',
        content: finalContent || null,
        tool_calls: [{
          id: toolCallId,
          type: "function",
          function: {
            name: toolCallName,
            arguments: JSON.stringify({ searchQuery: query })
          }
        }]
      };
    }
  }

  // 4. If it leaked search_ucp>{...} or similar malformed JSON tags
  if (aiResponse.content && aiResponse.content.includes('search_ucp')) {
    const match = aiResponse.content.match(/search_ucp>?\s*({.*})/);
    if (match) {
      const toolCallArgs = match[1];
      const toolCallId = 'call_' + Math.random().toString(36).slice(2, 10);
      const finalContent = aiResponse.content.replace(match[0], '').trim();

      return {
        role: 'assistant',
        content: finalContent || null,
        tool_calls: [{
          id: toolCallId,
          type: "function",
          function: {
            name: 'search_ucp',
            arguments: toolCallArgs
          }
        }]
      };
    }
  }

  // 5. Otherwise, it's just a normal text response
  return aiResponse;
}

/**
 * Second completion after a tool run. Models often return null content when only
 * emitting tool_calls; this turn produces the conversational reply for the UI.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>(resolve => setTimeout(() => resolve(null), ms)),
  ])
}

export async function generatePostToolReply(
  messages: ChatMessage[],
  systemPrompt: string,
  assistantMessage: ChatMessage,
  toolResult: string,
  timeoutMs = 5000,
): Promise<string | null> {
  const toolCall = assistantMessage.tool_calls?.[0]
  if (!toolCall?.id) return null

  const followUp: ChatMessage[] = [
    ...messages,
    {
      role: 'system',
      content: `The search tool returned the following results:\n${toolResult}\n\nPlease provide a conversational reply summarizing these results. Do NOT manually list the products, the UI will display them. Remember to append the [SUGGESTIONS: ...] block at the end.`,
    },
  ]

  try {
    const reply = await withTimeout(
      groqChat(followUp, systemPrompt, undefined, {
        max_tokens: 200,
        temperature: 0.5,
      }).catch(() => null),
      timeoutMs,
    )
    if (!reply) {
      console.warn(`Post-search AI reply timed out after ${timeoutMs}ms`)
      return null
    }
    return reply.content?.trim() || null
  } catch (error) {
    console.error('Post-search AI reply failed:', error)
    return null
  }
}

// Vision model — supports image inputs via the standard content-parts format
export const VISION_MODEL = process.env.GROQ_VISION_MODEL ?? 'meta-llama/llama-4-scout-17b-16e-instruct'

type VisionPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' } }

export type VisionMessage = {
  role: 'user' | 'assistant' | 'system'
  content: string | VisionPart[]
}

export async function groqVisionChat(
  messages: VisionMessage[],
  system: string,
  opts?: { max_tokens?: number; temperature?: number },
  retryCount = 0
): Promise<any> {
  const allMessages: VisionMessage[] = [{ role: 'system', content: system }, ...messages]
  const payload = {
    model: VISION_MODEL,
    messages: allMessages,
    temperature: opts?.temperature ?? 0.2,
    max_tokens: opts?.max_tokens ?? 700,
  }
  try {
    const res = await fetch(`${GROQ_BASE}/chat/completions`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    })
    if (res.status === 429 && retryCount < 2) {
      await new Promise(r => setTimeout(r, 3_000))
      return groqVisionChat(messages, system, opts, retryCount + 1)
    }
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Vision AI HTTP ${res.status}: ${err}`)
    }
    const data = await res.json()
    return data.choices?.[0]?.message
  } catch (err: any) {
    if (retryCount < 1 && !err.message?.includes('API key')) {
      await new Promise(r => setTimeout(r, 2_000))
      return groqVisionChat(messages, system, opts, retryCount + 1)
    }
    throw err
  }
}
