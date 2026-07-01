// ── AI text/vision client ────────────────────────────────────────────────────
// Talks to OpenRouter (https://openrouter.ai), not Groq directly. We moved off
// Groq because it periodically retires hosted open-weight models on short
// notice — llama-3.1-8b-instant, llama-3.3-70b-versatile and
// llama-4-scout-17b-16e-instruct (everything this file used to call) were all
// deprecated by Groq on 2026-06-17. OpenRouter proxies the same kind of open
// models (DeepSeek, Qwen, Llama, etc.) behind one stable OpenAI-compatible API,
// so when a model gets retired again it's an env var change, not a rewrite.
//
// Function/constant names below (groqChat, CHAT_MODEL, ...) are kept as-is on
// purpose — a dozen routes import them, and renaming would touch every call
// site for a cosmetic win. Only this file and the env vars matter if the
// provider changes again.
//
// Requires OPENROUTER_API_KEY (get one at https://openrouter.ai/keys — no
// credit card needed for the free-tier models below). Model IDs are env-driven
// with defaults below — verify the defaults still exist at
// https://openrouter.ai/models and override via env vars if not.
//
// Defaulted to the FREE (":free" suffix) model variants — zero cost, same as
// how Groq's free tier was used before. Tradeoff: OpenRouter's free tier is
// capped account-wide (across every ":free" model combined) at 20 req/min and
// 50 req/day with no credit purchased, or 1000/day once you've bought $10 of
// credit (one-time, doesn't need to be spent — it just raises the free-tier
// ceiling). If you start seeing the "busy" message a lot, that cap is why —
// either wait for it to reset, or add $10 credit to lift it to 1000/day
// without paying per-request. Switch to a paid model anytime via
// OPENROUTER_SMART_MODEL / OPENROUTER_FAST_MODEL / OPENROUTER_VISION_MODEL —
// no code change needed either way.
const AI_BASE = process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1'
const AI_API_KEY = process.env.OPENROUTER_API_KEY ?? ''
// Back-compat aliases (old code/scripts may still reference these names).
export const GROQ_BASE = AI_BASE
export const GROQ_API_KEY = AI_API_KEY
// "Smart" tier — tool-calling capable, used for search planning + the Fabrics
// stylist's heavy path. Override with OPENROUTER_SMART_MODEL.
export const CHAT_MODEL = process.env.OPENROUTER_SMART_MODEL ?? 'deepseek/deepseek-chat-v3.1:free'
export const STYLIST_MODEL = process.env.OPENROUTER_SMART_MODEL ?? 'deepseek/deepseek-chat-v3.1:free'
// "Fast" tier — chitchat routing, rerank judging, descriptions, shipping
// parsing, memory compression. Defaults to the same model as the smart tier
// for safety (one fewer unverified model ID); point it at something cheaper/
// quicker via OPENROUTER_FAST_MODEL once you've picked one from the catalog.
export const FAST_MODEL = process.env.OPENROUTER_FAST_MODEL ?? CHAT_MODEL
// Vision FALLBACK only — Gemini is primary (see wardrobeVisionChat below);
// this only fires when Gemini is rate-limited or GOOGLE_AI_API_KEY is unset.
export const VISION_MODEL = process.env.OPENROUTER_VISION_MODEL ?? 'meta-llama/llama-4-maverick:free'

export type ChatMessage = {
  role: string
  content: string | null
  name?: string
  tool_calls?: any[]
  tool_call_id?: string
  products?: any[]
}

