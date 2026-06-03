import { NextRequest, NextResponse } from 'next/server'
import { generateRobustAIResponse, generatePostToolReply, ChatMessage } from '@/lib/groq'

export const maxDuration = 60
import { SearchToolArgs, SearchToolSchema, SEARCH_TOOL_DEF } from '@/lib/ai/schema'
import { GlobalCatalogService, UcpProduct, type CatalogSearchDebug } from '@/lib/services/GlobalCatalogService'

const CHAT_WINDOW_MS = 60_000
const CHAT_MAX_REQUESTS = 20
const MESSAGE_MAX_CHARS = 500
const HISTORY_MAX_TURNS = 4
const SORT_VALUES = new Set(['price_asc', 'price_desc', 'relevance'])
const CLOTHING_TERMS = [
  'apparel', 'bag', 'bags', 'blazer', 'boot', 'boots', 'clothing', 'coat',
  'dress', 'dresses', 'fashion', 'hat', 'jacket', 'jeans', 'jewelry',
  'linen', 'pants', 'shirt', 'shirts', 'shoe', 'shoes', 'shorts', 'skirt',
  'sneaker', 'sneakers', 'sweater', 'tee', 'top', 'trouser', 'trousers',
  'váy', 'áo', 'quần', 'giày', 'túi',
]
const FILTER_KEYWORDS = [
  'black', 'white', 'blue', 'green', 'red', 'pink', 'brown', 'gray', 'grey',
  'beige', 'cream', 'navy', 'linen', 'cotton', 'wool', 'silk', 'leather',
  'denim', 'canvas', 'hemp', 'cashmere', 'organic', 'handmade', 'trắng',
  'đen', 'xanh', 'đỏ', 'hồng', 'nâu',
]

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

function normalizeSort(value: unknown) {
  return typeof value === 'string' && SORT_VALUES.has(value)
    ? value as 'price_asc' | 'price_desc' | 'relevance'
    : 'price_asc'
}

function collectProductIds(history: any[] = [], extraIds: unknown = []) {
  const ids = new Set<string>()

  for (const message of history) {
    if (!Array.isArray(message?.products)) continue
    for (const product of message.products) {
      if (typeof product?.id === 'string' && product.id) {
        ids.add(product.id)
      }
    }
  }

  if (Array.isArray(extraIds)) {
    for (const id of extraIds) {
      if (typeof id === 'string' && id) {
        ids.add(id)
      }
    }
  }

  return Array.from(ids)
}

function parseSearchToolArguments(argumentsText: string) {
  try {
    return SearchToolSchema.parse(JSON.parse(argumentsText))
  } catch (parseError) {
    const queryMatch = argumentsText.match(/"searchQuery"\s*:\s*"([^"]+)"/)
    if (!queryMatch) throw parseError

    const budgetMatch = argumentsText.match(/"budgetMax"\s*:\s*(\d+(?:\.\d+)?)/)
    const budgetCurrencyMatch = argumentsText.match(/"budgetCurrency"\s*:\s*"([A-Za-z]{3})"/)
    const clothingMatch = argumentsText.match(/"isClothing"\s*:\s*(true|false)/)
    const sortMatch = argumentsText.match(/"sort"\s*:\s*"([^"]+)"/)

    return SearchToolSchema.parse({
      searchQuery: queryMatch[1],
      budgetMax: budgetMatch ? Number(budgetMatch[1]) : undefined,
      budgetCurrency: budgetCurrencyMatch ? budgetCurrencyMatch[1].toUpperCase() : undefined,
      isClothing: clothingMatch ? clothingMatch[1] === 'true' : undefined,
      sort: sortMatch ? sortMatch[1] : undefined,
    })
  }
}

function inferLanguage(message: string) {
  return /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(message)
    ? 'vi'
    : 'en'
}

