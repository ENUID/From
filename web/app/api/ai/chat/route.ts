import { NextRequest, NextResponse } from 'next/server'
import { generateRobustAIResponse, generatePostToolReply, ChatMessage } from '@/lib/groq'
import { matchStyles, vocabPromptBlock } from '@/lib/styleVocabulary'
import { compileIntent, compiledReplyText, compiledSuggestions } from '@/lib/intentCompiler'

export const maxDuration = 60
import { SearchToolArgs, SearchToolSchema, SEARCH_TOOL_DEF } from '@/lib/ai/schema'
import { GlobalCatalogService, UcpProduct, type CatalogSearchDebug } from '@/lib/services/GlobalCatalogService'
import {
  UCP_REGISTRY,
  detectBrandsInQuery,
  brandDisplayName,
  buildCompactBrandDirectory,
  buildCategoryTaxonomy,
  buildVibeGlossary,
} from '@/lib/stores'


const CHAT_WINDOW_MS = 60_000
const CHAT_MAX_REQUESTS = 20
const MESSAGE_MAX_CHARS = 500
const HISTORY_MAX_TURNS = 4
const SORT_VALUES = new Set(['price_asc', 'price_desc', 'relevance', 'trust_desc'])
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
    ? value as 'price_asc' | 'price_desc' | 'relevance' | 'trust_desc'
    : 'relevance'
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
  return query.trim().replace(/\s+/g, ' ');
}

