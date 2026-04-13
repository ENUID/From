import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { aiChat, aiEmbed } from '@/lib/ai'

function getConvex() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!url) throw new Error('NEXT_PUBLIC_CONVEX_URL is not set')
  return new ConvexHttpClient(url)
}

const INTENT_SYSTEM = `You are an intent parser for a shopping assistant. Return ONLY valid JSON, no markdown.

Schema: {"type":"search"|"buy"|"compare"|"clarify","attributes":{"keywords":"string","budget_max":null|number}}

Examples:
"leather bag under $200" -> {"type":"search","attributes":{"keywords":"leather bag","budget_max":200}}
"hello" -> {"type":"clarify","attributes":{"keywords":"","budget_max":null}}`

const FORMAT_SYSTEM = `You are a shopping assistant for Fluid Orbit, a marketplace for independent stores.
Write 2-3 natural sentences. Mention 1-2 product names. End with a brief question to narrow down.
No bullet points. No markdown.`

type ChatHistoryMessage = {
  role: 'user' | 'assistant'
  content: string
}

type SearchProduct = {
  id: string
  title: string
  vendor: string
  price: number
}

async function parseIntent(message: string, history: ChatHistoryMessage[]) {
  try {
    const raw = await aiChat(
      [...history.slice(-4), { role: 'user', content: message }],
      INTENT_SYSTEM,
      { max_tokens: 120, temperature: 0.1 }
    )
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('no JSON')
    const parsed = JSON.parse(match[0])
    return {
      type: (parsed.type as string) ?? 'search',
      keywords: (parsed.attributes?.keywords as string) || message,
      budgetMax: (parsed.attributes?.budget_max as number | null) ?? null,
    }
  } catch {
    return { type: 'search', keywords: message, budgetMax: null }
  }
}

async function formatResponse(products: SearchProduct[], query: string) {
  if (!products.length) {
    return "I couldn't find matching products right now. Try describing what you're looking for differently: material, use case, or style?"
  }

  try {
    const summary = products.slice(0, 3).map((product) => ({
      name: product.title,
      store: product.vendor,
      price: `$${product.price}`,
    }))
    return await aiChat(
      [{ role: 'user', content: `Shopper searched: "${query}"\nFound: ${JSON.stringify(summary)}\nWrite a helpful response.` }],
      FORMAT_SYSTEM,
      { max_tokens: 120, temperature: 0.5 }
    )
  } catch {
    return `Found ${products.length} options from independent stores. Which style or price range interests you most?`
  }
}

export async function POST(req: NextRequest) {
  const { message, history = [] } = await req.json() as {
    message?: string
    history?: ChatHistoryMessage[]
  }

  if (!message?.trim()) {
    return NextResponse.json({ error: 'Missing message' }, { status: 400 })
  }

  const intent = await parseIntent(message, history)

  if (intent.type === 'clarify') {
    return NextResponse.json({
      text: "Could you describe what you're looking for? Mention the product type, material, budget, or how you'd use it.",
      products: [],
      intent: 'clarify',
    })
  }

  let vector: number[]
  try {
    vector = await aiEmbed(intent.keywords)
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error('Embed error:', errorMessage)

    const convex = getConvex()
    const products = await (convex as any).query('search:keywordSearch', {
      query: intent.keywords,
      budgetMax: intent.budgetMax,
      limit: 4,
    }).catch(() => [])
    const text = await formatResponse(products, message)
    return NextResponse.json({ text, products, intent: intent.type, fallback: true })
  }

  let products: SearchProduct[] = []
  try {
    const convex = getConvex()
    products = await (convex as any).action('search:semanticSearch', {
      vector,
      budgetMax: intent.budgetMax,
      limit: 4,
    })
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error('Vector search error:', errorMessage)

    const convex = getConvex()
    products = await (convex as any).query('search:keywordSearch', {
      query: intent.keywords,
      budgetMax: intent.budgetMax,
      limit: 4,
    }).catch(() => [])
  }

  const text = await formatResponse(products, message)
  return NextResponse.json({ text, products, intent: intent.type })
}
