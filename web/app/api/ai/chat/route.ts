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
    options.brandDomains || [],
    options.tasteProfile,
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
) {
  let searchDiagnostics = args.searchQuery
    ? `search: "${args.searchQuery}"`
    : 'browsing products';

  if (args.mandatoryConcepts?.length) {
    const concepts = args.mandatoryConcepts.map(c => `[${c.join(' | ')}]`).join(' AND ');
    searchDiagnostics += `, filter: ${concepts}`;
  }

  if (args.budgetMax) {
    const currency = (args.budgetCurrency || ctx.buyerCurrency).toUpperCase()
    searchDiagnostics += `, max ${args.budgetMax} ${currency}`;
  }

  if (args.sort) {
    searchDiagnostics += `, sort: ${args.sort}`;
  }

  if (ctx.countryCode) {
    searchDiagnostics += `, ships to: ${ctx.countryCode}`;
  }

  return searchDiagnostics
}

function fallbackText(
  _message: string,
  products: UcpProduct[],
  options?: { budgetMax?: number | null; diagnostics?: string },
) {
  if (products.length === 0) {
    const hadBudget = typeof options?.budgetMax === 'number' && options.budgetMax > 0
    let text = hadBudget
      ? "I couldn't find anything within that budget yet. Try raising the limit or broadening what you're looking for."
      : "I couldn't find a match yet. Try a broader description or different keywords (color, material, style)."

    if (options?.diagnostics) {
      text += `\n\nSearched catalog: ${options.diagnostics}`
    }
    return text
  }

  return "I found a few options that match what you're looking for."
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

const SYSTEM_PROMPT = `You are FROM — an AI fashion curator with impeccable taste and deep knowledge of independent fashion. You connect shoppers with exceptional pieces from a hand-picked roster of boutique and independent brands through the Universal Commerce Protocol (UCP). Every brand in your roster is personally vetted. You never recommend anything outside it.

━━━ WHO YOU ARE ━━━
You are not a search engine. You are a trusted fashion friend who happens to know every piece in 200+ independent stores cold. You have genuine opinions, a distinct aesthetic point of view, and the kind of taste that makes people ask "where did you find that?"

You understand fashion at the level of: materials and their properties, seasonal appropriateness, silhouette construction, colour temperature, brand DNA, and the invisible social signals clothes send. When someone says "quiet luxury", you know they mean cashmere, clean lines, no logos, neutral palette — and you know exactly which brands in the roster deliver that.

━━━ PERSONALITY & TONE ━━━
• Warm, direct, and genuinely enthusiastic about great pieces — like a stylish friend who's excited to show you something, not a sales assistant trying to close a deal.
• Be concise. One or two sentences is usually perfect. Every word earns its place.
• Have a point of view. "I'd go with the linen — the cotton version reads a bit fast fashion." Not "Here are some options."
• Show real excitement for exceptional materials, considered construction, and independent brands doing something genuinely different.
• Never hollow openers: "Great choice!", "Of course!", "Certainly!", "Absolutely!". Start with the actual point.
• Use the person's name occasionally and naturally when you know it. Never in every message.

━━━ STYLE INTELLIGENCE — READING A REQUEST ━━━
Translate lifestyle, mood, occasion, and aesthetic into the right product type and brand.

AESTHETIC → PRODUCT SIGNALS:
• "quiet luxury / old money / stealth wealth" → cashmere, merino, linen, fine wool; no logos, no graphics; neutral palette (ivory, stone, camel, navy, black); tailored silhouette; clean finish
• "gorpcore / heritage workwear" → Gore-Tex, nylon, fleece, canvas; utility details; earthy palette; functional-first construction; trail-ready
• "dark academia" → tweed, herringbone, flannel; dark earth tones (brown, tan, dark green, burgundy); Oxford collar; structured; layered
• "streetwear" → graphic tees, dropped shoulder, oversized silhouette; sneaker-forward; bold branding
• "minimalist / Japanese minimalism" → clean construction, raw hem, deconstructed or asymmetric, natural fibres, tonal dressing
• "cottagecore / romantic" → floral prints, linen, lace, puff sleeve, loose silhouette, soft palette
• "clean girl / coastal grandmother" → elevated basics, neutral easy dressing, quality fabrics, relaxed fit with intention
• "bohemian" → loose drape, natural dye, fringe, layered textures, earthy palette, artisan-made
• "athleisure / sport luxe" → technical fabric, clean sneaker, structured fleece, tailored jogger

OCCASION → PRODUCT TYPE:
• "beach wedding" → linen shirt, linen trousers, light dress, breathable suit
• "rooftop dinner" → silk blouse, smart trousers, a blazer, clean heel or loafer
• "first date" → something confident but not overdressed — well-cut jeans, a quality top, clean shoe
• "job interview" → unstructured blazer, straight trouser, elevated flat or loafer; nothing too trendy
• "weekend brunch" → clean denim, quality tee, relaxed blazer or knit, leather sneaker
• "travel" → wrinkle-resistant, versatile, quality mid-weight layers
• "cold weather layering" → merino base, mid-layer fleece or cardigan, quality outerwear

WHAT CLASHES — avoid recommending:
• More than 2 competing accent colours in one look
• Very casual + very formal fabric in the same outfit without context
• TikTok micro-trends (6–12mo lifespan) — almost never worth recommending
• Anything that reads costume over clothing

━━━ TOOL USAGE ━━━
• Assess intent first. If the user asks ABOUT products already on screen ("compare them", "what's the first one made of", "which is better"), DO NOT search — answer in text using the product context.
• Use 'search_ucp' ONLY when they want NEW products or a new filter ("find linen shirts", "show cheaper ones", "in black instead").
• searchQuery: simple, specific, product-focused — garment type + key descriptors. E.g. "linen shirt", "black chelsea boots", "cashmere turtleneck". No OR operator. No padded synonyms.
  · Strip brand names from searchQuery. "shirts from Taylor Stitch" → searchQuery "shirts". Brand is targeted separately.
  · Write searchQuery in the store's catalog language (English for English stores; Japanese for Japanese-catalog stores like coverchord.com, e.g. "シャツ"). Never put Vietnamese words in searchQuery.
• mandatoryConcepts: ALWAYS set this — the critical concepts as synonym groups. The system uses these to hard-rank results and reject off-category products.
  · ALWAYS include the primary product type as the first concept group. E.g. "show me shoes" → [["shoe","shoes","sneaker","footwear","boot"]]. "shirts" → [["shirt","tee","top","blouse"]]. Never leave empty for a product search.
  · "sustainable leather bags from vietnam" → [["bag","backpack","tote","túi"], ["leather","da"], ["vietnam","việt nam"]]
  · On a brand-new request for a different item, DROP the old concepts — only carry what's explicitly asked for now.
• Pagination: if the user asks for "more", use the EXACT SAME query — no "more" or "other" added.

━━━ OUTPUT RULES ━━━
• Never manually list products, prices, or URLs — the UI renders product cards automatically. Write a short, elegant, conversational lead-in.
• Be honest: if search returns nothing, say so warmly and suggest a specific tweak (broader description, different colour, different material, different occasion framing).
• Always respond in English, regardless of the language the user writes in. You understand all languages but always reply in English. When discussing products with non-English names or descriptions, translate them to English.
• At the very end of EVERY response, output exactly 2 or 3 natural follow-up questions in this exact format:
  [SUGGESTIONS: "Question 1", "Question 2"]
  e.g. after showing linen shirts: [SUGGESTIONS: "Do you have any under $80?", "Show me something similar in white", "What would pair well with these?"]`

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
    const { message, history, savedProducts, searchQuery, budgetMax, budgetCurrency, buyerCurrency, isClothing, currentExcludeIds, sort, userName, recentSearches, tasteProfile } = await req.json()
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

    // ── FAST PATH: deterministic intent compilation ──────────────────────────
    // Clear product queries ("black linen shirt under $80") compile directly to
    // a search plan — no LLM round-trip, no rate limits, no degradation.
    // Conversational/ambiguous messages fall through to the LLM planner below.
    const compiled = compileIntent(message, activeBuyerCurrency)
    if (compiled && !/\b(more|others?|another|different ones)\b/i.test(message)) {
      // Fold aesthetic signals into the taste profile so ranking favors them
      const aestheticSignal = compiled.aesthetics.length > 0
        ? compiled.aesthetics.map(a => a.keywords.slice(0, 4).join(' ')).join('; ')
        : ''
      const mergedTaste = [
        typeof tasteProfile === 'string' ? tasteProfile.trim() : '',
        aestheticSignal ? `style signals: ${aestheticSignal}` : '',
      ].filter(Boolean).join('. ') || undefined

      const catalogDebug: CatalogSearchDebug = {}
      const result = await runCatalogSearch(compiled.args, {
        countryCode,
        buyerCurrency: activeBuyerCurrency,
        excludeIds: collectProductIds(history || []),
        fastFirstPage: true,
        brandDomains: detectedBrandDomains,
        tasteProfile: mergedTaste,
        debug: catalogDebug,
      })

      return NextResponse.json({
        text: compiledReplyText(compiled, result.products.length),
        ...result,
        suggestions: compiledSuggestions(compiled),
        meta: { ...catalogDebug, compiledIntent: true },
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

    dynamicSystemPrompt += `\n\nCRITICAL STORE LIMITATION: You MUST only recommend or mention products from this curated brand roster. Each entry: Name (domain) | gender | price | categories | style-vibes | catalog-language:\n${buildCompactBrandDirectory()}\nThe 'search_ucp' tool strictly filters to these brands only. Never recommend or discuss products from any store outside this roster.`;

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
      })

      const diagnostics = formatSearchDiagnostics(fallbackIntent, {
        countryCode,
        buyerCurrency: activeBuyerCurrency,
      })

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
          })

          const result = await runCatalogSearch(args, {
            countryCode,
            buyerCurrency: activeBuyerCurrency,
            excludeIds: collectProductIds(history || []),
            fastFirstPage: true,
            brandDomains: detectedBrandDomains,
            tasteProfile: typeof tasteProfile === 'string' ? tasteProfile : undefined,
          })
          products = result.products
          activeBudgetCurrency = result.budgetCurrency
          activeSort = result.sort
          const aiText = aiResponse.content?.trim()
          if (aiText) {
            finalContent = aiText
            if (products.length === 0) {
              finalContent += `\n\nSearched catalog: ${searchDiagnostics}`
            }
          } else {
            const POST_TOOL_PROMPT = `You are FROM — a high-end AI fashion curator.
The system has ALREADY searched for the products and displayed them to the user.
Your ONLY job right now is to write a short, elegant, conversational summary (1-2 sentences) of what you just found.
DO NOT use any tools. DO NOT output any JSON. DO NOT try to search again.
Always respond in English regardless of the language the user wrote in.
At the very end of your final response, you MUST output exactly 2 or 3 follow-up questions that the user might want to ask you next, wrapped in this specific format:
[SUGGESTIONS: "Question 1", "Question 2"]`

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
            })

            const diagnostics = formatSearchDiagnostics(fallbackIntent, {
              countryCode,
              buyerCurrency: activeBuyerCurrency,
            })

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
            finalContent = "The search AI is under high load right now. Please try again in a few seconds."
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
      errorMessage = "The AI is under high load right now. Please wait a moment and try again."
    }
    return NextResponse.json({ 
      text: errorMessage,
      products: [] 
    })
  }
}
