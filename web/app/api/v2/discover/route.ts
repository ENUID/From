/**
 * GET /api/v2/discover?gender=women&style=quiet-luxury&limit=24&offset=0
 *
 * Discovery feed — curated product stream.
 *
 * Mode A (DATABASE_URL set): pulls from Postgres corpus — instant, semantic.
 * Mode B (no DATABASE_URL): live UCP fan-out fallback — crawls 6 random stores,
 *   returns real products so the UI is always populated.
 */

import { NextRequest, NextResponse } from 'next/server'
import { discoverProducts, sampleProducts } from '@/lib/search/hybrid'
import { embedBatch } from '@/lib/ingestion/embed'
import { crawlStore } from '@/lib/ingestion/crawl'
import { CURATED_STORES } from '@/lib/ingestion/curatedStores'
import type { SearchFilters } from '@/lib/search/hybrid'
import type { NormalizedProduct } from '@/lib/ingestion/normalize'

export const runtime = 'nodejs'
export const maxDuration = 30

const AESTHETIC_SEEDS: Record<string, string> = {
  'quiet-luxury':    'cashmere merino linen silk tailored minimalist neutral ivory stone camel navy no logo quiet luxury',
  'streetwear':      'oversized graphic tee hoodie cargo wide-leg sneakers drop shoulder urban streetwear',
  'dark-academia':   'tweed herringbone flannel wool blazer oxford collar burgundy forest green dark academia',
  'cottagecore':     'floral prairie flowy linen cotton puff sleeve romantic cottage garden feminine',
  'gorpcore':        'gore-tex nylon fleece technical trail outdoor functional cargo pocket utility',
  'minimalist':      'clean simple neutral white black grey structured tailored essentials basics',
  'heritage':        'selvedge denim workwear heritage canvas leather lace-up oxford natural fiber',
  'bohemian':        'flowy maxi wrap print ethnic embroidered tapestry natural earthy boho',
  'old-money':       'polo blazer chino loafer signet ring boat shoe prep club classic',
  'y2k':             'low-rise flare butterfly crop graphic rhinestone metallic 2000s nostalgia',
  'coastal':         'linen stripe nautical white navy blue sand beach resort easy breezy',
  'maximalist':      'bold print color clash statement pattern mix eccentric layered maximalist',
  'athleisure':      'legging sports bra hoodie jogger activewear athletic stretch performance',
  'clean-girl':      'white tank match set clean minimal effortless gold hoop simple tidy',
  'ballet-core':     'ribbon wrap skirt tutu leotard pink bow soft satin feminine ballet',
}

// Map aesthetics to curated store vibes for better UCP fallback matching
const AESTHETIC_VIBES: Record<string, string[]> = {
  'quiet-luxury':  ['luxury', 'minimal', 'premium'],
  'streetwear':    ['streetwear', 'urban', 'graphic'],
  'gorpcore':      ['outdoor', 'surf', 'active'],
  'athleisure':    ['active', 'workout', 'sport'],
  'minimalist':    ['minimal', 'basics', 'ethical'],
  'heritage':      ['heritage', 'workwear', 'denim'],
  'coastal':       ['coastal', 'beach', 'resort'],
  'bohemian':      ['linen', 'feminine', 'resort'],
  'old-money':     ['prep', 'NYC', 'classic'],
  'ballet-core':   ['feminine', 'soft', 'minimal'],
  'clean-girl':    ['minimal', 'basics', 'inclusive'],
  'dark-academia': ['vintage', 'heritage', 'artisan'],
}

function pickStores(style: string, gender: string[], count: number) {
  const vibes = AESTHETIC_VIBES[style] ?? []
  const all = CURATED_STORES.filter(s => {
    if (gender.length > 0 && !gender.includes('all')) {
      const storeGender = s.gender ?? []
      if (!gender.some(g => storeGender.includes(g) || storeGender.includes('unisex'))) return false
    }
    return true
  })
  // Score by vibe match
  const scored = all.map(s => ({
    store: s,
    score: vibes.filter(v => s.vibe?.some(sv => sv.includes(v) || v.includes(sv))).length,
  })).sort((a, b) => b.score - a.score || Math.random() - 0.5)
  return scored.slice(0, count).map(s => s.store)
}