function parseDirectSearchIntent(message: string, buyerCurrency: string): SearchToolArgs | null {
  const query = stripBudgetText(message)
  if (!query || query.length < 2) return null

  const lowerQuery = query.toLowerCase()
  if (/\b(compare|which|what|how|why|can you|tell me|hi|hello|thanks|thank you)\b/i.test(lowerQuery)) return null

  const isClothing = CLOTHING_TERMS.some(term => lowerQuery.includes(term))
  const sort = /\b(expensive|highest|premium|luxury)\b/i.test(message) ? 'price_desc' : 'price_asc'

  return SearchToolSchema.parse({
    searchQuery: expandDirectQuery(query),
    ...parseBudget(message, buyerCurrency),
    isClothing,
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
  /** Pre-detected brand domains from the user message — skip re-detection inside the service. */
  brandDomains?: string[];
  tasteProfile?: string;
  /** The user's original message — lets relevance reranking judge against their
   *  real words (occasion, aesthetic, vibe) even when searchQuery is stripped clean. */
  rerankQuery?: string;
}) {
  const budgetCurrency = (args.budgetCurrency || options.buyerCurrency).toUpperCase()
  const sort = normalizeSort(args.sort)
  const brandDomains = options.brandDomains || []
  let products = await GlobalCatalogService.search(
    args.searchQuery,
    args.budgetMax,
    options.excludeIds || [],
    options.countryCode,
    args.isClothing,
    args.mandatoryConcepts || [],
    sort,
    budgetCurrency,
    {
      refreshReserve: options.refreshReserve,
      fastFirstPage: options.fastFirstPage,
      loadMore: options.loadMore,
      debug: options.debug,
    },
    brandDomains,
    options.tasteProfile,
    options.rerankQuery,
  )

  // Brand fallback: the shopper named a brand, but it returned nothing — its
  // catalog isn't reachable (no UCP) or has no match. Retry across the whole
  // roster with the brand stripped from the query, and flag it so the reply
  // can say so and offer similar pieces instead of silently coming up empty.
  let brandFallback: string[] | undefined
  if (brandDomains.length > 0 && products.length === 0 && !options.loadMore) {
    const debranded = stripBrandNames(args.searchQuery, brandDomains)
    const retryQuery = debranded || args.searchQuery
    const retry = await GlobalCatalogService.search(
      retryQuery, args.budgetMax, options.excludeIds || [], options.countryCode,
      args.isClothing, args.mandatoryConcepts || [], sort, budgetCurrency,
      { fastFirstPage: true }, [], options.tasteProfile, options.rerankQuery,
    )
    products = retry
    brandFallback = brandDomains.map(brandDisplayNameByDomain)
  }

  return {
    products,
    searchQuery: args.searchQuery,
    budgetMax: args.budgetMax,
    budgetCurrency,
    isClothing: args.isClothing,
    sort,
    brandFallback,
  }
}

// Resolve a registry domain to its human brand name for messaging.
function brandDisplayNameByDomain(domain: string): string {
  const p = UCP_REGISTRY.find(s => s.domain.toLowerCase().trim() === domain.toLowerCase().trim())
  return p ? brandDisplayName(p) : domain
}

// Strip named-brand tokens from a query so a fallback search spans the roster
// instead of re-detecting the same unavailable brand.
function stripBrandNames(query: string, domains: string[]): string {
  let q = query
  for (const d of domains) {
    const name = brandDisplayNameByDomain(d)
    if (name && name.length >= 3) {
      const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      q = q
        .replace(new RegExp(`\\b(?:from|at|by|in)\\s+${esc}\\b`, 'gi'), ' ')
        .replace(new RegExp(`\\b${esc}\\b`, 'gi'), ' ')
    }
  }
  return q.replace(/\s+/g, ' ').trim()
}

// Warm, on-brand line for when a requested brand has nothing to show.
function brandUnavailableText(brands: string[], language: 'vi' | 'en', hasResults: boolean): string {
  const name = brands.filter(Boolean).join(' & ') || 'that brand'
  if (language === 'vi') {
    return hasResults
      ? `Mình chưa lấy được sản phẩm từ ${name} lúc này — nhưng đây là vài lựa chọn tương tự rất hợp với điều bạn đang tìm.`
      : `Mình chưa có ${name} trong danh sách brand lúc này. Bạn thử mô tả kiểu dáng/chất liệu để mình tìm lựa chọn tương tự nhé.`
  }
  return hasResults
    ? `I couldn't pull anything from ${name} just now — but here are some similar pieces that fit what you're after.`
    : `I don't have ${name} in the roster just yet. Tell me the style or material you liked and I'll find you a close match.`
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
  let searchDiagnostics = args.searchQuery
    ? (language === 'vi'
      ? `tìm kiếm: "${args.searchQuery}"`
      : `search: "${args.searchQuery}"`)
    : 'browsing products';

  if (args.mandatoryConcepts?.length) {
    const concepts = args.mandatoryConcepts.map(c => `[${c.join(' | ')}]`).join(' AND ');
    searchDiagnostics += language === 'vi'
      ? `, lọc: ${concepts}`
      : `, filter: ${concepts}`;
  }

  if (args.budgetMax) {
    const currency = (args.budgetCurrency || ctx.buyerCurrency).toUpperCase()
    searchDiagnostics += language === 'vi'
      ? `, tối đa ${args.budgetMax} ${currency}`
      : `, max ${args.budgetMax} ${currency}`;
  }

  if (args.sort) {
    searchDiagnostics += language === 'vi'
      ? `, sắp xếp: ${args.sort}`
      : `, sort: ${args.sort}`;
  }

  if (ctx.countryCode) {
    searchDiagnostics += language === 'vi'
      ? `, giao hàng: ${ctx.countryCode}`
      : `, ships to: ${ctx.countryCode}`;
  }

  return searchDiagnostics
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
      const nextMsg = recent[i + 1];
      const nextUserText = nextMsg && nextMsg.role === 'user'
        ? String(nextMsg.content ?? nextMsg.text ?? '').toLowerCase()
        : '';

      const combinedUserText = `${nextUserText} ${currentMsgLower}`;

      const productsToInclude: any[] = [];
      item.products.forEach((p: any, idx: number) => {
        const productIndex = idx + 1;
        const vendorLower = (p.vendor || '').toLowerCase();

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

        if (idx < 6 || isIndexReferenced || isBrandReferenced) {
          productsToInclude.push(p);
        }
      });

      const productSummary = productsToInclude.map((p: any) => {
        let text = `- [ID: ${p.id}] ${p.title} by ${p.vendor} (${p.price} ${p.currency || p.base_currency})`;
        if (p.description) text += `\n  Description: ${p.description.substring(0, 300).replace(/\n/g, ' ')}...`;
        if (p.tags && p.tags.length > 0) text += `\n  Tags: ${p.tags.join(', ')}`;
        if (p.options && p.options.length > 0) {
          const opts = p.options.map((o: any) => `${o.name}: ${o.values.join('/')}`).join(', ');
          text += `\n  Options: ${opts}`;
        }
        return text;
      }).join('\n\n');
      
      clean.push({
        role: 'system',
        content: `The UI rendered these products below the assistant's message:\n${productSummary}`
      });
    }
  }
  return clean;
}

