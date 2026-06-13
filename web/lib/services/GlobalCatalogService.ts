/**
 * FROM Catalog Search — queries each curated brand's own Shopify store catalog.
 *
 * Data source: every brand in the registry exposes a Universal Commerce Protocol
 * MCP endpoint at  https://{domain}/api/mcp  (search_catalog tool). We query the
 * selected brands' own endpoints directly — so results come ONLY from the brands
 * you've chosen, pulled live from each store's real Shopify catalog.
 *
 * Flow:
 *   1. Choose domains: exact brand match (user named a brand) OR category-filtered
 *      subset of the registry, relevance-sorted.
 *   2. Query those stores' /api/mcp in parallel batches.
 *   3. Parse → validate against registry → filter (budget / non-fashion) → sort.
 *   4. Cache the fetched product pool per query so "load more" paginates cleanly.
 */

import { UCP_REGISTRY, detectBrandsInQuery, BRAND_NAMES } from '../stores'
import { getExchangeRates } from '../exchangeRates'
import { rerankByRelevance } from './relevanceRerank'
import { matchStyles } from '../styleVocabulary'
import { recordBrandOutcome, deprioritizeDead } from './brandHealth'
import { readPersistentCache, writePersistentCache } from './persistentSearchCache'

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

type ProductSort = 'price_asc' | 'price_desc' | 'relevance' | 'trust_desc'

// ─── Config ────────────────────────────────────────────────────────────────────

const STORE_TIMEOUT_MS = 7000
const BATCH_SIZE = 45          // stores queried in parallel per round
const MAX_ROUNDS_PER_CALL = 2  // up to 90 stores fetched per search() call
const INITIAL_LIMIT = 30
const LOAD_MORE_LIMIT = 10
const CACHE_TTL_MS = 15 * 60 * 1000
const MAX_CACHE_ENTRIES = 300
const ZERO_DECIMAL_CURRENCIES = new Set(['VND', 'JPY', 'KRW'])

// ─── LRU cache (per query) ─────────────────────────────────────────────────────

type CacheEntry = {
  timestamp: number
  products: UcpProduct[]   // everything fetched for this query so far
  pending: string[]        // domains not yet queried, in relevance order
  queried: Set<string>     // domains already queried
  broadened?: boolean      // garment-only retry already performed for this query
}
const lruCache = new Map<string, CacheEntry>()

function cacheGet(key: string): CacheEntry | null {
  const e = lruCache.get(key)
  if (!e || Date.now() - e.timestamp > CACHE_TTL_MS) {
    lruCache.delete(key)
    return null
  }
  lruCache.delete(key)
  lruCache.set(key, e) // promote (most-recently-used)
  return e
}

function cacheSet(key: string, e: CacheEntry) {
  if (!lruCache.has(key) && lruCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = lruCache.keys().next().value
    if (oldest) lruCache.delete(oldest)
  }
  lruCache.set(key, e)
}

function makeCacheKey(
  query: string,
  cc: string | null,
  brandDomains: string[],
): string {
  return JSON.stringify({
    q: query.toLowerCase().trim(),
    cc,
    brands: [...brandDomains].sort(),
  })
}

