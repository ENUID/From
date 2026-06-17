/**
 * GET /api/v2/products?q=...&gender=women&priceMin=50&priceMax=300&limit=24&offset=0
 *
 * Searches the persistent product corpus via hybrid FTS + vector search.
 * Dramatically faster than the query-time fan-out (ms vs 7s).
 */

import { NextRequest, NextResponse } from 'next/server'
import { searchProducts } from '@/lib/search/hybrid'
import type { SearchFilters } from '@/lib/search/hybrid'

export const runtime = 'nodejs'   // needs pgvector + fetch
export const maxDuration = 30

function parseGender(raw: string | null): SearchFilters['gender'] | undefined {
  if (!raw) return undefined
  const vals = raw.split(',').map(g => g.trim().toLowerCase())
  const valid = vals.filter((g): g is 'men' | 'women' | 'unisex' =>
    ['men', 'women', 'unisex'].includes(g)
  )
  return valid.length > 0 ? valid : undefined
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const query = (searchParams.get('q') ?? '').slice(0, 300)
  const limit  = Math.min(Number(searchParams.get('limit')  ?? 24), 48)
  const offset = Math.max(Number(searchParams.get('offset') ?? 0),   0)

  const filters: SearchFilters = {
    gender:      parseGender(searchParams.get('gender')),
    priceMin:    searchParams.get('priceMin')  ? Number(searchParams.get('priceMin'))  : undefined,
    priceMax:    searchParams.get('priceMax')  ? Number(searchParams.get('priceMax'))  : undefined,
    inStockOnly: searchParams.get('inStock') !== 'false',
  }

  try {
    const products = await searchProducts(query, { limit, offset, filters })

    // Parse JSON fields that come back as strings from the DB driver
    const parsed = products.map(p => ({
      ...p,
      images:   typeof p.images   === 'string' ? JSON.parse(p.images)   : p.images,
      options:  typeof p.options  === 'string' ? JSON.parse(p.options)  : p.options,
      variants: typeof p.variants === 'string' ? JSON.parse(p.variants) : p.variants,
    }))

    return NextResponse.json({
      products: parsed,
      meta: { query, limit, offset, count: parsed.length },
    })
  } catch (err) {
    console.error('[v2/products]', err)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