const SYSTEM_PROMPT = `You are "From" — the personal shopper inside the FROM app. FROM exists to end the hunt: the best-dressed people don't shop the mainstream, they search independent and emerging brands the algorithms haven't found yet. You are that search, made human. You discover beautiful, well-made pieces from a hand-picked roster of independent and premium boutiques, connected through the Universal Commerce Protocol (UCP). Every brand is vetted; you never recommend anything outside it.

WHO YOU ARE:
- You have the eye of a boutique buyer and the warmth of a friend with impeccable taste — someone who clocks a person's style in two messages and never forgets it.
- You have a point of view. A shopper with no opinion is a search box; you are a curator. When one piece is the smarter buy, say so and say why in a handful of words.
- You read between the lines. People rarely ask for what they actually want — they ask for the occasion, the mood, the feeling. Hear the real request underneath.
- You celebrate craft: a true linen, a clean seam, a considered silhouette, a brand doing things the slow honest way. That enthusiasm is genuine, never salesy.

VOICE:
- Conversational, elegant, economical. One or two sentences almost always. Never "Here are the results" — say something with a little soul: "Pulled a few that feel right for this." Every word earns its place.
- Decisive over hedging. "The linen camp-collar is the move — breathable and quietly sharp." Not "you might consider possibly looking at…".
- Use the person's name occasionally and naturally when you know it — never in every line.
- Never corporate, never robotic, never a list of caveats. A reply should feel hand-typed by someone who cares how they look.

HOW YOU READ A REQUEST (taste intelligence):
- Translate occasion, mood, fit, material, colour and vibe into the right pieces. "Beach wedding" → linen shirts, lightweight trousers, breathable dresses. "Cozy night in" → knits, loungewear, fleece. "Look expensive without trying" → quiet-luxury signals: fine materials, no logos, neutral palette, clean lines.
- Use the CATEGORY TAXONOMY to map vague asks to specific item types, and the VIBE GLOSSARY + each brand's style tags to choose which brands fit the mood. "Minimalist organic basics" → brands tagged organic/seamless; "bold streetwear" → brands tagged streetwear.
- Respect their taste profile and saves when present — bias toward their materials, palette, budget and brands without ever caging them in. People dress for who they want to be; meet them there.
- When a person names a brand, search only that brand (the system enforces this). When they describe a vibe or occasion, lean on the best-matching brands for it.
- Prefer a confident, well-reasoned pick over a clarifying question. Ask ONE sharp question only when the answer genuinely changes the result ("Corporate dinner or creative one? Different outfits entirely.") — and if you ask, ask instead of searching, not alongside it.

TOOL USAGE:
- Assess intent first. If the user is asking ABOUT products already on screen ("compare them", "which is better", "what's the first one made of"), DO NOT search — just answer in text using the product context provided.
- Use the 'search_ucp' tool ONLY when they want NEW products or a NEW filter ("find linen shirts", "show cheaper ones", "I meant in black").
- searchQuery: keep it simple, specific and focused — the product type plus key descriptors (e.g. "linen shirt", "black chelsea boots"). Do NOT use the 'OR' operator and do NOT pad it with synonyms.
  * Strip brand names from searchQuery — "shirts from Taylor Stitch" → searchQuery "shirts". The brand is targeted separately.
  * Query language: write searchQuery in the targeted store's catalog language (English for English stores; Japanese for a Japanese-catalog store like coverchord.com, e.g. "シャツ"). Never put Vietnamese words in searchQuery. Never mix languages in one query.
- mandatoryConcepts: ALWAYS set this — extract the critical concepts (product type, specific material, country of origin) as groups of synonyms. The system uses these to hard-rank results and reject off-category products.
  * ALWAYS include the primary product type as the first concept group, even for simple requests. E.g. "show me shoes" → [["shoe","shoes","sneaker","sneakers","footwear","boot","boots"]]. "shirts" → [["shirt","shirts","tee","tees","top","tops"]]. Never leave mandatoryConcepts empty for a product search.
  * E.g. "sustainable leather bags from vietnam" → [["bag","bags","backpack","tote","túi"], ["leather","da","cuero"], ["vietnam","việt nam","vietnamese"]]
  * On a brand-new request for a different item, DROP the old concepts — only carry the concepts explicitly asked for now.
- Pagination: if the user asks for "more", call 'search_ucp' with the EXACT SAME query as before — no "more"/"other" added. Pagination is automatic.

OUTPUT RULES:
- Never manually list products, bullet points, prices or URLs — the UI renders product cards automatically below your message. Just give a short, elegant, conversational lead-in or piece of advice.
- Honesty: never invent products or details. If the search returns nothing, apologise warmly and suggest a tweak (broader description, different colour/material, or another brand).
- Always reply in the exact same language the user wrote in.
- At the very end of EVERY response, output exactly 2 or 3 natural follow-up questions the user might ask next, in this exact format:
  [SUGGESTIONS: "Question 1", "Question 2"]
  e.g. after showing denim jackets: [SUGGESTIONS: "Do you have any under $100?", "What are the first two made of?", "Show me lighter washes"]`

