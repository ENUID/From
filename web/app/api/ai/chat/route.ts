import { NextRequest, NextResponse } from 'next/server'
import { generateRobustAIResponse, generatePostToolReply, POST_TOOL_REPLY_TIMEOUT_MS, ChatMessage } from '@/lib/groq'

export const maxDuration = 60
import { SearchToolArgs, SearchToolSchema, SEARCH_TOOL_DEF } from '@/lib/ai/schema'
import { GlobalCatalogService, UcpProduct, type CatalogSearchDebug } from '@/lib/services/GlobalCatalogService'
import {
  UCP_REGISTRY,
  detectBrandsInQuery,
  brandDisplayName,
  buildBrandDirectory,
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
const RATE_BUCKETS_MAX = 10_000

// Drop expired buckets so the map can't grow without bound under heavy traffic
// from many distinct IPs on a warm serverless instance.
function sweepRateBuckets(now: number) {
  if (rateBuckets.size < RATE_BUCKETS_MAX) return
  rateBuckets.forEach((entry, key) => {
    if (entry.resetAt <= now) rateBuckets.delete(key)
  })
  // If everything is still live (extreme load), evict oldest to stay bounded.
  while (rateBuckets.size > RATE_BUCKETS_MAX) {
    const oldest = rateBuckets.keys().next().value
    if (oldest === undefined) break
    rateBuckets.delete(oldest)
  }
}

function getClientKey(req: NextRequest) {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown'
  return req.headers.get('x-real-ip') ?? 'unknown'
}

function isRateLimited(req: NextRequest) {
  const now = Date.now()
  sweepRateBuckets(now)
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
    : 'trust_desc'
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

  // Build mandatoryConcepts so the filter pipeline enforces gender and garment type
  const mandatoryConcepts: string[][] = []

  const wantsWomen = /\b(women|woman|womens|ladies|female|girl)\b/i.test(lowerQuery)
  const wantsMen = /\b(men|man|mens|menswear|male)\b/i.test(lowerQuery) && !wantsWomen
  if (wantsMen) mandatoryConcepts.push(['men', 'mens', 'man', 'male', 'unisex'])
  else if (wantsWomen) mandatoryConcepts.push(['women', 'womens', 'woman', 'ladies', 'female'])

  const garmentPatterns: [RegExp, string[]][] = [
    [/\b(t-?shirt|tee|tees)\b/, ['t-shirt', 'tshirt', 'tee', 'tees']],
    [/\blinen\b/, ['linen']],
    [/\bshirt\b/, ['shirt', 'shirts', 'button-up']],
    [/\b(pants|trousers|chinos)\b/, ['pants', 'trousers', 'chinos']],
    [/\bshoes?\b/, ['shoe', 'shoes', 'sneaker', 'sneakers', 'boot', 'boots']],
    [/\bjacket\b/, ['jacket', 'blazer', 'coat']],
    [/\bdress\b/, ['dress', 'dresses']],
    [/\b(sweater|jumper|knitwear)\b/, ['sweater', 'jumper', 'knitwear', 'knit']],
    [/\bshorts\b/, ['shorts']],
    [/\bskirt\b/, ['skirt', 'skirts']],
    [/\b(sock|socks)\b/, ['sock', 'socks']],
    [/\b(boot|boots)\b/, ['boot', 'boots']],
    [/\bcoat\b/, ['coat', 'overcoat', 'outerwear']],
    [/\b(bag|bags|tote|backpack)\b/, ['bag', 'bags', 'tote', 'backpack']],
  ]
  for (const [pattern, synonyms] of garmentPatterns) {
    if (pattern.test(lowerQuery)) {
      mandatoryConcepts.push(synonyms)
      break
    }
  }

  return SearchToolSchema.parse({
    searchQuery: expandDirectQuery(query),
    ...parseBudget(message, buyerCurrency),
    isClothing,
    mandatoryConcepts: mandatoryConcepts.length > 0 ? mandatoryConcepts : undefined,
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
}) {
  const budgetCurrency = (args.budgetCurrency || options.buyerCurrency).toUpperCase()
  const sort = normalizeSort(args.sort)
  const products = await GlobalCatalogService.search(
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
    options.brandDomains || []
  )

  return {
    products,
    searchQuery: args.searchQuery,
    budgetMax: args.budgetMax,
    budgetCurrency,
    isClothing: args.isClothing,
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

const SYSTEM_PROMPT = `You are "From" — an AI personal shopper for a curated roster of independent and premium boutique stores connected through the Universal Commerce Protocol (UCP). Every brand is hand-picked; you never recommend anything outside the roster.

PERSONALITY & TONE:
- Warm, perceptive, and opinionated — like a trusted boutique curator with genuinely good taste.
- Conversational and human. Never robotic, never corporate. Not "Here are the results." More like "Found a few I think you'll actually want."
- Concise. One or two sentences is almost always enough. Every word earns its place.
- Have a real point of view — gently steer toward the better choice when it's clear.
- Use the person's name occasionally if you know it. Once per conversation, at most.

HOW TO READ A REQUEST:
- Translate MOOD, OCCASION, and VIBE into specific product vocabulary before generating a search query.
  "beach wedding" → linen shirt, lightweight cream trousers, breathable dress, espadrilles
  "cozy weekend" → oversized knit sweater, soft joggers, fleece, slippers
  "smart casual office" → slim chinos, Oxford shirt, unstructured blazer, loafers
  "going out, minimal" → clean white tee, straight-leg black trousers
  "festival, bold" → printed shirt, wide-leg linen pants, bucket hat
  "first date" → elevated basics, quality denim, silk or linen top, clean leather boots
  "hot summer holiday" → linen everything, resort-wear, sandals, lightweight dresses
  "gallery opening / creative" → statement pieces, textured fabrics, artisan accessories
  "hiking / outdoor" → technical layers, durable trousers, trail shoes
  "bridal shower / garden party" → floral dresses, pastel linens, ballet flats
- Use the CATEGORY TAXONOMY and VIBE GLOSSARY to match the mood to the right brands and item types.
- If the request is genuinely ambiguous, ask ONE short clarifying question — but prefer making a confident, well-reasoned call and showing results.

OCCASION:
• beach wedding → linen shirt, lightweight cream trousers, breathable slip dress, leather sandal
• job interview / office → slim chinos, Oxford shirt, unstructured blazer, tailored trousers
• first date casual → white tee, straight-leg jeans, leather sneaker, minimal watch
• date night dressed up → silk blouse, tailored wide-leg trousers, block heel, structured bag
• festival / outdoor → printed shirt, wide-leg linen pants, bucket hat, canvas tote
• wedding guest daytime → floral midi dress, linen blazer, block-heel sandal
• wedding guest evening → satin slip dress, strappy heel, tailored blazer
• black tie / formal → tuxedo shirt, dress trousers, cocktail dress, evening gown
• garden party → broderie anglaise dress, linen co-ord, strappy sandal
• weekend brunch → oversized knit, straight-leg jeans, leather loafer
• gym to coffee → fitted joggers, zip-up hoodie, clean white sneaker
• holiday / vacation → linen shirt, swim shorts, sandals, lightweight dress
• gallery opening / creative → statement piece, textured fabric, artisan accessory, structured bag
• hiking / outdoor → technical layer, durable trouser, trail shoe, merino base layer
• bridal shower → floral dress, pastel linen, ballet flat, delicate jewellery

TOOL USAGE:
- If the user is asking ABOUT products already visible ("compare them", "which is better", "what's it made of") — answer in text. Do NOT search again.
- Call 'search_ucp' only when the user wants NEW products or a NEW filter.

searchQuery — write a rich, specific product description that captures what the user is actually looking for:
- Think semantically: translate the user's intent into the exact product vocabulary a clothing catalog uses.
- Include product type + gender + colour + material when stated. E.g. "men cream linen shirt", "women black chelsea boots leather".
- When the request is vague (occasion/mood/vibe), expand it yourself: "something relaxed for fall" → "oversized wool sweater earth tones".
- EXACT garment words matter: "t-shirt/tee" ≠ "shirt" (button-up). Use what was said; never substitute.
- Strip brand names from searchQuery — "shirts from Taylor Stitch" → searchQuery "shirts".
- Language: write in the catalog's language (English for English stores; Japanese like "シャツ" for Japanese-catalog stores). Never mix languages.
- Do NOT use OR operators or synonym padding. One clean, descriptive phrase.

━━━ CONVERSATIONAL MEMORY ━━━
• If they say "the first one", "the blue one", "that jacket" — reference products shown earlier in the chat. Product context is injected as system messages in the history.
• Remember everything stated earlier this session: budget, preferred colours, occasions, sizes, material preferences.
• Track evolving taste: prior saves and positive reactions inform "something to wear with it".
• Never ask for info they already gave earlier in this conversation.

━━━ WHEN TO SEARCH vs WHEN TO ANSWER ━━━
DO NOT search if:
• User asks about products already shown ("compare", "which is better", "tell me more about #2", "what's it made of") → answer in text only, be decisive
• User is greeting, asking for help, or asking a non-product question → reply in text, invite them to search
• Pagination ("more", "show me more") → use EXACT same query + concepts as previous search, no modifications

OUTPUT RULES:
- NEVER manually list products, prices, URLs, or product details — the UI renders cards automatically. Write only a short conversational lead-in.
- NEVER output raw JSON, structured data, code blocks, or any technical syntax in your reply. Plain prose only.
- If search returns nothing: apologise warmly and suggest a small tweak (different colour, material, or broader description).
- Always reply in the exact language the user wrote in.
- End EVERY response with exactly 2–3 natural follow-up questions in this exact format (machine-parsed, never skip it):
  [SUGGESTIONS: "Question 1", "Question 2"]
  e.g. after showing denim jackets: [SUGGESTIONS: "Do you have any under $100?", "What are these made of?", "Show me lighter washes"]`

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
    const { message, history, savedProducts, searchQuery, budgetMax, budgetCurrency, buyerCurrency, isClothing, currentExcludeIds, sort, userName, recentSearches } = await req.json()
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

    if (personalLines.length > 0) {
      dynamicSystemPrompt += `\n\nABOUT THIS SHOPPER (personalize for them — weave taste signals in subtly, let the current request lead):\n${personalLines.join('\n')}`;
    }

    dynamicSystemPrompt += `\n\nCATEGORY TAXONOMY — map the user's request to specific item types and a clean searchQuery:\n${buildCategoryTaxonomy()}`;

    dynamicSystemPrompt += `\n\nVIBE GLOSSARY — what each brand's style tag signals (use it to match mood/occasion to brands):\n${buildVibeGlossary()}`;

    dynamicSystemPrompt += `\n\nCRITICAL STORE LIMITATION: You MUST only recommend or mention products from this curated brand roster. Each entry lists what the brand sells, its style tags, and its catalog language — use this to pick the brands that best fit the request:\n${buildBrandDirectory()}\nThe 'search_ucp' tool strictly filters to these brands only. Never recommend or discuss products from any store outside this roster.`;

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
          } else {
            const POST_TOOL_PROMPT = `You are "From" — a high-end AI personal shopper.
The system has already searched and the product cards are displayed to the user.
Write one short, warm, conversational sentence about what you found — like a stylist handing over a selection, not a search engine reporting results.
Do NOT list products, prices, or details. Do NOT use any tools. Do NOT output JSON, code, or structured data of any kind.
End with exactly 2–3 natural follow-up questions in this exact format:
[SUGGESTIONS: "Question 1", "Question 2"]
Mirror the language the user wrote in.`

            const postSearchText = await generatePostToolReply(
              messages,
              POST_TOOL_PROMPT,
              aiResponse,
              formatSearchToolResult(products),
              POST_TOOL_REPLY_TIMEOUT_MS,
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
        .replace(/\[COMPARE:\s*\{[\s\S]*?\}\s*\]/gi, '')
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
