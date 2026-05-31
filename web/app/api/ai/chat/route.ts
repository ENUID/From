import { NextRequest, NextResponse } from 'next/server'
import { generateRobustAIResponse, ChatMessage } from '@/lib/grok'
import { SearchToolSchema, SEARCH_TOOL_DEF } from '@/lib/ai/schema'
import { DiscoveryService } from '@/lib/services/DiscoveryService'
import { CatalogService, UcpProduct } from '@/lib/services/CatalogService'
import { RelevanceService } from '@/lib/services/RelevanceService'

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

const SYSTEM_PROMPT = `You are an AI shopping assistant named From. 
You help users find products across various independent stores. 
If the user is looking for a product, you MUST use the search_ucp tool to find it. 
CRITICAL INSTRUCTION: Analyze the user's intent to extract the singular core product (e.g., 'bowl', 'jacket', 'vase') and its attributes before calling the search_ucp tool.
When presenting products, briefly describe why they fit the user's needs but DO NOT include any URLs or markdown links in your text response. The system will automatically display beautiful product cards right below your message.
CRITICAL INSTRUCTION 2: If the search_ucp tool returns an empty array [], YOU MUST NOT MAKE UP PRODUCTS! You MUST apologize and state clearly that you could not find any products matching their criteria at this time.`

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
          
          console.log('AI categorized search intent:', args);

          // Force a deterministic query string built only from attributes and core product
          // This prevents Llama 3's variable phrasing from breaking the Discovery cache
          const stableQuery = [...(args.attributes || []), args.coreProduct]
            .join(' ')
            .toLowerCase()
            .trim();

          // Orchestrate Micro-services
          const domains = await DiscoveryService.discoverDomains(stableQuery)
          
          const nestedProducts = await Promise.all(
            domains.map(store => CatalogService.searchStore(store, stableQuery))
          )
          
          products = RelevanceService.filterAndRank(nestedProducts.flat(), args)
          
          // Provide results back to AI for final synthesis
          const followUpMessages = [
            ...messages,
            aiResponse,
            {
              role: "tool",
              tool_call_id: toolCall.id,
              name: toolCall.function.name,
              content: JSON.stringify(products)
            }
          ]

          const finalAiResponse = await generateRobustAIResponse(followUpMessages, SYSTEM_PROMPT, [])
          finalContent = finalAiResponse.content
        } catch (err) {
          console.error('Failed to orchestrate tool call pipeline:', err)
        }
      }
    }

    return NextResponse.json({
      text: finalContent || "I'm sorry, I couldn't process that request right now.",
      products,
    })
  } catch (error: any) {
    console.error('Chat API Error:', error)
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 })
  }
}
