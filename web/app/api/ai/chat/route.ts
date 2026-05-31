import { NextRequest, NextResponse } from 'next/server'
import { generateRobustAIResponse, ChatMessage } from '@/lib/groq'
import { SearchToolSchema, SEARCH_TOOL_DEF } from '@/lib/ai/schema'
import { GlobalCatalogService, UcpProduct } from '@/lib/services/GlobalCatalogService'

const CHAT_WINDOW_MS = 60_000
const CHAT_MAX_REQUESTS = 20
const MESSAGE_MAX_CHARS = 500
const HISTORY_MAX_TURNS = 6

type RateEntry = {
  count: number
  resetAt: number
}

const rateBuckets = new Map<string, RateEntry>()

function getClientKey(req: NextRequest) {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown'
  return req.headers.get('x-real-ip') ?? 'unknown'
}

function isRateLimited(req: NextRequest) {
  const now = Date.now()
  const key = getClientKey(req)
  const current = rateBuckets.get(key)

  if (!current || current.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + CHAT_WINDOW_MS })
    return false
  }
  if (current.count >= CHAT_MAX_REQUESTS) return true
  current.count += 1
  rateBuckets.set(key, current)
  return false
}

function sanitizeHistory(history: any[]): ChatMessage[] {
  const clean: ChatMessage[] = [];
  const recent = history
    .filter((item) => item?.role === 'user' || item?.role === 'assistant')
    .slice(-HISTORY_MAX_TURNS);

  for (const item of recent) {
    const content = String(item.content ?? '').trim().slice(0, MESSAGE_MAX_CHARS);
    if (!content) continue;
    
    clean.push({ role: item.role, content });

    if (item.role === 'assistant' && item.products && item.products.length > 0) {
      const productSummary = item.products.map((p: any) => 
        `- ${p.title} by ${p.vendor} (${p.price} ${p.currency})`
      ).join('\n');
      clean.push({
        role: 'system',
        content: `The UI rendered these products below the assistant's message:\n${productSummary}`
      });
    }
  }
  return clean;
}

const SYSTEM_PROMPT = `You are a high-end AI shopping assistant named "From". Your mission is to help users discover unique items from independent Shopify stores via the Universal Commerce Protocol.

CORE GUIDELINES:
- Assess Intent: For each user message, determine if they want to find new products (e.g., "find shoes", "sorry, I meant blue") or if they want advice/conversation (e.g., "compare the first and second", "which is better?", "hi").
- Tool Usage: If they are looking for or refining products, you MUST use the 'search_ucp' tool. If they only want advice, comparison, or casual chat, DO NOT use the tool; answer directly based on context.
- Pagination: If the user asks for "more" products, you MUST use the 'search_ucp' tool with the EXACT SAME query as your previous search. Do not add words like "more" or "other". The system handles pagination automatically.
- Presentation: Never manually list products, bullet points, or URLs. The UI will automatically display product cards below your message. Just provide a short, elegant, conversational summary of your actions or advice.
- Honesty: Never hallucinate or invent products. If the tool returns no results, politely apologize.
- Mirror Language: Always reply in the exact same language the user wrote in.`

export async function POST(req: NextRequest) {
  if (isRateLimited(req)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  try {
    const { message, history } = await req.json()
    if (!message) throw new Error('No message provided')

    const cleanHistory = sanitizeHistory(history || [])
    const messages: ChatMessage[] = [...cleanHistory, { role: 'user', content: message }]

    // 1. Initial AI Generation
    const aiResponse = await generateRobustAIResponse(messages, SYSTEM_PROMPT, [SEARCH_TOOL_DEF])
    
    let products: UcpProduct[] = []
    let finalContent = aiResponse.content

    // 2. Handle Tool Execution
    if (aiResponse.tool_calls && aiResponse.tool_calls.length > 0) {
      const toolCall = aiResponse.tool_calls[0]
      if (toolCall.function.name === 'search_ucp') {
        try {
          // Validate AI arguments
          const rawArgs = JSON.parse(toolCall.function.arguments)
          const args = SearchToolSchema.parse(rawArgs)
          
          console.log('AI search intent:', args);

          // Extract previously seen product IDs from history
          const excludeIds: string[] = [];
          for (const msg of history || []) {
            if (msg.role === 'assistant' && msg.products) {
              for (const p of msg.products) {
                if (p.id) excludeIds.push(p.id);
              }
            }
          }

          // Single call to Shopify Global Catalog
          products = await GlobalCatalogService.search(args.searchQuery, args.budgetMax, excludeIds);
          
          // Provide results back to AI for final synthesis
          // Sanitize the product list to prevent token bloat and rate limits
          const slimProducts = products.map(p => ({ 
            title: p.title, 
            vendor: p.vendor, 
            price: p.price,
            currency: p.currency,
            tags: p.tags
          }));
          
          const followUpMessages: ChatMessage[] = [
            ...messages,
            { role: 'assistant', content: '', tool_calls: [toolCall] },
            { 
              role: 'tool', 
              tool_call_id: toolCall.id, 
              name: 'search_ucp', 
              content: JSON.stringify(slimProducts) 
            }
          ]

          const finalAiResponse = await generateRobustAIResponse(followUpMessages, SYSTEM_PROMPT, [])
          finalContent = finalAiResponse.content
        } catch (error: any) {
          console.error('Error executing tool:', error)
          products = []
          finalContent = `[System Error Debug during Tool Synth]: ${error.message}`
        }
      }
    }

    return NextResponse.json({
      text: finalContent || "I'm sorry, I couldn't process that request right now.",
      products,
    })
  } catch (error: any) {
    console.error('Chat API Error:', error)
    return NextResponse.json({ 
      text: `[System Error Debug]: ${error.message || 'Internal error'}`,
      products: [] 
    })
  }
}