// ─── Category → domain mapping ─────────────────────────────────────────────────

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  tops: [
    'shirt', 'shirts', 'tee', 'tees', 't-shirt', 't-shirts', 'top', 'tops', 'blouse', 'blouses',
    'polo', 'polos', 'henley', 'henleys', 'tank', 'tanks', 'crop', 'button-down', 'oxford', 'overshirt',
    'sweatshirt', 'sweatshirts', 'hoodie', 'hoodies', 'sweater', 'sweaters', 'cardigan', 'cardigans',
    'pullover', 'turtleneck', 'crewneck', 'knitwear', 'knit', 'flannel',
    'áo', 'シャツ', 'セーター',
  ],
  bottoms: [
    'pant', 'pants', 'trouser', 'trousers', 'jean', 'jeans', 'short', 'shorts', 'skirt', 'skirts',
    'legging', 'leggings', 'jogger', 'joggers', 'sweatpant', 'sweatpants', 'chino', 'chinos', 'cargo',
    'culottes', 'culotte', 'selvedge',
    'quần', 'パンツ', 'ジーンズ',
  ],
  dress: [
    'dress', 'dresses', 'gown', 'gowns', 'jumpsuit', 'jumpsuits', 'bodysuit', 'bodysuits',
    'romper', 'rompers', 'playsuit', 'co-ord', 'coord', 'sundress',
    'đầm', 'váy', 'ワンピース',
  ],
  outerwear: [
    'jacket', 'jackets', 'coat', 'coats', 'blazer', 'blazers', 'vest', 'vests', 'gilet', 'waistcoat',
    'fleece', 'parka', 'puffer', 'windbreaker', 'raincoat', 'overcoat', 'trench', 'bomber',
    'harrington', 'trucker',
    'khoác', 'ジャケット', 'コート',
  ],
  footwear: [
    'shoe', 'shoes', 'sneaker', 'sneakers', 'boot', 'boots', 'sandal', 'sandals', 'heel', 'heels',
    'loafer', 'loafers', 'slide', 'slides', 'flat', 'flats', 'oxford', 'oxfords', 'mule', 'mules',
    'clog', 'clogs', 'espadrille', 'espadrilles', 'derby', 'brogue', 'brogues',
    'chelsea', 'chukka', 'pump', 'pumps', 'trainer', 'trainers',
    'giày', 'dép', '靴', 'footwear',
  ],
  underwear: [
    'sock', 'socks', 'underwear', 'bra', 'bras', 'briefs', 'boxer', 'boxers', 'thong', 'thongs',
    'sleepwear', 'robe', 'robes', 'lingerie', 'bralette', 'swimwear', 'swimsuit', 'bikini',
    'swim', 'pajama', 'pyjama', 'loungewear',
  ],
  accessory: [
    'bag', 'bags', 'backpack', 'backpacks', 'tote', 'totes', 'pouch', 'clutch', 'clutches',
    'wallet', 'wallets', 'purse', 'purses', 'cardholder', 'crossbody', 'handbag',
    'weekender', 'duffle', 'messenger',
    'hat', 'hats', 'cap', 'caps', 'beanie', 'beanies', 'belt', 'belts', 'sunglasses', 'shades',
    'eyewear', 'scarf', 'scarves', 'watch', 'watches', 'jewelry', 'jewellery', 'necklace',
    'bracelet', 'bracelets', 'earring', 'earrings', 'ring', 'rings', 'pendant', 'chain', 'anklet',
    'túi', 'ví', 'mũ', 'kính', 'バッグ', '帽子',
  ],
}

