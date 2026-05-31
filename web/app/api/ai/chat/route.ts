import { NextRequest, NextResponse } from 'next/server'
import { grokChatWithTools, ChatMessage } from '@/lib/grok'
import { searchUCP } from '@/lib/ucpClient'
import { formatMoney } from '@/lib/currency'
import {
  BUYER_COUNTRY_COOKIE,
  BUYER_CURRENCY_COOKIE,
  resolveBuyerContext,
} from '@/lib/buyerContext'
import { getExchangeRates } from '@/lib/exchangeRates'

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
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || 'unknown'
  }
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

  if (current.count >= CHAT_MAX_REQUESTS) {
    return true
  }

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
When presenting products, briefly describe why they fit the user's needs but DO NOT include any URLs or markdown links in your text response. The system will automatically display beautiful product cards with images and links right below your message.`

const SEARCH_TOOL = {
  type: "function",
  function: {
    name: "search_ucp",
    description: "Search for products across Shopify stores using the Universal Commerce Protocol (UCP).",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query (e.g., 'handmade leather boots', 'blue denim jacket')"
        },
        budgetMax: {
          type: "number",
          description: "The maximum budget the user is willing to spend, if specified."
        }
      },
      required: ["query"]
    }
  }
}

export async function POST(req: NextRequest) {
  if (isRateLimited(req)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  try {
    const { message, history } = await req.json()
    if (!message) throw new Error('No message provided')

    const cleanHistory = sanitizeHistory(history || [])
    const messages: ChatMessage[] = [...cleanHistory, { role: 'user', content: message }]

    // Call Grok with Tools
    const aiResponse = await grokChatWithTools(messages, SYSTEM_PROMPT, [SEARCH_TOOL])
    
let products: any[] = []
    let finalContent = aiResponse.content

    // Handle Tool Call
    if (aiResponse.tool_calls && aiResponse.tool_calls.length > 0) {
      const toolCall = aiResponse.tool_calls[0]
      if (toolCall.function.name === 'search_ucp') {
        const args = JSON.parse(toolCall.function.arguments)
        
        // Execute UCP Search
        products = await searchUCP({ query: args.query, budgetMax: args.budgetMax })
        
        // Add the tool call result to conversation and call AI again
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

        const finalAiResponse = await grokChatWithTools(followUpMessages, SYSTEM_PROMPT)
        finalContent = finalAiResponse.content
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
