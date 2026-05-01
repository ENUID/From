import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { aiChat, aiEmbed } from '@/lib/openai'
import { formatMoney } from '@/lib/currency'
import {
  BUYER_COUNTRY_COOKIE,
  BUYER_CURRENCY_COOKIE,
  resolveBuyerContext,
} from '@/lib/buyerContext'

const CHAT_WINDOW_MS = 60_000
const CHAT_MAX_REQUESTS = 20
const MESSAGE_MAX_CHARS = 500
const HISTORY_MAX_TURNS = 6

type RateEntry = {
  count: number
  resetAt: number
}

const rateBuckets = new Map<string, RateEntry>()

function getConvex() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!url) throw new Error('NEXT_PUBLIC_CONVEX_URL is not set')
  return new ConvexHttpClient(url)
}

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

function sanitizeHistory(history: ChatHistoryMessage[]) {
  return history
    .filter((item) => item?.role === 'user' || item?.role === 'assistant')
    .slice(-HISTORY_MAX_TURNS)
    .map((item) => ({
      role: item.role,
      content: String(item.content ?? '').trim().slice(0, MESSAGE_MAX_CHARS),
    }))
    .filter((item) => item.content)
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
  currency?: string
  base_currency?: string
}

function getBuyerCurrency(req: NextRequest) {
  const buyerContext = resolveBuyerContext({
    countryHeader: req.headers.get('x-vercel-ip-country'),
    acceptLanguage: req.headers.get('accept-language'),
    cookieCountry: req.cookies.get(BUYER_COUNTRY_COOKIE)?.value,
    cookieCurrency: req.cookies.get(BUYER_CURRENCY_COOKIE)?.value,
  })
  return buyerContext.currency
}

function normalizeProductsForBuyer(products: SearchProduct[], buyerCurrency: string) {
  return products.map((product) => ({
    ...product,
    base_currency: product.base_currency ?? product.currency ?? 'USD',
    currency: buyerCurrency,
  }))
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
      price: formatMoney(product.price, product.currency, product.base_currency),
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
  if (isRateLimited(req)) {
    return NextResponse.json({ error: 'Too many requests. Please wait a moment and try again.' }, { status: 429 })
  }

  const buyerCurrency = getBuyerCurrency(req)

  const body = await req.json().catch(() => ({}))
  const { message, history = [] } = body as {
    message?: string
    history?: ChatHistoryMessage[]
  }

  const trimmedMessage = message?.trim().slice(0, MESSAGE_MAX_CHARS) ?? ''
  if (!trimmedMessage) {
    return NextResponse.json({ error: 'Missing message' }, { status: 400 })
  }

  const sanitizedHistory = sanitizeHistory(history)
  const intent = await parseIntent(trimmedMessage, sanitizedHistory)

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
    const normalizedProducts = normalizeProductsForBuyer(products, buyerCurrency)
    const text = await formatResponse(normalizedProducts, trimmedMessage)
    return NextResponse.json({ text, products: normalizedProducts, intent: intent.type, fallback: true, currency: buyerCurrency })
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

  const normalizedProducts = normalizeProductsForBuyer(products, buyerCurrency)
  const text = await formatResponse(normalizedProducts, trimmedMessage)
  return NextResponse.json({ text, products: normalizedProducts, intent: intent.type, currency: buyerCurrency })
}
