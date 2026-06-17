/**
 * Corpus-first search adapter.
 *
 * Bridges the persistent Postgres product corpus (lib/search/hybrid) to the
 * UcpProduct shape the chat/search frontend expects. Lets the main FROM search
 * read from the fast pre-crawled corpus when it's populated, and fall back to
 * the live UCP fan-out (GlobalCatalogService) when it isn't.
 */

import type { UcpProduct } from '../services/GlobalCatalogService'
import type { SearchFilters, SearchResult } from './hybrid'

// Minimum corpus hits required to serve a page from the corpus instead of
// falling back to the live fan-out. Below this we assume the corpus is empty
// or too sparse for this query and let the live search take over.
const MIN_CORPUS_HITS = 8

function asArray<T = unknown>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[]
  if (typeof v === 'string') {
    try { const p = JSON.parse(v); return Array.isArray(p) ? p : [] } catch { return [] }
  }
  return []
}

/** Map a corpus row to the UcpProduct shape the frontend renders. */
export function corpusToUcpProduct(p: SearchResult): UcpProduct {
  const images = asArray<string>(p.images)
  const media = images
    .filter(Boolean)
    .map(url => ({ type: 'image', url }))

  return {
    id: p.id,
    title: p.title,
    vendor: p.vendor,
    price: p.price_min ?? 0,
    currency: p.currency || 'USD',
    store_url: p.store_url,
    image_url: p.image_url,
    in_stock: p.in_stock ?? true,
    tags: asArray<string>(p.tags),
    description: p.description || undefined,
    options: asArray(p.options) as UcpProduct['options'],
    variants: asArray(p.variants) as UcpProduct['variants'],
    media: media.length ? media : undefined,
    // Carry the hybrid relevance through so downstream ordering stays sensible.
    relevance_score: typeof p.hybrid_score === 'number' ? p.hybrid_score : undefined,
  }
}

export type CorpusSearchArgs = {
  query: string
  limit: number
  offset: number
  filters: SearchFilters
}

/**
 * Try the corpus. Returns mapped products when the corpus is configured AND
 * returns enough hits to be worth serving; otherwise returns null so the caller
 * falls back to the live search.
 */
export async function searchCorpusOrNull(args: CorpusSearchArgs): Promise<UcpProduct[] | null> {
  if (!process.env.DATABASE_URL) return null

  try {
    // Lazy import so the live-only path never loads the pg driver.
    const { searchProducts } = await import('./hybrid')
    const rows = await searchProducts(args.query, {
      limit: args.limit,
      offset: args.offset,
      filters: args.filters,
    })
    if (rows.length < MIN_CORPUS_HITS) return null
    return rows.map(corpusToUcpProduct)
  } catch (err) {
    // Corpus unreachable / schema not set up yet — fall back to live search.
    console.warn('[corpusAdapter] corpus search failed, falling back to live', err)
    return null
  }
}
