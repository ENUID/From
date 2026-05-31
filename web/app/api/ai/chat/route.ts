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
  return history
    .filter((item) => item?.role === 'user' || item?.role === 'assistant')
    .slice(-HISTORY_MAX_TURNS)
    .map((item) => ({
      role: item.role,
      content: String(item.content ?? '').trim().slice(0, MESSAGE_MAX_CHARS),
    }))
    .filter((item) => item.content)
}

const SYSTEM_PROMPT = `You are a high-end AI shopping assistant named "From". 
Your job is to help users discover amazing products across millions of independent Shopify stores using the Universal Commerce Protocol.

CRITICAL INSTRUCTIONS:
1. TOOL USE: If the user is looking for a product, you MUST use the search_ucp tool. You MUST translate their request into English for the search tool arguments.
2. TONE & LANGUAGE: ALWAYS reply to the user in the EXACT SAME LANGUAGE they used in their current message. Be warm, friendly, and act like a premium personal shopper.
3. PRESENTING RESULTS: DO NOT output a bulleted list of the products. DO NOT include any URLs or markdown links. The system will automatically display beautiful product cards right below your message. Instead, just write 1-2 short, conversational paragraphs summarizing what you found and why they are perfect for the user's needs based on the product titles and tags.
4. NO HALLUCINATION: If the search_ucp tool returns an empty array [], YOU MUST NOT MAKE UP PRODUCTS! Apologize politely and explain that you couldn't find exactly what they were looking for.
5. CONVERSATIONAL MODE: If the user is just asking for advice, comparing products you already found, or chatting normally, DO NOT call the search_ucp tool. Just answer them directly and helpfully based on your knowledge.`

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
