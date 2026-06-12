/**
 * FROM Catalog Search — clean implementation over the Shopify Global Catalog MCP.
 *
 * Architecture (single path):
 *   1. Build domain list: exact brand match OR category-filtered registry subset
 *   2. Chunk domains → parallel Global Catalog queries: (query) AND ("d1" OR "d2" OR ...)
 *   3. Parse, deduplicate, validate each product against the curated registry
 *   4. Filter (budget, non-fashion, excluded IDs) → sort → optional LLM rerank
 *
 * Catalog endpoint: https://catalog.shopify.com/api/ucp/mcp  (search_catalog tool)
 * Domain filtering: injected directly into the query string using Shopify's AND/OR syntax
 */

import { UCP_REGISTRY, detectBrandsInQuery, BRAND_NAMES } from '../stores'
import { getExchangeRates } from '../exchangeRates'
import { rerankByRelevance } from './relevanceRerank'

// ─── Types ─────────────────────────────────────────────────────────────────────

export type UcpProduct = {
  id: string
  title: string
  vendor: string
  price: number
  currency: string
  store_url: string
  image_url: string
  in_stock: boolean
  tags: string[]
  description?: string
  description_html?: string
  options?: { name: string; values: string[] }[]
  media?: Array<{ type: string; url: string; alt?: string }>
  variants?: Array<{
    id: string
    title: string
    price: number
    availability: boolean
    options: Array<{ name: string; label: string }>
    media?: Array<{ url: string; alt?: string }>
  }>
  trust_score?: number
  relevance_score?: number
  relevance_reason?: string
}

export type CatalogSearchDebug = {
  catalogFetched?: boolean
  loadMorePage?: number
  loadMoreQuery?: string
}

// ─── Config ────────────────────────────────────────────────────────────────────

const CATALOG_URL = 'https://catalog.shopify.com/api/ucp/mcp'
const CATALOG_TIMEOUT_MS = 9000
const DOMAINS_PER_CHUNK = 10
const PRODUCTS_PER_CHUNK = 30
const INITIAL_LIMIT = 30
const LOAD_MORE_LIMIT = 10
const CACHE_TTL_MS = 15 * 60 * 1000
const MAX_CACHE_ENTRIES = 400
const ZERO_DECIMAL_CURRENCIES = new Set(['VND', 'JPY', 'KRW'])

// ─── LRU Cache ─────────────────────────────────────────────────────────────────

type CacheEntry = { timestamp: number; products: UcpProduct[] }
const lruCache = new Map<string, CacheEntry>()

function cacheGet(key: string): CacheEntry | null {
  const entry = lruCache.get(key)
  if (!entry || Date.now() - entry.timestamp > CACHE_TTL_MS) {
    lruCache.delete(key)
    return null
  }
  // Promote to tail (most recently used)
  lruCache.delete(key)
  lruCache.set(key, entry)
  return entry
}

function cacheSet(key: string, entry: CacheEntry) {
  if (lruCache.size >= MAX_CACHE_ENTRIES) {
    // Evict the head (least recently used)
    const lruKey = lruCache.keys().next().value
    if (lruKey) lruCache.delete(lruKey)
  }
  lruCache.set(key, entry)
}

function makeCacheKey(
  query: string,
  countryCode: string | null,
  budgetMax: number | null,
  budgetCurrency: string,
  sort: string,
  brandDomains: string[],
): string {
  return JSON.stringify({
    q: query.toLowerCase().trim(),
    cc: countryCode,
    bmax: budgetMax ?? null,
    bcur: budgetCurrency,
    sort,
    brands: [...brandDomains].sort(),
  })
}