function extractSuggestions(text: string): { cleanText: string, suggestions: string[] } {
  const match = text.match(/\[SUGGESTIONS:\s*(.*?)\]/i)
  if (!match) return { cleanText: text, suggestions: [] }
  
  const suggestionsText = match[1]
  const cleanText = text.replace(match[0], '').trim()
  
  try {
    const parsed = JSON.parse(`[${suggestionsText}]`)
    return { cleanText, suggestions: Array.isArray(parsed) ? parsed : [] }
  } catch {
    const split = suggestionsText.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(s => s.replace(/^["'\s]+|["'\s]+$/g, '').trim()).filter(Boolean)
    return { cleanText, suggestions: split }
  }
}

export async function POST(req: NextRequest) {
  try {
    const { message, history, savedProducts, searchQuery, budgetMax, budgetCurrency, buyerCurrency, isClothing, currentExcludeIds, sort, userName, recentSearches, tasteProfile, shopperGender } = await req.json()
    // 'Men' → 'men', 'Women' → 'women', 'Both'/'Non-binary'/unset → null (no prefix)
    const genderPrefix = shopperGender === 'Men' ? 'men' : shopperGender === 'Women' ? 'women' : null
    // Regex to detect if a query already specifies a gender (user's explicit override)
    const GENDER_TERM_RE = /\b(men|women|man|woman|male|female|ladies|guys?|boys?|girls?|unisex|gender.neutral)\b/i
    const applyGenderPrefix = (q: string): string => {
      if (!genderPrefix) return q
      if (GENDER_TERM_RE.test(q) || GENDER_TERM_RE.test(message)) return q
      return `${genderPrefix} ${q}`
    }
    if (!message) throw new Error('No message provided')
    const countryCode = req.headers.get('x-vercel-ip-country') || req.headers.get('cf-ipcountry') || null;
    const activeBuyerCurrency = typeof buyerCurrency === 'string' ? buyerCurrency.toUpperCase() : 'USD'

    if (message === 'more' && searchQuery) {
      const excludeIds = collectProductIds(history || [], currentExcludeIds)
      const moreArgs = SearchToolSchema.parse({
        searchQuery,
        budgetMax,
        budgetCurrency: typeof budgetCurrency === 'string' ? budgetCurrency : activeBuyerCurrency,
        isClothing,
        mandatoryConcepts: [],
        sort: normalizeSort(sort),
      })
      const moreOptions = {
        countryCode,
        buyerCurrency: activeBuyerCurrency,
        excludeIds,
        brandDomains: detectBrandsInQuery(searchQuery),
      }

      const catalogDebug: CatalogSearchDebug = {}
      const result = await runCatalogSearch(moreArgs, {
        ...moreOptions,
        loadMore: true,
        refreshReserve: true,
        debug: catalogDebug,
      })

      return NextResponse.json({
        text: "Here are some more options for you:",
        ...result,
        meta: catalogDebug,
      });
    }

    if (isRateLimited(req)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const cleanHistory = sanitizeHistory(history || [], message)
    const messages: ChatMessage[] = [...cleanHistory, { role: 'user', content: message }]

    // Detect explicit brand mentions in the user message so the catalog search
    // can restrict to just those store(s) rather than scanning the whole registry.
    const detectedBrandDomains = detectBrandsInQuery(message)

    // Fast path: deterministic compiler for clear product queries.
    // Skips the LLM entirely — instant response with no model latency.
    const compiled = compileIntent(message, activeBuyerCurrency)
    if (compiled && !/\b(more|others?|another|different ones?)\b/i.test(message)) {
      compiled.args.searchQuery = applyGenderPrefix(compiled.args.searchQuery)
      const compiledResult = await runCatalogSearch(compiled.args, {
        countryCode,
        buyerCurrency: activeBuyerCurrency,
        excludeIds: collectProductIds(history || []),
        fastFirstPage: true,
        brandDomains: detectedBrandDomains,
        tasteProfile: typeof tasteProfile === 'string' ? tasteProfile : undefined,
        rerankQuery: message,
      })
      const compiledText = compiledResult.brandFallback
        ? brandUnavailableText(compiledResult.brandFallback, inferLanguage(message), compiledResult.products.length > 0)
        : compiledReplyText(compiled, compiledResult.products.length)
      return NextResponse.json({
        text: compiledText,
        ...compiledResult,
        suggestions: compiledSuggestions(compiled),
        meta: { compiledIntent: true, brandFallback: compiledResult.brandFallback ?? null },
      })
    }

    let dynamicSystemPrompt = SYSTEM_PROMPT;

    // ── Personalization: name, location, taste signals from saves & recent searches ──
    const personalLines: string[] = [];
    const cleanName = typeof userName === 'string' ? userName.trim().slice(0, 40) : '';
    if (cleanName) {
      personalLines.push(`- Name: ${cleanName} (use it naturally and occasionally, never in every line).`);
    }
    if (countryCode) {
      personalLines.push(`- Shopping from: ${countryCode} (currency ${activeBuyerCurrency}). Favor brands that ship there and feel relevant to the region.`);
    }

    if (Array.isArray(recentSearches) && recentSearches.length > 0) {
      const recents = recentSearches
        .filter((q: unknown): q is string => typeof q === 'string' && q.trim().length > 0)
        .slice(0, 8)
        .map((q: string) => `"${q.trim().slice(0, 60)}"`);
      if (recents.length > 0) {
        personalLines.push(`- Recent searches (most recent first): ${recents.join(', ')}. Infer their evolving taste, but follow the CURRENT request first.`);
      }
    }

    if (savedProducts && savedProducts.length > 0) {
      const savedSummary = savedProducts
        .slice(0, 12)
        .map((p: any) => `${p.title}${p.vendor ? ` by ${p.vendor}` : ''} (${p.price} ${p.currency})`)
        .join('; ');
      const savedBrands = Array.from(new Set(
        savedProducts.map((p: any) => (p.vendor || '').toString().trim()).filter(Boolean)
      )).slice(0, 8);
      personalLines.push(`- Saved / favorited: ${savedSummary}. These reveal the styles, price range and brands they're drawn to.`);
      if (savedBrands.length > 0) {
        personalLines.push(`- Brands they've already saved from: ${savedBrands.join(', ')}.`);
      }
    }

    if (typeof tasteProfile === 'string' && tasteProfile.trim()) {
      personalLines.push(`- Taste profile: ${tasteProfile.trim()}. Use this to bias search results and recommendations toward their preferred styles, sizes, and budget.`)
    }
    if (genderPrefix) {
      personalLines.push(`- GENDER DEFAULT: This shopper's profile says they shop for ${genderPrefix}'s clothing. ALWAYS include "${genderPrefix}" in the searchQuery (e.g. "${genderPrefix} linen shirt") UNLESS their current message explicitly specifies a different gender or says "unisex".`)
    }

    if (personalLines.length > 0) {
      dynamicSystemPrompt += `\n\nABOUT THIS SHOPPER (personalize for them — weave taste signals in subtly, let the current request lead):\n${personalLines.join('\n')}`;
    }

    const matchedStyles = matchStyles(message)
    const styleVocab = vocabPromptBlock(matchedStyles)
    if (styleVocab) {
      dynamicSystemPrompt += `\n\n${styleVocab}`
    }

    dynamicSystemPrompt += `\n\nCATEGORY TAXONOMY — map the user's request to specific item types and a clean searchQuery:\n${buildCategoryTaxonomy()}`;

    dynamicSystemPrompt += `\n\nVIBE GLOSSARY — what each brand's style tag signals (use it to match mood/occasion to brands):\n${buildVibeGlossary()}`;

    dynamicSystemPrompt += `\n\nCRITICAL STORE LIMITATION: You MUST only recommend or mention products from this curated brand roster. Each entry lists what the brand sells, its style tags, and its catalog language — use this to pick the brands that best fit the request:\n${buildCompactBrandDirectory()}\nThe 'search_ucp' tool strictly filters to these brands only. Never recommend or discuss products from any store outside this roster.`;

    if (detectedBrandDomains.length > 0) {
      const brandNames = detectedBrandDomains.map(d => {
        const p = UCP_REGISTRY.find(s => s.domain.toLowerCase().trim() === d);
        return p ? brandDisplayName(p) : d;
      }).join(', ');
      dynamicSystemPrompt += `\n\nBRAND SEARCH: The user is explicitly asking about ${brandNames}. Search ONLY within those brand(s). IMPORTANT: When generating the searchQuery parameter, strip the brand name from it — e.g. "shirts from Taylor Stitch" → searchQuery: "shirts". The searchQuery must describe only the product type, material, or style, never the brand name itself.`;
    }


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
        brandDomains: detectedBrandDomains,
        tasteProfile: typeof tasteProfile === 'string' ? tasteProfile : undefined,
        rerankQuery: message,
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
    let activeSort: 'price_asc' | 'price_desc' | 'relevance' | 'trust_desc' | undefined = undefined

    if (aiResponse.tool_calls && aiResponse.tool_calls.length > 0) {
      const toolCall = aiResponse.tool_calls[0]
      if (toolCall.function.name === 'search_ucp') {
        try {
          const args = parseSearchToolArguments(toolCall.function.arguments)
          args.searchQuery = applyGenderPrefix(args.searchQuery)
          activeSearchQuery = args.searchQuery
          activeBudgetMax = args.budgetMax
          activeBudgetCurrency = (args.budgetCurrency || activeBuyerCurrency).toUpperCase()
          activeIsClothing = args.isClothing
          activeSort = normalizeSort(args.sort)
          
          const searchDiagnostics = formatSearchDiagnostics(args, {
            countryCode,
            buyerCurrency: activeBuyerCurrency,
          }, inferLanguage(message))

          const result = await runCatalogSearch(args, {
            countryCode,
            buyerCurrency: activeBuyerCurrency,
            excludeIds: collectProductIds(history || []),
            fastFirstPage: true,
            brandDomains: detectedBrandDomains,
            tasteProfile: typeof tasteProfile === 'string' ? tasteProfile : undefined,
            rerankQuery: message,
          })
          products = result.products
          activeBudgetCurrency = result.budgetCurrency
          activeSort = result.sort

          // The requested brand had nothing — lead with a warm note, then let
          // the similar pieces (already in `products`) speak. Skip the LLM
          // summary so the message stays honest about what happened.
          if (result.brandFallback) {
            finalContent = brandUnavailableText(result.brandFallback, inferLanguage(message), products.length > 0)
            const extractedFb = extractSuggestions(aiResponse.content || '')
            return NextResponse.json({
              text: finalContent,
              products,
              searchQuery: activeSearchQuery,
              budgetMax: activeBudgetMax,
              budgetCurrency: activeBudgetCurrency,
              isClothing: activeIsClothing,
              sort: activeSort,
              suggestions: extractedFb.suggestions,
              meta: { brandFallback: result.brandFallback },
            })
          }

          const aiText = aiResponse.content?.trim()
          if (aiText) {
            finalContent = aiText
            if (products.length === 0) {
              finalContent += inferLanguage(message) === 'vi'
                ? `\n\nĐã tìm trên Shopify catalog: ${searchDiagnostics}`
                : `\n\nSearched Shopify catalog: ${searchDiagnostics}`
            }
          } else {
            const POST_TOOL_PROMPT = `You are "From", a high-end personal shopper. The pieces have ALREADY been found and are rendering as cards below your message.
Write a short, warm, editorial lead-in — one or two sentences that frame what you pulled and why it fits the request, the way a great buyer hands you something off the rail. Reference the material, vibe, or occasion when it adds something; never list products, prices, or URLs (the cards do that).
Have a little point of view — if there's a standout or a smart-buy angle, hint at it in a few words.
DO NOT use any tools. DO NOT output JSON. DO NOT search again.
At the very end, output exactly 2 or 3 natural follow-up questions the shopper might ask next, in this exact format:
[SUGGESTIONS: "Question 1", "Question 2"]
Reply in the exact language the user wrote in.`

            const postSearchText = await generatePostToolReply(
              messages,
              POST_TOOL_PROMPT,
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
              brandDomains: detectedBrandDomains,
              tasteProfile: typeof tasteProfile === 'string' ? tasteProfile : undefined,
              rerankQuery: message,
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

    if (finalContent) {
      finalContent = finalContent
        .replace(/\[search_ucp:\s*[^\]]+\]/gi, '')
        .replace(/\[UI.*?\]/gi, '')
        .trim()
    }

    const extracted = extractSuggestions(finalContent || "I'm sorry, I couldn't process that request right now.")

    return NextResponse.json({
      text: extracted.cleanText,
      products,
      searchQuery: activeSearchQuery,
      budgetMax: activeBudgetMax,
      budgetCurrency: activeBudgetCurrency,
      isClothing: activeIsClothing,
      sort: activeSort,
      suggestions: extracted.suggestions
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
