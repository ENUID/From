/**
 * GET /api/v2/discover?gender=women&style=quiet-luxury&limit=24&offset=0
 *
 * Discovery feed — curated product stream based on aesthetic embedding or random sample.
 * Used for the visual browsing experience (no explicit search query required).
 *
 * When OPENAI_API_KEY is set: embeds the style description and returns semantically
 * similar products. Otherwise: returns a quality-scored random sample.
 */

import { NextRequest, NextResponse } from 'next/server'
import { discoverProducts, sampleProducts } from '@/lib/search/hybrid'
import { embedBatch } from '@/lib/ingestion/embed'
import type { SearchFilters } from '@/lib/search/hybrid'

export const runtime = 'nodejs'
export const maxDuration = 30

// Aesthetic descriptions used as seed embeddings for discovery feeds.
// These translate style shorthand into embeddable text.
const AESTHETIC_SEEDS: Record<string, string> = {
  'quiet-luxury':    'cashmere merino linen silk tailored minimalist neutral ivory stone camel navy no logo quiet luxury',
  'streetwear':      'oversized graphic tee hoodie cargo wide-leg sneakers drop shoulder urban streetwear',
  'dark-academia':   'tweed herringbone flannel wool blazer oxford collar burgundy forest green dark academia',
  'cottagecore':     'floral prairie flowy linen cotton puff sleeve romantic cottage garden feminine',
  'gorpcore':        'gore-tex nylon fleece technical trail outdoor functional cargo pocket utility',
  'minimalist':      'clean simple neutral white black grey structured tailored essentials basics',
  'heritage':        'selvedge denim workwear heritage canvas leather lace-up oxford natural fiber',
  'bohemian':        'flowy maxi wrap print ethnic embroidered tapestry natural earthy boho',
  'old-money':       'polo blazer chino loafer signet ring boat shoe Ralph Lauren prep club',
  'y2k':             'low-rise flare butterfly crop graphic rhinestone metallic 2000s nostalgia',
  'coastal':         'linen stripe nautical white navy blue sand beach resort easy breezy',
  'maximalist':      'bold print color clash statement pattern mix eccentric layered maximalist',
  'athleisure':      'legging sports bra hoodie jogger activewear athletic stretch performance',
  'clean-girl':      'slick back hair hoop earrings white tank match set clean minimal effortless',
  'ballet-core':     'ribbon wrap skirt tutu leotard pink bow soft satin feminine ballet',
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const style   = searchParams.get('style')?.toLowerCase().trim() ?? ''
  const gender  = searchParams.get('gender')?.split(',').filter(Boolean) as SearchFilters['gender']
  const limit   = Math.min(Number(searchParams.get('limit')  ?? 24), 48)
  const offset  = Math.max(Number(searchParams.get('offset') ?? 0),   0)
  const priceMax = searchParams.get('priceMax') ? Number(searchParams.get('priceMax')) : undefined

  const filters: SearchFilters = {
    gender,
    priceMax,
    inStockOnly: true,
  }

  try {
    // If we have a style with a known seed text, embed it and use vector discovery
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

    // Fallback: quality-scored sample
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