// ─── Category → domain mapping ─────────────────────────────────────────────────

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  tops: [
    'shirt', 'shirts', 'tee', 'tees', 't-shirt', 't-shirts', 'top', 'tops', 'blouse', 'blouses',
    'polo', 'polos', 'henley', 'henleys', 'tank', 'tanks', 'crop', 'button-down', 'oxford', 'overshirt',
    'sweatshirt', 'sweatshirts', 'hoodie', 'hoodies', 'sweater', 'sweaters', 'cardigan', 'cardigans',
    'pullover', 'turtleneck', 'crewneck', 'knitwear', 'knit', 'flannel', 'camp collar',
    'áo', 'シャツ', 'Tシャツ', 'セーター',
  ],
  bottoms: [
    'pant', 'pants', 'trouser', 'trousers', 'jean', 'jeans', 'short', 'shorts', 'skirt', 'skirts',
    'legging', 'leggings', 'jogger', 'joggers', 'sweatpant', 'sweatpants', 'chino', 'chinos', 'cargo',
    'culottes', 'culotte', 'selvedge',
    'quần', 'váy', 'パンツ', 'ジーンズ',
  ],
  dress: [
    'dress', 'dresses', 'gown', 'gowns', 'jumpsuit', 'jumpsuits', 'bodysuit', 'bodysuits',
    'romper', 'rompers', 'playsuit', 'co-ord', 'coord', 'sundress',
    'đầm', 'ワンピース',
  ],
  outerwear: [
    'jacket', 'jackets', 'coat', 'coats', 'blazer', 'blazers', 'vest', 'vests', 'gilet', 'waistcoat',
    'fleece', 'parka', 'puffer', 'windbreaker', 'raincoat', 'overcoat', 'trench', 'bomber',
    'harrington', 'trucker', 'sport coat',
    'khoác', 'ジャケット', 'コート',
  ],
  footwear: [
    'shoe', 'shoes', 'sneaker', 'sneakers', 'boot', 'boots', 'sandal', 'sandals', 'heel', 'heels',
    'loafer', 'loafers', 'slide', 'slides', 'flat', 'flats', 'oxford', 'oxfords', 'mule', 'mules',
    'clog', 'clogs', 'espadrille', 'espadrilles', 'derby', 'derbies', 'brogue', 'brogues',
    'chelsea', 'chukka', 'pump', 'pumps', 'stiletto', 'ballet flat', 'ballerina', 'trainer', 'trainers',
    'giày', 'dép', '靴', 'footwear',
  ],
  underwear: [
    'sock', 'socks', 'underwear', 'bra', 'bras', 'briefs', 'boxer', 'boxers', 'thong', 'thongs',
    'sleepwear', 'robe', 'robes', 'lingerie', 'bralette', 'swimwear', 'swimsuit', 'bikini',
    'swim trunk', 'board short', 'pajama', 'pyjama', 'loungewear',
    'vớ', '下着',
  ],
  accessory: [
    'bag', 'bags', 'backpack', 'backpacks', 'tote', 'totes', 'pouch', 'pouches', 'clutch', 'clutches',
    'wallet', 'wallets', 'purse', 'purses', 'cardholder', 'card holder', 'crossbody', 'handbag',
    'weekender', 'duffle', 'messenger',
    'hat', 'hats', 'cap', 'caps', 'beanie', 'beanies', 'bucket hat',
    'belt', 'belts', 'sunglasses', 'shades', 'eyewear', 'scarf', 'scarves',
    'watch', 'watches', 'jewelry', 'jewellery', 'necklace', 'necklaces',
    'bracelet', 'bracelets', 'earring', 'earrings', 'ring', 'rings', 'pendant', 'chain', 'anklet',
    'túi', 'ví', 'mũ', 'kính', 'バッグ', '帽子',
  ],
}