function matchedCategories(query: string): Set<string> {
  const q = query.toLowerCase().replace(/[()\"',]/g, ' ')
  const words = q.split(/\s+/).filter(w => w.length >= 2 && w !== 'or' && w !== 'and')
  const cats = new Set<string>()
  for (const word of words) {
    for (const [cat, kws] of Object.entries(CATEGORY_KEYWORDS)) {
      if (kws.some(kw => {
        if (kw.length < 3) return word === kw
        return word === kw || (word.length >= 4 && (word.includes(kw) || kw.includes(word)))
      })) {
        cats.add(cat)
      }
    }
  }
  return cats
}

/** Returns registry domains matching the query's categories, sorted by relevance to the query. */
function getCategoryDomains(query: string): string[] {
  const cats = matchedCategories(query)
  const qLower = query.toLowerCase()

  const candidates = cats.size === 0
    ? UCP_REGISTRY
    : UCP_REGISTRY.filter(s => s.categories.some(c => cats.has(c)))

  const pool = candidates.length > 0 ? candidates : UCP_REGISTRY

  // Aesthetic intelligence: when the query carries a style ("quiet luxury",
  // "gorpcore"…), favor brands whose vibe tags and price tier fit that style.
  const styles = matchStyles(query)
  const styleSignals = new Set<string>()
  const stylePriceTiers = new Set<string>()
  for (const s of styles) {
    for (const k of s.keywords) styleSignals.add(k.toLowerCase())
    for (const m of s.materials) styleSignals.add(m.toLowerCase())
    stylePriceTiers.add(s.priceSignal)
  }

  // Gender routing: "men's shirt" should hit menswear brands first.
  const wantsMen   = /\b(men|men's|mens|menswear|male|him|guys)\b/i.test(qLower)
  const wantsWomen = /\b(women|women's|womens|womenswear|female|her|ladies)\b/i.test(qLower)

  // Relevance score: vibe terms appearing in the query rank a brand higher,
  // plus style-vocabulary fit, gender fit, and a small boost for category breadth.
  const ranked = [...pool]
    .map(s => {
      let score = 0
      for (const vibe of s.vibe) {
        const v = vibe.toLowerCase()
        if (qLower.includes(v)) score += 10
        if (styleSignals.has(v)) score += 6
      }
      if (s.priceRange && stylePriceTiers.has(s.priceRange)) score += 4
      if (wantsMen !== wantsWomen && s.gender && s.gender.length > 0) {
        const hasMen = s.gender.includes('men') || s.gender.includes('unisex')
        const hasWomen = s.gender.includes('women') || s.gender.includes('unisex')
        if (wantsMen) score += hasMen ? 12 : -20
        if (wantsWomen) score += hasWomen ? 12 : -20
      }
      if (s.items && s.items.some(it => qLower.includes(it.toLowerCase()))) score += 8
      score += s.categories.length
      return { domain: s.domain.toLowerCase().trim(), score }
    })
    .sort((a, b) => b.score - a.score)
    .map(x => x.domain)

  // Push stores that have been hard-failing to the back — they're queried only
  // if the healthy ones don't fill the page, and rejoin automatically on recovery.
  return deprioritizeDead(ranked)
}

// ─── Concept relevance ─────────────────────────────────────────────────────────
// mandatoryConcepts are synonym groups extracted from the request:
//   [["shirt","shirts","tee"], ["linen"], ["black"]]
// The FIRST group is the garment — products missing it are off-category. The
// rest (color/material/origin) are ranking signals. Always graceful: if hard
// filtering would leave too few results, we fall back to scoring only.

function productHaystack(p: UcpProduct): string {
  const opts = (p.options || []).map(o => `${o.name} ${o.values.join(' ')}`).join(' ')
  return `${p.title} ${(p.tags || []).join(' ')} ${p.description || ''} ${opts}`.toLowerCase()
}

function conceptHit(haystack: string, group: string[]): boolean {
  return group.some(term => {
    const t = term.toLowerCase().trim()
    if (!t) return false
    if (t.length < 4 || t.includes(' ') || t.includes('-')) return haystack.includes(t)
    return new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(haystack)
  })
}

/** Orders products by concept-group matches; hard-filters off-garment items when safe. */
function applyConceptRelevance(products: UcpProduct[], concepts: string[][], minKeep: number): UcpProduct[] {
  const groups = (concepts || []).filter(g => Array.isArray(g) && g.length > 0)
  if (groups.length === 0 || products.length === 0) return products

  const scored = products.map((p, i) => {
    const hay = productHaystack(p)
    let score = 0
    let garmentHit = false
    groups.forEach((g, gi) => {
      if (conceptHit(hay, g)) {
        score += gi === 0 ? 100 : 10  // garment group dominates
        if (gi === 0) garmentHit = true
      }
    })
    return { p, i, score, garmentHit }
  })

  // Hard-filter to on-garment products only when enough survive — never empty the page.
  const onGarment = scored.filter(s => s.garmentHit)
  const pool = onGarment.length >= Math.min(minKeep, products.length) ? onGarment : scored

  // Stable: concept score desc, then original (store relevance) order.
  return [...pool].sort((a, b) => b.score - a.score || a.i - b.i).map(s => s.p)
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

// ─── EN→JA translation for Japanese-catalog stores ─────────────────────────────

const EN_TO_JA: Record<string, string> = {
  shirt: 'シャツ', shirts: 'シャツ', tee: 'Tシャツ', 't-shirt': 'Tシャツ',
  pants: 'パンツ', trousers: 'パンツ', jeans: 'ジーンズ', denim: 'デニム',
  jacket: 'ジャケット', coat: 'コート', sweater: 'セーター', hoodie: 'フーディー',
  cardigan: 'カーディガン', vest: 'ベスト', blazer: 'ブレザー',
  dress: 'ワンピース', skirt: 'スカート', shorts: 'ショーツ',
  shoes: '靴', sneakers: 'スニーカー', boots: 'ブーツ', sandals: 'サンダル', loafers: 'ローファー',
  bag: 'バッグ', backpack: 'リュック', hat: '帽子', cap: 'キャップ', belt: 'ベルト',
  wallet: '財布', socks: '靴下', scarf: 'スカーフ',
  linen: 'リネン', cotton: 'コットン', wool: 'ウール', silk: 'シルク', leather: 'レザー',
  cashmere: 'カシミヤ', fleece: 'フリース', nylon: 'ナイロン',
}

function translateEnToJa(query: string): string {
  const words = query.toLowerCase().split(/\s+/)
  const out = words.map(w => EN_TO_JA[w]).filter(Boolean)
  return out.length > 0 ? out.join(' ') : ''
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

function cleanDomainToken(d: string): string {
  return d.toLowerCase().replace(/^www\./, '').replace(/[\-_]/g, '').split('.')[0] ?? ''
}

function domainMatches(productDomain: string, registryDomain: string): boolean {
  const p = cleanDomainToken(productDomain)
  const r = cleanDomainToken(registryDomain)
  if (!p || !r || p.length < 3) return false
  return p === r || p.startsWith(r) || r.startsWith(p)
}

function getStoreDomain(storeUrl: string): string {
  try { return new URL(storeUrl).hostname.replace(/^www\./i, '').toLowerCase() } catch { return '' }
}

function convertPrice(price: number, from: string, to: string, rates: Record<string, number>): number {
  from = from.toUpperCase(); to = to.toUpperCase()
  if (from === to) return price
  const f = rates[from]; const t = rates[to]
  if (!f || !t) return price
  return (price / f) * t
}

function normalizeCurrency(c?: string | null): string {
  return String(c || 'USD').trim().toUpperCase() || 'USD'
}

// ─── Per-store MCP fetch ───────────────────────────────────────────────────────

function extractProducts(data: any): any[] {
  if (data?.result?.structuredContent?.products) return data.result.structuredContent.products
  const text = data?.result?.content?.[0]?.text
  if (typeof text === 'string') {
    try {
      const inner = JSON.parse(text)
      if (Array.isArray(inner?.products)) return inner.products
    } catch {}
  }
  if (data?.result?.products) return data.result.products
  return []
}

/** Query one brand's own Shopify catalog via its MCP endpoint. */
async function fetchStore(domain: string, query: string, countryCode: string | null): Promise<any[]> {
  const profile = UCP_REGISTRY.find(s => s.domain.toLowerCase().trim() === domain)
  const langs = profile?.languages || ['en']

  // Build query variants: English plus a Japanese rendering for JA-catalog stores.
  const queries = new Set<string>([query])
  if (langs.includes('ja')) {
    const ja = translateEnToJa(query)
    if (ja) queries.add(ja)
  }

  // ships_to is not part of Shopify's public MCP spec — omitting it prevents
  // the endpoint from returning empty when the filter format is unrecognised.
  const runOne = async (q: string): Promise<{ products: any[]; errored: boolean }> => {
    // Empty query = browse full catalog. Shopify MCP returns all available products
    // when no query is specified, so we omit the field rather than sending "".
    const catalogArgs: Record<string, any> = { filters: { available: true }, pagination: { limit: 30 } }
    if (q) catalogArgs.query = q
    const payload = {
      jsonrpc: '2.0',
      method: 'tools/call',
      id: 1,
      params: {
        name: 'search_catalog',
        arguments: { catalog: catalogArgs },
      },
    }
    try {
      const res = await fetch(`https://${domain}/api/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(STORE_TIMEOUT_MS),
      })
      if (!res.ok) return { products: [] as any[], errored: true }
      const data = await res.json()
      const products = extractProducts(data)
      for (const p of products) p._sourceDomain = domain
      return { products, errored: false }
    } catch {
      return { products: [] as any[], errored: true }
    }
  }

  const results = await Promise.all(Array.from(queries).map(runOne))
  const errored = results.every(r => r.errored)
  const products = results.flatMap(r => r.products)
  recordBrandOutcome(domain, { productCount: products.length, errored })
  return products
}

// ─── Product normalization ─────────────────────────────────────────────────────

function parseProduct(raw: any, sourceDomain?: string): UcpProduct | null {
  try {
    const variant = raw.variants?.[0] ?? {}
    const currency = normalizeCurrency(variant.price?.currency ?? raw.price_range?.min?.currency)
    const isZero = ZERO_DECIMAL_CURRENCIES.has(currency)
    const rawAmount = variant.price?.amount ?? raw.price_range?.min?.amount ?? 0
    const price = isZero ? rawAmount : rawAmount / 100

    const domain = sourceDomain ?? raw._sourceDomain
    let vendor = variant.seller?.name ?? variant.seller?.domain
    if (!vendor && domain) {
      const token = cleanDomainToken(domain)
      vendor = token ? token.charAt(0).toUpperCase() + token.slice(1) : domain
    }
    vendor = vendor || 'Independent'

    // Build a usable product URL, defaulting to the source store's domain.
    let store_url = variant.url ?? raw.url ?? ''
    if (store_url && store_url.startsWith('/') && domain) {
      store_url = `https://${domain}${store_url}`
    } else if (!store_url && domain) {
      const idPart = String(raw.id ?? '').split('/').pop()
      store_url = `https://${domain}/products/${idPart}`
    } else if (store_url && !store_url.startsWith('http')) {
      store_url = `https://${store_url}`
    }

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
      const vc = normalizeCurrency(v.price?.currency ?? currency)
      const vz = ZERO_DECIMAL_CURRENCIES.has(vc)
      return {
        id: v.id,
        title: v.title,
        price: (() => {
          const va = v.price?.amount ?? 0
          return vz ? va : va / 100
        })(),
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

    const image_url = normalizeImageUrl(raw.media?.[0]?.url ?? variant.media?.[0]?.url ?? '')
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
    sort: ProductSort
    limit: number
    rates: Record<string, number>
    concepts?: string[][]
  },
): UcpProduct[] {
  const excluded = new Set(params.excludeIds)
  let out = products.filter(p => {
    if (excluded.has(p.id)) return false
    if (!p.in_stock) return false
    if (params.budgetMax && params.budgetMax > 0) {
      if (convertPrice(p.price, p.currency, params.budgetCurrency, params.rates) > params.budgetMax) {
        return false
      }
    }
    return true
  })

  // Concept layer: drop off-garment items (when safe) and rank by concept fit.
  if (params.concepts && params.concepts.length > 0) {
    out = applyConceptRelevance(out, params.concepts, 4)
  }

  if (params.sort === 'price_asc') out = [...out].sort((a, b) => a.price - b.price)
  else if (params.sort === 'price_desc') out = [...out].sort((a, b) => b.price - a.price)
  // 'relevance' / 'trust_desc': preserve concept + store catalog order

  return out.slice(0, params.limit)
}

// ─── Main search ───────────────────────────────────────────────────────────────

export class GlobalCatalogService {
  static async search(
    query: string,
    budgetMax?: number | null,
    excludeIds: string[] = [],
    countryCode?: string | null,
    _isClothing?: boolean,
    mandatoryConcepts: string[][] = [],
    sort: ProductSort = 'relevance',
    budgetCurrency: string | null = 'USD',
    options: {
      loadMore?: boolean
      fastFirstPage?: boolean
      refreshReserve?: boolean
      debug?: CatalogSearchDebug
    } = {},
    brandDomains: string[] = [],
    _tasteProfile?: string,
    /** The user's original message — used for relevance reranking so aesthetic /
     *  style signals survive even when the fetch query is stripped down. The
     *  catalog fetch still uses the clean `query` so recall is never reduced. */
    rerankQuery?: string,
  ): Promise<UcpProduct[]> {
    const rawQuery = query.trim()
    // For brand-only searches (brandDomains pre-supplied), allow empty rawQuery —
    // we'll browse the brand's catalog with a broad/empty query instead of returning early.
    if (!rawQuery && brandDomains.length === 0) return []

    const isLoadMore = Boolean(options.loadMore)
    const limit = isLoadMore ? LOAD_MORE_LIMIT : INITIAL_LIMIT
    const cc = countryCode?.trim().toUpperCase() || null
    const bcur = normalizeCurrency(budgetCurrency)
    const rates = await getExchangeRates().catch(() => ({} as Record<string, number>))

    // Which brands? Explicit brandDomains → else detect a named brand → else category subset.
    const detectedBrands = brandDomains.length > 0 ? brandDomains : detectBrandsInQuery(rawQuery)
    const validBrands = detectedBrands.filter(d =>
      UCP_REGISTRY.some(s => s.domain.toLowerCase() === d.toLowerCase()),
    )
    const isBrandSearch = validBrands.length > 0

    // Strip the brand name from the query sent to the store ("shirts from Banana Club" → "shirts").
    // For brand-only searches where the whole query IS the brand name, storeQuery becomes empty —
    // that's intentional: an empty Shopify query returns all available products in the store.
    let storeQuery = rawQuery
    if (isBrandSearch) {
      for (const d of detectedBrands) {
        const name = BRAND_NAMES[d] || (UCP_REGISTRY.find(s => s.domain === d)?.name)
        if (name && name.length >= 3) {
          const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          storeQuery = storeQuery
            .replace(new RegExp(`\\b(?:from|at|by|in)\\s+${esc}\\b`, 'gi'), ' ')
            .replace(new RegExp(`\\b${esc}\\b`, 'gi'), ' ')
        }
      }
      // Don't fall back to rawQuery (which has the brand name) — empty storeQuery
      // intentionally browses the brand's full available catalog.
      storeQuery = storeQuery.replace(/\s+/g, ' ').trim()
    }

    const cacheKey = makeCacheKey(storeQuery, cc, validBrands)

    // Reuse the fetched pool across pages; rebuild it on a cold cache.
    let entry = options.refreshReserve ? cacheGet(cacheKey) : cacheGet(cacheKey)
    let seededFromPersistent = false
    if (!entry) {
      const orderedDomains = isBrandSearch
        ? validBrands.map(d => d.toLowerCase().trim())
        : getCategoryDomains(storeQuery)
      entry = { timestamp: Date.now(), products: [], pending: [...orderedDomains], queried: new Set() }
      cacheSet(cacheKey, entry)

      // Cold in-memory cache — try the persistent (cross-cold-start) cache. The
      // pool is seeded but `pending` is kept, so the first page serves instantly
      // while load-more can still fetch fresh stores. 15-min TTL enforced in Convex.
      if (!isLoadMore) {
        const persisted = await readPersistentCache(cacheKey)
        if (persisted && persisted.length > 0) {
          entry.products = persisted
          seededFromPersistent = true
        }
      }
    }

    if (options.debug) options.debug.catalogFetched = true

    const enough = () =>
      applyFiltersAndSort(entry!.products, {
        budgetMax, budgetCurrency: bcur, excludeIds, sort, limit, rates,
        concepts: mandatoryConcepts,
      }).length >= limit

    const ingest = (batchRaw: any[][]) => {
      const seen = new Set(entry!.products.map(p => p.id))
      for (const list of batchRaw) {
        for (const raw of list) {
          if (!raw?.id || seen.has(raw.id)) continue
          const p = parseProduct(raw, raw._sourceDomain)
          if (!p) continue
          if (isNonFashion(p)) continue
          // Trust the source store, but validate when a URL points elsewhere.
          const dom = getStoreDomain(p.store_url)
          if (dom && !UCP_REGISTRY.some(s => domainMatches(dom, s.domain))) continue
          seen.add(raw.id)
          entry!.products.push(p)
        }
      }
    }

    // Fetch in batches until we have enough to serve this page or run out of stores.
    let rounds = 0
    while (!enough() && entry.pending.length > 0 && rounds < MAX_ROUNDS_PER_CALL) {
      rounds++
      const batch = entry.pending.splice(0, BATCH_SIZE)
      const batchRaw = await Promise.all(batch.map(d => fetchStore(d, storeQuery, cc)))
      for (const d of batch) entry.queried.add(d)
      ingest(batchRaw)
    }

    // Second-chance recall: a specific multi-word query ("oxford camp collar
    // shirt") can miss on Shopify's literal search. If results are thin, retry
    // the same stores once with just the garment term. Runs at most once per
    // cached query — worst case it adds nothing and the page renders as before.
    if (!isLoadMore && !entry.broadened && storeQuery.includes(' ')) {
      const current = applyFiltersAndSort(entry.products, {
        budgetMax, budgetCurrency: bcur, excludeIds, sort, limit, rates,
        concepts: mandatoryConcepts,
      })
      if (current.length < 5) {
        const garment = mandatoryConcepts[0]?.[0] || storeQuery.split(' ').pop() || ''
        if (garment && garment.length >= 3 && garment.toLowerCase() !== storeQuery.toLowerCase()) {
          entry.broadened = true
          const retryDomains = Array.from(entry.queried).slice(0, 20)
          const retryRaw = await Promise.all(retryDomains.map(d => fetchStore(d, garment, cc)))
          ingest(retryRaw)
          console.log(`[Catalog] broadened "${storeQuery}" → "${garment}" (+${entry.products.length} pool)`)
        }
      }
    }
    cacheSet(cacheKey, entry)

    // Persist a fresh pool so the next cold start serves it instantly. Skip when
    // we just seeded from the persistent cache (already stored). Awaited but
    // failure-silent — on a fetch path that already took seconds, the write is
    // negligible and never blocks the response on error.
    if (!isLoadMore && !seededFromPersistent && entry.queried.size > 0 && entry.products.length > 0) {
      await writePersistentCache(cacheKey, entry.products)
    }

    console.log(
      `[Catalog] "${storeQuery.slice(0, 50)}" ${isBrandSearch ? '(brand)' : '(category)'} → ` +
      `${entry.products.length} products, ${entry.queried.size} stores queried, ${entry.pending.length} pending` +
      `${seededFromPersistent ? ' [warm:persistent]' : ''}`,
    )

    let result = applyFiltersAndSort(entry.products, {
      budgetMax, budgetCurrency: bcur, excludeIds, sort, limit, rates,
      concepts: mandatoryConcepts,
    })

    // Optional LLM rerank for nuanced relevance queries (first page only).
    if (sort === 'relevance' && result.length >= 4 && !isLoadMore) {
      try {
        const judgeQuery = (rerankQuery && rerankQuery.trim()) ? rerankQuery.trim() : rawQuery
        result = await rerankByRelevance(judgeQuery, result, _tasteProfile)
      } catch (err) {
        console.warn('[Catalog] rerank skipped:', err instanceof Error ? err.message : String(err))
      }
    }

    return result
  }
}
