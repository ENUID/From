import { NextRequest, NextResponse } from 'next/server'
import { GlobalCatalogService } from '@/lib/services/GlobalCatalogService'
import { UCP_REGISTRY, getStoreCountry, GEO_REGIONS } from '@/lib/stores'

export const maxDuration = 60

// Deterministic shuffle keyed by a seed so each scroll page pulls a different,
// stable window of brands (no Math.random → repeatable, paginates cleanly).
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = arr.slice()
  let s = (seed >>> 0) || 1
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Coarse category bucket from title/tags — used to interleave the feed so no
// single category (e.g. footwear) ever dominates the grid.
function categoryOf(p: any): string {
  const t = `${p.title ?? ''} ${(Array.isArray(p.tags) ? p.tags.join(' ') : '')}`.toLowerCase()
  if (/sneaker|trainer|loafer|\bboot|heel|sandal|flip.?flop|\bshoe|footwear|derby|oxford|\bmule|clog|espadrille|pump/.test(t)) return 'shoes'
  if (/dress|gown|kurta|saree|lehenga|anarkali|jumpsuit|romper|kaftan/.test(t)) return 'dress'
  if (/trouser|pant|jean|denim|chino|short|skirt|legging|cargo|culotte/.test(t)) return 'bottom'
  if (/jacket|coat|blazer|parka|trench|bomber|overcoat|gilet|waistcoat/.test(t)) return 'outerwear'
  if (/\bbag|tote|backpack|clutch|purse|wallet|crossbody|duffle/.test(t)) return 'bag'
  if (/ring|necklace|earring|bracelet|jewel|pendant|anklet|\bchain\b/.test(t)) return 'jewelry'
  if (/\bhat|\bcap\b|beanie|scarf|\bbelt|sunglass|\bsock|\btie\b/.test(t)) return 'accessory'
  if (/shirt|\btee\b|t-shirt|\btop\b|blouse|sweater|hoodie|knit|polo|sweatshirt|kurti|cardigan/.test(t)) return 'top'
  return 'other'
}

// Round-robin interleave across category buckets so tops, bottoms, dresses,
// shoes, bags etc. alternate rather than clumping.
function diversify(products: any[]): any[] {
  const buckets = new Map<string, any[]>()
  for (const p of products) {
    const c = categoryOf(p)
    if (!buckets.has(c)) buckets.set(c, [])
    buckets.get(c)!.push(p)
  }
  const lists = Array.from(buckets.values())
  const out: any[] = []
  let added = true
  while (added) {
    added = false
    for (const list of lists) {
      const item = list.shift()
      if (item) { out.push(item); added = true }
    }
  }
  return out
}

// Explore feed: a varied, geo-aware sample drawn from the WHOLE roster. Each
// page rotates to a different window of brands so the feed has real depth (it
// keeps surfacing new brands as the shopper scrolls), and results are
// interleaved by category so it's never just shoes.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const buyerCurrency: string = typeof body?.buyerCurrency === 'string' ? body.buyerCurrency.toUpperCase() : 'USD'
    const countryCode: string | null = (typeof body?.buyerCountry === 'string' && body.buyerCountry.trim()
      ? body.buyerCountry.trim().toUpperCase()
      : req.headers.get('x-vercel-ip-country') || req.headers.get('cf-ipcountry') || null)
    const page: number = Number.isFinite(body?.page) ? Math.max(0, Math.floor(body.page)) : 0
    const excludeIds: Set<string> = new Set(
      Array.isArray(body?.excludeIds) ? body.excludeIds.filter((x: any) => typeof x === 'string') : []
    )

    // Geo-prioritise the full roster: shopper's country first, then same region,
    // then everyone else — shuffled within each tier (seeded by page) so local
    // brands lead but the window rotates from page to page.
    const userRegion = countryCode ? (GEO_REGIONS[countryCode] ?? '') : ''
    const allDomains = UCP_REGISTRY.map(s => s.domain.toLowerCase().replace(/^www\./, ''))
    const geoRank = (d: string): number => {
      const c = getStoreCountry(d)
      if (countryCode && c === countryCode) return 2
      if (userRegion && GEO_REGIONS[c] === userRegion) return 1
      return 0
    }
    const tier2 = seededShuffle(allDomains.filter(d => geoRank(d) === 2), page * 7 + 11)
    const tier1 = seededShuffle(allDomains.filter(d => geoRank(d) === 1), page * 7 + 23)
    const tier0 = seededShuffle(allDomains.filter(d => geoRank(d) === 0), page * 7 + 37)
    const ordered = [...tier2, ...tier1, ...tier0]

    // A window of brands for this page; wraps around the roster on deep pages so
    // scrolling never truly runs out.
    const WINDOW = 24
    const start = ordered.length ? (page * WINDOW) % ordered.length : 0
    const sample = ordered.slice(start, start + WINDOW)
    if (sample.length < WINDOW) sample.push(...ordered.slice(0, WINDOW - sample.length))

    const products = await GlobalCatalogService.search(
      '',                       // empty query → browse each brand's catalog
      undefined, [], countryCode, true, [],
      'relevance', buyerCurrency,
      { fastFirstPage: true },
      sample,                    // restrict fan-out to this page's brand window
    )

    // In stock, not already shown, max 2 per brand so one store can't fill the grid.
    const perBrand = new Map<string, number>()
    const capped = products.filter(p => {
      if (!p.in_stock || excludeIds.has(p.id)) return false
      let dom = ''
      try { dom = new URL(p.store_url).hostname.replace(/^www\./, '') } catch {}
      const n = perBrand.get(dom) ?? 0
      if (n >= 2) return false
      perBrand.set(dom, n + 1)
      return true
    })

    return NextResponse.json({ products: diversify(capped).slice(0, 40) })
  } catch (e) {
    console.error('[featured] error:', e)
    return NextResponse.json({ products: [] })
  }
}