function getMatchingDomains(query: string): string[] {
  const q = query.toLowerCase().replace(/[()\"',]/g, ' ')
  const words = q.split(/\s+/).filter(w => w.length >= 2 && w !== 'or' && w !== 'and')

  const matched = new Set<string>()
  for (const word of words) {
    for (const [cat, kws] of Object.entries(CATEGORY_KEYWORDS)) {
      if (kws.some(kw => {
        if (kw.length < 3) return word === kw
        return word === kw || (word.length >= 4 && (word.includes(kw) || kw.includes(word)))
      })) {
        matched.add(cat)
      }
    }
  }

  if (matched.size === 0) {
    return UCP_REGISTRY.map(s => s.domain.toLowerCase().trim())
  }

  const domains = UCP_REGISTRY
    .filter(s => s.categories.some(c => matched.has(c)))
    .map(s => s.domain.toLowerCase().trim())

  return domains.length > 0 ? domains : UCP_REGISTRY.map(s => s.domain.toLowerCase().trim())
}

// ─── Non-fashion filter ────────────────────────────────────────────────────────

const NON_FASHION_TITLE_RE = /\b(?:book|books|magazine|magazines|zine|zines|paperback|hardcover|novel|novels|stationery|notepad|notepads|notebook|notebooks|candle|candles|diffuser|diffusers|incense|art\s+print|art\s+prints|wall\s+art|poster|posters|gift\s+card|gift\s+wrap)\b/i
const NON_FASHION_TAGS = new Set([
  'book', 'books', 'magazine', 'magazines', 'zine', 'novel', 'publication',
  'art-print', 'art print', 'wall-art', 'wall art', 'poster',
  'candle', 'candles', 'diffuser', 'home-fragrance', 'home fragrance', 'incense',
  'notebook', 'notebooks', 'stationery', 'notepad',
  'gift-card', 'gift card', 'gift_card',
])

function isNonFashion(p: UcpProduct): boolean {
  if (NON_FASHION_TITLE_RE.test(p.title)) return true
  return (p.tags || []).some(t => NON_FASHION_TAGS.has(t.toLowerCase()))
}

// ─── Utilities ─────────────────────────────────────────────────────────────────

function normalizeImageUrl(url?: string): string {
  if (!url) return ''
  let u = url.startsWith('//') ? `https:${url}` : url
  if (u.includes('cdn.shopify.com')) {
    try {
      const obj = new URL(u)
      obj.searchParams.set('width', '400')
      u = obj.toString()
    } catch {}
  }
  return u
}

function getStoreDomain(storeUrl: string): string {
  try { return new URL(storeUrl).hostname.replace(/^www\./i, '').toLowerCase() } catch { return '' }
}

function domainMatches(productDomain: string, registryDomain: string): boolean {
  const clean = (d: string) =>
    d.toLowerCase().replace(/^www\./, '').replace(/[\-_]/g, '').split('.')[0] ?? ''
  const p = clean(productDomain)
  const r = clean(registryDomain)
  if (!p || !r || p.length < 3) return false
  return p === r || p.startsWith(r) || r.startsWith(p)
}

function convertPrice(
  price: number,
  from: string,
  to: string,
  rates: Record<string, number>,
): number {
  from = from.toUpperCase()
  to = to.toUpperCase()
  if (from === to) return price
  const fRate = rates[from]
  const tRate = rates[to]
  if (!fRate || !tRate) return price
  return (price / fRate) * tRate
}

// ─── Shopify Global Catalog fetch ──────────────────────────────────────────────

async function fetchCatalog(query: string, countryCode: string | null): Promise<any[]> {
  const filters: Record<string, unknown> = { available: true }
  if (countryCode) filters.ships_to = { country: countryCode }

  const body = {
    jsonrpc: '2.0',
    method: 'tools/call',
    id: '1',
    params: {
      name: 'search_catalog',
      arguments: {
        meta: {
          'ucp-agent': {
            profile: 'https://shopify.dev/ucp/agent-profiles/2026-04-08/valid-with-capabilities.json',
          },
        },
        catalog: {
          query,
          filters,
          pagination: { limit: PRODUCTS_PER_CHUNK },
        },
      },
    },
  }

  try {
    const res = await fetch(CATALOG_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(CATALOG_TIMEOUT_MS),
    })
    if (!res.ok) {
      console.warn(`[Catalog] HTTP ${res.status} for query: ${query.slice(0, 80)}`)
      return []
    }
    const json = await res.json()
    // Handle both structured content format and legacy text-wrapped format
    if (json.result?.structuredContent?.products) {
      return json.result.structuredContent.products
    }
    if (json.result?.products) {
      return json.result.products
    }
    const textContent = json.result?.content?.[0]?.text
    if (typeof textContent === 'string') {
      try {
        const inner = JSON.parse(textContent)
        if (Array.isArray(inner?.products)) return inner.products
      } catch {}
    }
    return []
  } catch (err) {
    console.error('[Catalog] fetch error:', err instanceof Error ? err.message : String(err))
    return []
  }
}

// ─── Product normalization ─────────────────────────────────────────────────────

function parseProduct(raw: any): UcpProduct | null {
  try {
    const variant = raw.variants?.[0] ?? {}
    const currency = (
      variant.price?.currency ?? raw.price_range?.min?.currency ?? 'USD'
    ).toUpperCase()
    const isZero = ZERO_DECIMAL_CURRENCIES.has(currency)
    const rawAmount = variant.price?.amount ?? raw.price_range?.min?.amount ?? 0
    const price = isZero ? rawAmount : rawAmount / 100

    const vendor = variant.seller?.name ?? variant.seller?.domain ?? 'Independent'

    let store_url = variant.url ?? raw.url ?? ''
    if (store_url && !store_url.startsWith('http')) {
      store_url = `https://${store_url}`
    }
    try {
      if (store_url) {
        const u = new URL(store_url)
        u.searchParams.set('ref', 'from_ai_affiliate')
        store_url = u.toString()
      }
    } catch {}

    const descCandidates = [
      raw.description?.plain,
      variant.description?.plain,
      raw.metadata?.tech_specs,
    ].filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
    const description = descCandidates.length
      ? descCandidates.reduce((a, b) => (b.length > a.length ? b : a))
      : undefined

    const options = Array.isArray(raw.options)
      ? raw.options
          .map((o: any) => ({
            name: o.name,
            values: (o.values ?? []).map((v: any) => v.label ?? String(v)),
          }))
          .filter((o: any) => o.values.length > 0)
      : undefined

    const variants = (raw.variants ?? []).map((v: any) => {
      const vc = (v.price?.currency ?? currency).toUpperCase()
      const vz = ZERO_DECIMAL_CURRENCIES.has(vc)
      return {
        id: v.id,
        title: v.title,
        price: vz ? (v.price?.amount ?? 0) : (v.price?.amount ?? 0) / 100,
        availability: v.availability?.available ?? true,
        options: v.options ?? [],
        media: (v.media ?? []).map((m: any) => ({
          url: normalizeImageUrl(m.url),
          alt: m.alt ?? m.altText ?? m.alt_text ?? '',
        })),
      }
    })

    const media = (raw.media ?? []).map((m: any) => ({
      type: m.type ?? 'image',
      url: normalizeImageUrl(m.url),
      alt: m.alt ?? m.altText ?? m.alt_text ?? '',
    }))

    const image_url = normalizeImageUrl(
      raw.media?.[0]?.url ?? variant.media?.[0]?.url ?? '',
    )
    if (!image_url) return null

    return {
      id: raw.id,
      title: raw.title ?? 'Untitled',
      vendor,
      price,
      currency,
      store_url,
      image_url,
      in_stock: variant.availability?.available ?? true,
      tags: raw.tags ?? [],
      description,
      description_html:
        typeof raw.description?.html === 'string' && raw.description.html.trim()
          ? raw.description.html
          : undefined,
      options: options?.length ? options : undefined,
      variants,
      media,
    }
  } catch {
    return null
  }
}

// ─── Filter + sort ─────────────────────────────────────────────────────────────

function applyFiltersAndSort(
  products: UcpProduct[],
  params: {
    budgetMax?: number | null
    budgetCurrency: string
    excludeIds: string[]
    sort: string
    limit: number
    rates: Record<string, number>
  },
): UcpProduct[] {
  const excluded = new Set(params.excludeIds)

  let filtered = products.filter(p => {
    if (excluded.has(p.id)) return false
    if (params.budgetMax && params.budgetMax > 0) {
      const converted = convertPrice(p.price, p.currency, params.budgetCurrency, params.rates)
      if (converted > params.budgetMax) return false
    }
    return true
  })

  if (params.sort === 'price_asc') {
    filtered = [...filtered].sort((a, b) => a.price - b.price)
  } else if (params.sort === 'price_desc') {
    filtered = [...filtered].sort((a, b) => b.price - a.price)
  }
  // 'relevance' and 'trust_desc': preserve Shopify catalog order (already relevance-ranked)

  return filtered.slice(0, params.limit)
}

// ─── Main search ───────────────────────────────────────────────────────────────

export class GlobalCatalogService {
  static async search(
    query: string,
    budgetMax?: number | null,
    excludeIds: string[] = [],
    countryCode?: string | null,
    _isClothing?: boolean,
    _mandatoryConcepts: string[][] = [],
    sort: 'price_asc' | 'price_desc' | 'relevance' | 'trust_desc' = 'relevance',
    budgetCurrency: string | null = 'USD',
    options: {
      loadMore?: boolean
      fastFirstPage?: boolean
      refreshReserve?: boolean
      debug?: CatalogSearchDebug
    } = {},
    brandDomains: string[] = [],
    _tasteProfile?: string,
  ): Promise<UcpProduct[]> {
    const q = query.trim()
    if (!q) return []

    const isLoadMore = Boolean(options.loadMore)
    const limit = isLoadMore ? LOAD_MORE_LIMIT : INITIAL_LIMIT
    const cc = countryCode?.trim().toUpperCase() || null
    const bcur = (budgetCurrency || 'USD').toUpperCase()
    const cacheKey = makeCacheKey(q, cc, budgetMax ?? null, bcur, sort, brandDomains)

    const rates = await getExchangeRates().catch(() => ({} as Record<string, number>))

    // Cache hit — skip on load-more to deliver different products than page 1
    if (!isLoadMore && !options.refreshReserve) {
      const hit = cacheGet(cacheKey)
      if (hit) {
        return applyFiltersAndSort(hit.products, {
          budgetMax,
          budgetCurrency: bcur,
          excludeIds,
          sort,
          limit,
          rates,
        })
      }
    }

    if (options.debug) options.debug.catalogFetched = true

    // Determine which brand domains to search
    const detectedBrands = brandDomains.length > 0 ? brandDomains : detectBrandsInQuery(q)
    const domains =
      detectedBrands.length > 0
        ? detectedBrands.filter(d =>
            UCP_REGISTRY.some(s => s.domain.toLowerCase() === d.toLowerCase()),
          )
        : getMatchingDomains(q)

    if (domains.length === 0) return []

    // Strip brand names from the query when searching a brand-specific request
    // so "shirts from Taylor Stitch" → "shirts" when sent to the catalog
    let searchQuery = q
    if (detectedBrands.length > 0) {
      for (const d of detectedBrands) {
        const name = BRAND_NAMES[d]
        if (name && name.length >= 3) {
          const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          searchQuery = searchQuery
            .replace(new RegExp(`\\b(?:from|at|by|in)?\\s*${escaped}\\b`, 'gi'), '')
            .trim()
        }
      }
      if (!searchQuery) searchQuery = q
    }

    // Chunk domains → parallel catalog queries with domain filters
    const chunks: string[][] = []
    for (let i = 0; i < domains.length; i += DOMAINS_PER_CHUNK) {
      chunks.push(domains.slice(i, i + DOMAINS_PER_CHUNK))
    }

    console.log(
      `[Catalog] "${searchQuery.slice(0, 60)}" → ${chunks.length} chunk(s), ${domains.length} domain(s)`,
    )

    const rawBatches = await Promise.all(
      chunks.map(chunk => {
        const domainClause = chunk.map(d => `"${d}"`).join(' OR ')
        return fetchCatalog(`(${searchQuery}) AND (${domainClause})`, cc)
      }),
    )

    // Deduplicate, parse, validate against registry
    const seen = new Set<string>()
    const products: UcpProduct[] = []

    for (const batch of rawBatches) {
      for (const raw of batch) {
        if (!raw?.id || seen.has(raw.id)) continue
        seen.add(raw.id)

        const p = parseProduct(raw)
        if (!p) continue
        if (isNonFashion(p)) continue

        // Only surface products from our curated registry
        const domain = getStoreDomain(p.store_url)
        if (domain && !UCP_REGISTRY.some(s => domainMatches(domain, s.domain))) continue

        products.push(p)
      }
    }

    console.log(`[Catalog] ${products.length} products from ${domains.length} domains`)

    // Cache the full product set before filtering (load-more reuses this)
    cacheSet(cacheKey, { timestamp: Date.now(), products })

    let result = applyFiltersAndSort(products, {
      budgetMax,
      budgetCurrency: bcur,
      excludeIds,
      sort,
      limit,
      rates,
    })

    // Optional LLM rerank for relevance sort (improves quality for nuanced queries)
    if (sort === 'relevance' && result.length >= 4 && !isLoadMore) {
      try {
        result = await rerankByRelevance(q, result, _tasteProfile)
      } catch (err) {
        console.warn(
          '[Catalog] rerank skipped:',
          err instanceof Error ? err.message : String(err),
        )
      }
    }

    return result
  }
}