function stripBudgetText(message: string) {
  return message
    .replace(/\b(under|below|less than|up to|max|maximum|budget|for)\s+[$€£¥₫]?\s*\d+(?:[.,]\d+)?\s*(?:k|m|tr|triệu|million)?\s*(?:usd|eur|gbp|jpy|vnd|đ|dong)?/gi, ' ')
    .replace(/\b(dưới|duoi|tầm|tam|khoảng|khoang|không quá|khong qua)\s+[$€£¥₫]?\s*\d+(?:[.,]\d+)?\s*(?:k|m|tr|triệu|million)?\s*(?:usd|eur|gbp|jpy|vnd|đ|dong)?/gi, ' ')
    .replace(/[$€£¥₫]\s*\d+(?:[.,]\d+)?\s*(?:k|m|tr|triệu|million)?/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseBudget(message: string, buyerCurrency: string) {
  const raw = message.toLowerCase()
  const amountMatch = raw.match(/(?:under|below|less than|up to|max|maximum|budget|for|dưới|duoi|tầm|tam|khoảng|khoang|không quá|khong qua)?\s*([$€£¥₫])?\s*(\d+(?:[.,]\d+)?)\s*(k|m|tr|triệu|million)?\s*(usd|eur|gbp|jpy|vnd|đ|dong)?/)
  if (!amountMatch) return {}

  const symbol = amountMatch[1]
  const suffix = amountMatch[3]
  const explicitCurrency = amountMatch[4]
  let amount = Number(amountMatch[2].replace(',', '.'))
  if (!Number.isFinite(amount) || amount <= 0) return {}

  if (suffix === 'k') amount *= 1_000
  if (suffix === 'm' || suffix === 'million') amount *= 1_000_000
  if (suffix === 'tr' || suffix === 'triệu') amount *= 1_000_000

  let currency = buyerCurrency
  if (symbol === '$') currency = 'USD'
  if (symbol === '€') currency = 'EUR'
  if (symbol === '£') currency = 'GBP'
  if (symbol === '¥') currency = 'JPY'
  if (symbol === '₫' || explicitCurrency === 'vnd' || explicitCurrency === 'đ' || explicitCurrency === 'dong') currency = 'VND'
  if (explicitCurrency && explicitCurrency.length === 3) currency = explicitCurrency.toUpperCase()

  return { budgetMax: amount, budgetCurrency: currency }
}

function expandDirectQuery(query: string) {
  const normalized = query.trim().replace(/\s+/g, ' ')
  if (!normalized) return ''

  const variants = new Set<string>([normalized])
  if (/\bshirts\b/i.test(normalized)) variants.add(normalized.replace(/\bshirts\b/gi, 'shirt'))
  if (/\bshirt\b/i.test(normalized)) variants.add(normalized.replace(/\bshirt\b/gi, 'shirts'))
  if (/\bdresses\b/i.test(normalized)) variants.add(normalized.replace(/\bdresses\b/gi, 'dress'))
  if (/\bdress\b/i.test(normalized)) variants.add(normalized.replace(/\bdress\b/gi, 'dresses'))
  if (/\blinen\b/i.test(normalized)) variants.add(`${normalized} clothing`)
  if (/\bshirt|shirts|top|tee\b/i.test(normalized)) variants.add(`${normalized} top`)

  return Array.from(variants).slice(0, 5).join(' OR ')
}

function parseDirectSearchIntent(message: string, buyerCurrency: string): SearchToolArgs | null {
  const query = stripBudgetText(message)
  if (!query || query.length < 2) return null

  const lowerQuery = query.toLowerCase()
  const isClothing = CLOTHING_TERMS.some(term => lowerQuery.includes(term))
  const keywords = FILTER_KEYWORDS.filter(keyword => lowerQuery.includes(keyword))
  const sort = /\b(expensive|highest|premium|luxury)\b/i.test(message) ? 'price_desc' : 'price_asc'

  return SearchToolSchema.parse({
    searchQuery: expandDirectQuery(query),
    ...parseBudget(message, buyerCurrency),
    isClothing,
    keywords,
    sort,
  })
}

async function runCatalogSearch(args: SearchToolArgs, options: {
  countryCode: string | null;
  buyerCurrency: string;
  excludeIds?: string[];
  refreshReserve?: boolean;
  fastFirstPage?: boolean;
  loadMore?: boolean;
  debug?: CatalogSearchDebug;
}) {
  const budgetCurrency = (args.budgetCurrency || options.buyerCurrency).toUpperCase()
  const sort = normalizeSort(args.sort)
  const products = await GlobalCatalogService.search(
    args.searchQuery,
    args.budgetMax,
    options.excludeIds || [],
    options.countryCode,
    args.isClothing,
    args.keywords || [],
    sort,
    budgetCurrency,
    {
      refreshReserve: options.refreshReserve,
      fastFirstPage: options.fastFirstPage,
      loadMore: options.loadMore,
      debug: options.debug,
    }
  )

  return {
    products,
    searchQuery: args.searchQuery,
    budgetMax: args.budgetMax,
    budgetCurrency,
    isClothing: args.isClothing,
    keywords: args.keywords,
    sort,
  }
}

function formatSearchToolResult(products: UcpProduct[]) {
  if (products.length === 0) {
    return 'search_ucp returned 0 products.'
  }

  const preview = products.slice(0, 6).map(product =>
    `- ${product.title} by ${product.vendor} (${product.price} ${product.currency})`
  ).join('\n')

  return `search_ucp returned ${products.length} products. Preview:\n${preview}`
}

function formatSearchDiagnostics(
  args: SearchToolArgs,
  ctx: { countryCode: string | null; buyerCurrency: string },
  language: 'vi' | 'en',
) {
  const orTerms = args.searchQuery
    .split(/\s+OR\s+/i)
    .map(term => term.trim())
    .filter(Boolean)
  const queryLine = orTerms.length > 1
    ? (language === 'vi'
      ? `${orTerms.length} cụm từ khóa (OR): ${orTerms.join(' · ')}`
      : `${orTerms.length} OR terms: ${orTerms.join(' · ')}`)
    : (language === 'vi'
      ? `từ khóa: "${args.searchQuery}"`
      : `keywords: "${args.searchQuery}"`)

  const filters: string[] = [queryLine]
  if (args.keywords?.length) {
    filters.push(
      language === 'vi'
        ? `bắt buộc trong mô tả: ${args.keywords.join(', ')}`
        : `must include: ${args.keywords.join(', ')}`,
    )
  }
  if (typeof args.budgetMax === 'number' && args.budgetMax > 0) {
    const currency = (args.budgetCurrency || ctx.buyerCurrency).toUpperCase()
    filters.push(
      language === 'vi'
        ? `ngân sách tối đa ${args.budgetMax} ${currency}`
        : `max budget ${args.budgetMax} ${currency}`,
    )
  }
  if (ctx.countryCode) {
    filters.push(
      language === 'vi'
        ? `giao hàng: ${ctx.countryCode}`
        : `ships to: ${ctx.countryCode}`,
    )
  }

  return filters.join(' · ')
}

function fallbackText(
  message: string,
  products: UcpProduct[],
  options?: { budgetMax?: number | null; diagnostics?: string },
) {
  const language = inferLanguage(message)
  if (products.length === 0) {
    const hadBudget = typeof options?.budgetMax === 'number' && options.budgetMax > 0
    let text = language === 'vi'
      ? (hadBudget
        ? 'Mình chưa tìm thấy sản phẩm trong ngân sách đó. Bạn thử nới budget hoặc mô tả rộng hơn một chút nhé.'
        : 'Mình chưa tìm thấy sản phẩm phù hợp. Thử mô tả rộng hơn hoặc đổi từ khóa (màu, chất liệu, kiểu dáng) nhé.')
      : (hadBudget
        ? "I couldn't find anything within that budget yet. Try raising the limit or broadening what you're looking for."
        : "I couldn't find a match yet. Try a broader description or different keywords (color, material, style).")

    if (options?.diagnostics) {
      text += language === 'vi'
        ? `\n\nĐã tìm trên Shopify catalog: ${options.diagnostics}`
        : `\n\nSearched Shopify catalog: ${options.diagnostics}`
    }
    return text
  }

  return language === 'vi'
    ? 'Mình tìm được vài lựa chọn phù hợp với yêu cầu của bạn.'
    : "I found a few options that match what you're looking for."
}

function sanitizeHistory(history: any[], currentMessage: string): ChatMessage[] {
  const clean: ChatMessage[] = [];
  const recent = history
    .filter((item) => item?.role === 'user' || item?.role === 'assistant')
    .slice(-HISTORY_MAX_TURNS);

  const currentMsgLower = currentMessage.toLowerCase();

  for (let i = 0; i < recent.length; i++) {
    const item = recent[i];
    const content = String(item.content ?? item.text ?? '').trim().slice(0, MESSAGE_MAX_CHARS);
    if (!content && item.role !== 'assistant') continue;
    
    clean.push({ role: item.role, content: content || null });

    if (item.role === 'assistant' && item.products && item.products.length > 0) {
      // Find the user's subsequent reply in history
      const nextMsg = recent[i + 1];
      const nextUserText = nextMsg && nextMsg.role === 'user'
        ? String(nextMsg.content ?? nextMsg.text ?? '').toLowerCase()
        : '';

      const combinedUserText = `${nextUserText} ${currentMsgLower}`;

      const productsToInclude: any[] = [];
      item.products.forEach((p: any, idx: number) => {
        const productIndex = idx + 1;
        const vendorLower = (p.vendor || '').toLowerCase();

        // Specific match checks
        const indexWords = [
          `thứ ${productIndex}`, 
          `số ${productIndex}`, 
          `mẫu ${productIndex}`, 
          `sản phẩm ${productIndex}`, 
          `sp ${productIndex}`, 
          `#${productIndex}`,
          `number ${productIndex}`,
          `option ${productIndex}`
        ];
        
        const numberRegex = new RegExp(`\\b${productIndex}\\b`);
        const isIndexReferenced = indexWords.some(w => combinedUserText.includes(w)) || numberRegex.test(combinedUserText);

        const vendorWords = vendorLower.split(/\s+/).filter((w: string) => w.length > 3);
        const isBrandReferenced = vendorWords.some((w: string) => combinedUserText.includes(w));

        // Always include top 6; lazy load index > 6 on demand
        if (idx < 6 || isIndexReferenced || isBrandReferenced) {
          productsToInclude.push(p);
        }
      });

      const productSummary = productsToInclude.map((p: any) => {
        return `- ${p.title} by ${p.vendor} (${p.price} ${p.currency || p.base_currency})`;
      }).join('\n');
      
      clean.push({
        role: 'system',
        content: `The UI rendered these products below the assistant's message:\n${productSummary}`
      });
    }
  }
  return clean;
}

const SYSTEM_PROMPT = `You are a high-end AI shopping assistant named "From". Your mission is to help users discover unique items from independent Shopify stores via the Universal Commerce Protocol.

PERSONALITY & TONE:
- Be warm, charming, and highly empathetic. Act like a passionate personal shopper or a boutique curator who genuinely cares about the user's style and needs.
- Avoid robotic, generic, or overly dry corporate language. Use a conversational, natural, and friendly tone. Don't just say "Here are the results." Say something like "I've handpicked some gorgeous options that I think you'll absolutely love."
- Show enthusiasm for high-quality materials, sustainable choices, and unique designs. 
- Keep it concise but elegantly written. Do not be overly verbose, but make every word count to build an emotional connection.

CORE GUIDELINES:
- Assess Intent: For each user message, determine if they want to find new products (e.g., "find shoes", "sorry, I meant blue") or if they want advice/conversation (e.g., "compare the first and second", "which is better?", "hi").
- Tool Usage: If they are looking for or refining products, you MUST use the 'search_ucp' tool. 
- Search Query Expansion & Reservoir Filling: When using the 'search_ucp' tool, you MUST extract the core item and expand it into 3-5 distinct variations (including translations to languages like Vietnamese, Japanese, or Korean, synonyms, plurals, or brand variations) combined using 'OR' logic in the \`searchQuery\`.
  * This is critical to ensure that the search results pool is large and diverse, so that the infinite scroll reservoir is always fully filled with unique products and never runs dry.
  * For example, if the user asks for "shirt", use: "shirt OR shirts OR áo sơ mi OR シャツ OR shirt top"
  * For brand searches like "Faherty", use: "Faherty OR Faherty Brand OR Faherty clothing OR Faherty shirt OR Faherty apparel"
  * For "linen dress", use: "linen dress OR váy linen OR リネン ドレス OR linen clothing OR linen midi dress"
  * Do not copy the user's query literally. Always expand it to at least 3-5 terms using 'OR'.
- Pagination: If the user asks for "more" products, you MUST use the 'search_ucp' tool with the EXACT SAME query as your previous search. Do not add words like "more" or "other". The system handles pagination automatically.
- Presentation: Never manually list products, bullet points, or URLs. The UI will automatically display product cards below your message. Just provide a short, elegant, conversational summary of your actions or advice.
- Honesty: Never hallucinate or invent products. If the tool returns no results, politely apologize.
- Mirror Language: Always reply in the exact same language the user wrote in.`

export async function POST(req: NextRequest) {
  try {
    const { message, history, savedProducts, searchQuery, budgetMax, budgetCurrency, buyerCurrency, isClothing, currentExcludeIds, keywords, sort } = await req.json()
    if (!message) throw new Error('No message provided')
    const countryCode = req.headers.get('x-vercel-ip-country') || req.headers.get('cf-ipcountry') || null;
    const activeBuyerCurrency = typeof buyerCurrency === 'string' ? buyerCurrency.toUpperCase() : 'USD'

    // 1. Direct bypass to skip slow/expensive LLM calls when loading more products
    if (message === 'more' && searchQuery) {
      const excludeIds = collectProductIds(history || [], currentExcludeIds)
      const moreArgs = SearchToolSchema.parse({
        searchQuery,
        budgetMax,
        budgetCurrency: typeof budgetCurrency === 'string' ? budgetCurrency : activeBuyerCurrency,
        isClothing,
        keywords: Array.isArray(keywords) ? keywords : [],
        sort: normalizeSort(sort),
      })
      const moreOptions = {
        countryCode,
        buyerCurrency: activeBuyerCurrency,
        excludeIds,
      }

      const catalogDebug: CatalogSearchDebug = {}
      const result = await runCatalogSearch(moreArgs, {
        ...moreOptions,
        loadMore: true,
        refreshReserve: true,
        debug: catalogDebug,
      })

      console.log(`[Load more] catalog refresh | query: "${searchQuery}" | excludes: ${excludeIds.length} | new: ${result.products.length}`, catalogDebug);

      return NextResponse.json({
        text: "Here are some more options for you:",
        ...result,
        meta: catalogDebug,
      });
    }

    // Normal path requires rate limit checking
    if (isRateLimited(req)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const cleanHistory = sanitizeHistory(history || [], message)
    const messages: ChatMessage[] = [...cleanHistory, { role: 'user', content: message }]

    let dynamicSystemPrompt = SYSTEM_PROMPT;
    if (savedProducts && savedProducts.length > 0) {
      const savedSummary = savedProducts.map((p: any) => `- ${p.title} (${p.price} ${p.currency})`).join('\n');
      dynamicSystemPrompt += `\n\nUSER'S SAVED PRODUCTS:\nThe user has saved the following products in their cart/favorites:\n${savedSummary}\nKeep this in mind if they ask to compare or refer to things they've saved or liked.`;
    }

    // 2. Initial AI Generation
    let aiResponse: ChatMessage
    try {
      aiResponse = await generateRobustAIResponse(messages, dynamicSystemPrompt, [SEARCH_TOOL_DEF])
    } catch (error: any) {
      console.error('AI search planning failed, using direct catalog fallback:', error)
      const fallbackIntent = parseDirectSearchIntent(message, activeBuyerCurrency)
      if (!fallbackIntent) throw error

      const result = await runCatalogSearch(fallbackIntent, {
        countryCode,
        buyerCurrency: activeBuyerCurrency,
        excludeIds: collectProductIds(history || []),
        fastFirstPage: true,
      })

      const diagnostics = formatSearchDiagnostics(fallbackIntent, {
        countryCode,
        buyerCurrency: activeBuyerCurrency,
      }, inferLanguage(message))

      return NextResponse.json({
        text: fallbackText(message, result.products, {
          budgetMax: result.budgetMax,
          diagnostics: result.products.length === 0 ? diagnostics : undefined,
        }),
        ...result,
      })
    }
    
    let products: UcpProduct[] = []
    let finalContent = aiResponse.content
    let activeSearchQuery: string | undefined = undefined
    let activeBudgetMax: number | null | undefined = undefined
    let activeBudgetCurrency: string | undefined = undefined
    let activeIsClothing: boolean | undefined = undefined
    let activeKeywords: string[] | undefined = undefined
    let activeSort: 'price_asc' | 'price_desc' | 'relevance' | undefined = undefined

    // 3. Handle Tool Execution
    if (aiResponse.tool_calls && aiResponse.tool_calls.length > 0) {
      const toolCall = aiResponse.tool_calls[0]
      if (toolCall.function.name === 'search_ucp') {
        try {
          const args = parseSearchToolArguments(toolCall.function.arguments)
          activeSearchQuery = args.searchQuery
          activeBudgetMax = args.budgetMax
          activeBudgetCurrency = (args.budgetCurrency || activeBuyerCurrency).toUpperCase()
          activeIsClothing = args.isClothing
          activeKeywords = args.keywords
          activeSort = normalizeSort(args.sort)
          
          console.log('AI search intent:', args);

          const searchDiagnostics = formatSearchDiagnostics(args, {
            countryCode,
            buyerCurrency: activeBuyerCurrency,
          }, inferLanguage(message))

          const result = await runCatalogSearch(args, {
            countryCode,
            buyerCurrency: activeBuyerCurrency,
            excludeIds: collectProductIds(history || []),
            fastFirstPage: true,
          })
          products = result.products
          activeBudgetCurrency = result.budgetCurrency
          activeSort = result.sort
          const aiText = aiResponse.content?.trim()
          if (aiText) {
            finalContent = aiText
            if (products.length === 0) {
              finalContent += inferLanguage(message) === 'vi'
                ? `\n\nĐã tìm trên Shopify catalog: ${searchDiagnostics}`
                : `\n\nSearched Shopify catalog: ${searchDiagnostics}`
            }
          } else if (products.length > 0) {
            // Skip 2nd LLM when we already have cards — avoids Vercel timeout / hung UI.
            finalContent = fallbackText(message, products, { budgetMax: activeBudgetMax })
          } else {
            const postSearchText = await generatePostToolReply(
              messages,
              dynamicSystemPrompt,
              aiResponse,
              formatSearchToolResult(products),
              5000,
            )
            finalContent = postSearchText || fallbackText(message, products, {
              budgetMax: activeBudgetMax,
              diagnostics: searchDiagnostics,
            })
          }
        } catch (error: any) {
          console.error('Error executing tool:', error)
          const fallbackIntent = parseDirectSearchIntent(message, activeBuyerCurrency)
          if (fallbackIntent) {
            const result = await runCatalogSearch(fallbackIntent, {
              countryCode,
              buyerCurrency: activeBuyerCurrency,
              excludeIds: collectProductIds(history || []),
              fastFirstPage: true,
            })

            const diagnostics = formatSearchDiagnostics(fallbackIntent, {
              countryCode,
              buyerCurrency: activeBuyerCurrency,
            }, inferLanguage(message))

            return NextResponse.json({
              text: fallbackText(message, result.products, {
                budgetMax: result.budgetMax,
                diagnostics: result.products.length === 0 ? diagnostics : undefined,
              }),
              ...result,
            })
          }
          products = []
          if (error.message?.includes('429')) {
            finalContent = "Tôi xin lỗi, hệ thống AI hiện đang chịu tải cao và gặp giới hạn lượt yêu cầu (Rate Limit). Bạn vui lòng thử gửi lại tin nhắn sau vài giây nhé!"
          } else {
            finalContent = "Search could not complete cleanly. Please try again in a moment."
          }
        }
      }
    }

    return NextResponse.json({
      text: finalContent || "I'm sorry, I couldn't process that request right now.",
      products,
      searchQuery: activeSearchQuery,
      budgetMax: activeBudgetMax,
      budgetCurrency: activeBudgetCurrency,
      isClothing: activeIsClothing,
      keywords: activeKeywords,
      sort: activeSort
    })
  } catch (error: any) {
    console.error('Chat API Error:', error)
    let errorMessage = 'The search request did not complete. Please try again in a moment.'
    if (error.message?.includes('429')) {
      errorMessage = "Hệ thống AI hiện đang nhận quá nhiều yêu cầu cùng lúc. Xin bạn vui lòng đợi vài giây rồi thử lại!"
    }
    return NextResponse.json({ 
      text: errorMessage,
      products: [] 
    })
  }
}
