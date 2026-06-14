import { NextRequest, NextResponse } from 'next/server'
import { GlobalCatalogService } from '@/lib/services/GlobalCatalogService'
import { bestBrandDomains, brandQualityScore } from '@/lib/stores'

export const maxDuration = 60

// Featured rail: products from the best brands in the roster (hand-picked icons
// first, then luxury, then premium). Fans out to a rotating sample so the grid
// feels fresh on each visit without querying all ~86 brands every time.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const buyerCurrency: string = typeof body?.buyerCurrency === 'string' ? body.buyerCurrency.toUpperCase() : 'USD'
    const countryCode: string | null = (typeof body?.buyerCountry === 'string' && body.buyerCountry.trim()
      ? body.buyerCountry.trim().toUpperCase()
      : req.headers.get('x-vercel-ip-country') || req.headers.get('cf-ipcountry') || null)

    // Keep icons up front, shuffle the rest for variety, then take a sample that's
    // wide enough to fill a grid but small enough to stay fast.
    const all = bestBrandDomains()
    const icons = all.filter(d => brandQualityScore(d) === 3)
    const rest = all.filter(d => brandQualityScore(d) < 3)
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[rest[i], rest[j]] = [rest[j], rest[i]]
    }
    const sample = [...icons.slice(0, 8), ...rest].slice(0, 14)

    const products = await GlobalCatalogService.search(
      '',                       // empty query → browse each brand's catalog
      undefined, [], countryCode, true, [],
      'relevance', buyerCurrency,
      { fastFirstPage: true },
      sample,                    // restrict fan-out to the best brands
    )

    // Order icons' products first, then shuffle within each quality tier so the
    // same brand doesn't dominate the top of the grid.
    const inStock = products.filter(p => p.in_stock)
    const withScore = inStock.map(p => {
      let dom = ''
      try { dom = new URL(p.store_url).hostname.replace(/^www\./, '') } catch {}
      return { p, q: brandQualityScore(dom), r: Math.random() }
    })
    withScore.sort((a, b) => b.q - a.q || a.r - b.r)

    return NextResponse.json({ products: withScore.map(x => x.p).slice(0, 40) })
  } catch (e) {
    console.error('[featured] error:', e)
    return NextResponse.json({ products: [] })
  }
}