function normalizedToDiscoverProduct(p: NormalizedProduct, domain: string) {
  return {
    id: `ucp-${domain}-${p.external_id}`,
    store_id: domain,
    external_id: p.external_id,
    title: p.title,
    vendor: p.vendor,
    price_min: p.price_min,
    price_max: p.price_max,
    currency: p.currency,
    store_url: p.store_url,
    image_url: p.image_url,
    images: p.images,
    in_stock: p.in_stock,
    tags: p.tags,
    description: p.description,
    gender: p.gender,
    options: p.options,
    variants: p.variants,
    store_domain: domain,
    store_about: '',
  }
}

// Live UCP fallback — crawls a few stores and returns real products
async function ucpFallback(style: string, genderParam: string[], limit: number, offset: number) {
  const stores = pickStores(style, genderParam, 6)
  const results = await Promise.allSettled(
    stores.map(s => crawlStore(s.domain, s.gender, s.categories))
  )
  const all: ReturnType<typeof normalizedToDiscoverProduct>[] = []
  for (const r of results) {
    if (r.status === 'fulfilled' && !r.value.errored) {
      all.push(...r.value.products.map(p => normalizedToDiscoverProduct(p, r.value.domain)))
    }
  }
  // Shuffle for variety
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]]
  }
  return all.slice(offset, offset + limit)
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const style    = searchParams.get('style')?.toLowerCase().trim() ?? ''
  const genderParam = searchParams.get('gender')?.split(',').filter(Boolean) ?? []
  const gender   = genderParam as SearchFilters['gender']
  const limit    = Math.min(Number(searchParams.get('limit')  ?? 24), 48)
  const offset   = Math.max(Number(searchParams.get('offset') ?? 0),   0)
  const priceMax = searchParams.get('priceMax') ? Number(searchParams.get('priceMax')) : undefined

  // ── Mode B: no database — live UCP fallback ──────────────────────────────
  if (!process.env.DATABASE_URL) {
    try {
      const products = await ucpFallback(style, genderParam, limit, offset)
      return NextResponse.json({ products, meta: { style, limit, offset, mode: 'ucp-live' } })
    } catch (err) {
      console.error('[v2/discover] UCP fallback failed', err)
      return NextResponse.json({ products: [], meta: { style, mode: 'error' } })
    }
  }

  // ── Mode A: Postgres corpus ───────────────────────────────────────────────
  const filters: SearchFilters = { gender, priceMax, inStockOnly: true }

  try {
    const seedText = style ? AESTHETIC_SEEDS[style] ?? style : null

    if (seedText && process.env.OPENAI_API_KEY) {
      const results = await embedBatch([seedText])
      const embedding = results[0]?.embedding
      if (embedding) {
        const products = await discoverProducts(embedding, { limit, offset, filters })
        const parsed = products.map(p => ({
          ...p,
          images:   typeof p.images   === 'string' ? JSON.parse(p.images)   : p.images,
          options:  typeof p.options  === 'string' ? JSON.parse(p.options)  : p.options,
          variants: typeof p.variants === 'string' ? JSON.parse(p.variants) : p.variants,
        }))
        return NextResponse.json({ products: parsed, meta: { style, limit, offset, mode: 'vector' } })
      }
    }

    const products = await sampleProducts({ limit, offset, filters })
    const parsed = products.map(p => ({
      ...p,
      images:   typeof p.images   === 'string' ? JSON.parse(p.images)   : p.images,
      options:  typeof p.options  === 'string' ? JSON.parse(p.options)  : p.options,
      variants: typeof p.variants === 'string' ? JSON.parse(p.variants) : p.variants,
    }))
    return NextResponse.json({ products: parsed, meta: { style, limit, offset, mode: 'sample' } })

  } catch (err) {
    console.error('[v2/discover]', err)
    return NextResponse.json({ error: 'Discovery failed' }, { status: 500 })
  }
}