function getHeaders() {
  if (!AI_API_KEY || AI_API_KEY.includes('YOUR_')) {
    throw new Error('OPENROUTER_API_KEY is not set. Get one at https://openrouter.ai/keys and add it to .env.local / Vercel.')
  }

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${AI_API_KEY}`,
    // OpenRouter uses these for attribution + per-app rate-limit tiering.
    // Optional, but recommended — harmless if the values don't matter to you.
    'HTTP-Referer': process.env.OPENROUTER_SITE_URL ?? 'https://from.enuid.com',
    'X-Title': 'FROM',
  }
}

/**
 * Raw chat completion call to the AI Provider.
 */
export async function groqChat(
  messages: ChatMessage[],
  system?: string,
  tools?: any[],
  opts?: { max_tokens?: number; temperature?: number; model?: string },
  retryCount = 0
): Promise<any> {
  const allMessages = system
    ? [{ role: 'system', content: system }, ...messages]
    : messages

  const payload: any = {
    model: opts?.model ?? CHAT_MODEL,
    messages: allMessages,
    temperature: opts?.temperature ?? 0.1,
    max_tokens: opts?.max_tokens ?? 1200,
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
      signal: AbortSignal.timeout(25000),
    })

    if (res.status === 429 && retryCount < 2) {
      const errorText = await res.clone().text();
      let delay = 2000;
      try {
        const errorJson = JSON.parse(errorText);
        const match = errorJson.error?.message?.match(/try again in ([\d\.]+)s/i);
        if (match) {
          delay = Math.ceil(parseFloat(match[1]) * 1000) + 200;
        }
      } catch (e) {}

      // Cap at 8s so a long provider-suggested wait doesn't timeout the Vercel function.
      // If the wait would be too long, bail immediately and let the caller try a fallback model.
      if (delay > 8000) throw new Error(`Rate limit: suggested wait ${delay}ms exceeds cap`)

      console.warn(`Rate limited (429). Retrying in ${delay}ms... (Attempt ${retryCount + 1})`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return groqChat(messages, system, tools, opts, retryCount + 1);
    }

    if (!res.ok) {
      const errorText = await res.text();
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error?.code === 'tool_use_failed' && errorJson.error?.failed_generation) {
          console.warn("Caught tool_use_failed error. Self-healing via failed_generation parser...");
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
      console.warn(`AI provider connection error: ${err.message}. Retrying in 2000ms...`);
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
        max_tokens: 450,
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

// ── Vision model ──────────────────────────────────────────────────────────────

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

// ── Gemini Flash vision ───────────────────────────────────────────────────────
// Primary for wardrobe scans. Throws {status:429} on rate-limit so the caller
// can fall back to the Groq-vision-replacement model without wrapping in a try/catch everywhere.

async function geminiVisionChat(
  systemPrompt: string,
  question: string,
  imageDataUrls: string[],
  opts?: { max_tokens?: number; temperature?: number }
): Promise<string> {
  // Matches the rest of the codebase (lib/gemini.ts) — the key you add in Vercel.
  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) { const e: any = new Error('GOOGLE_AI_API_KEY not set'); e.status = 0; throw e }

  const parts: any[] = [{ text: `${systemPrompt}\n\n${question}` }]
  for (const url of imageDataUrls) {
    const m = url.match(/^data:([^;]+);base64,(.+)$/)
    if (m) parts.push({ inline_data: { mime_type: m[1], data: m[2] } })
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { maxOutputTokens: opts?.max_tokens ?? 900, temperature: opts?.temperature ?? 0.3 },
      }),
      signal: AbortSignal.timeout(30_000),
    }
  )

  if (res.status === 429) { const e: any = new Error('Gemini rate limit'); e.status = 429; throw e }
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

// ── Wardrobe vision — Gemini primary, OpenRouter vision fallback ───────────────────────────────
// Tries Gemini 2.0 Flash first (better clothing recognition). On 429 (rate
// limit hit) or missing key, falls back seamlessly to the OpenRouter vision model.

export async function wardrobeVisionChat(
  systemPrompt: string,
  question: string,
  imageDataUrls: string[],
  opts?: { max_tokens?: number; temperature?: number }
): Promise<string> {
  try {
    return await geminiVisionChat(systemPrompt, question, imageDataUrls, opts)
  } catch (err: any) {
    // 429 = Gemini rate limit, 0 = key not set — fall back to OpenRouter vision
    if (err.status === 429 || err.status === 0) {
      const imageParts = imageDataUrls.map(url => ({
        type: 'image_url' as const,
        image_url: { url, detail: 'low' as const },
      }))
      const msg = await groqVisionChat(
        [{ role: 'user', content: [{ type: 'text', text: question }, ...imageParts] }],
        systemPrompt,
        opts
      )
      return (msg?.content ?? '').trim()
    }
    throw err
  }
}
