/**
 * Hybrid search: Postgres full-text search + pgvector cosine similarity.
 *
 * When OPENAI_API_KEY is set: embed the query → combine FTS + vector via RRF.
 * Without an API key: pure FTS (still very fast for fashion text).
 *
 * Reciprocal Rank Fusion: score = Σ 1/(k + rank_i), k=60 default.
 */

import { sql } from '../db/client'
import { embedBatch } from '../ingestion/embed'

export type SearchFilters = {
  gender?: ('men' | 'women' | 'unisex')[]
  priceMin?: number
  priceMax?: number
  inStockOnly?: boolean
  categories?: string[]
  stores?: string[]
}

export type SearchResult = {
  id: string
  store_id: string
  external_id: string
  title: string
  vendor: string
  price_min: number
  price_max: number
  currency: string
  store_url: string
  image_url: string
  images: string[] | string
  in_stock: boolean
  tags: string[]
  description: string
  gender: string[]
  options: unknown
  variants: unknown
  store_domain: string
  store_about: string
  fts_rank: number | null
  vec_distance: number | null
  hybrid_score: number
}

export type SearchOptions = {
  limit?: number
  offset?: number
  filters?: SearchFilters
}

const RRF_K = 60

function buildWhere(filters: SearchFilters, params: unknown[]): string {
  const clauses: string[] = [
    "p.image_url IS NOT NULL",
    "p.image_url != ''",
    // Connected products are hidden until their brand is approved; crawled
    // products default to published = TRUE so the existing corpus is unaffected.
    "p.published = TRUE",
  ]

  if (filters.inStockOnly !== false) clauses.push('p.in_stock = TRUE')

  if (filters.priceMin != null) {
    params.push(filters.priceMin)
    clauses.push(`p.price_min >= $${params.length}`)
  }
  if (filters.priceMax != null) {
    params.push(filters.priceMax)
    clauses.push(`p.price_max <= $${params.length}`)
  }
  if (filters.gender && filters.gender.length > 0) {
    params.push(filters.gender)
    clauses.push(`(p.gender && $${params.length}::text[] OR p.gender = '{}')`)
  }
  if (filters.stores && filters.stores.length > 0) {
    params.push(filters.stores)
    clauses.push(`s.domain = ANY($${params.length}::text[])`)
  }

  return clauses.join(' AND ')
}

function tsQueryString(query: string): string {
  return query
    .replace(/[^a-zA-Z0-9\s\-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w + ':*')
    .join(' & ')
}

async function embedQuery(query: string): Promise<number[] | null> {
  const results = await embedBatch([query])
  return results[0]?.embedding ?? null
}

const PRODUCT_SELECT = `
  p.id, p.store_id, p.external_id, p.title, p.vendor,
  p.price_min, p.price_max, p.currency,
  p.store_url, p.image_url, p.images::text AS images,
  p.in_stock, p.tags, p.description, p.gender,
  p.options::text AS options, p.variants::text AS variants,
  s.domain AS store_domain, COALESCE(s.about, '') AS store_about
`

export async function searchProducts(
  query: string,
  options: SearchOptions = {},
): Promise<SearchResult[]> {
  const { limit = 24, offset = 0, filters = {} } = options
  const db = sql()

  const queryEmbedding = query.trim()
    ? await embedQuery(query).catch(() => null)
    : null

  const params: unknown[] = []
  const whereStr = buildWhere(filters, params)

  // Empty query — return recent high-quality products
  if (!query.trim()) {
    const baseParamCount = params.length
    params.push(limit, offset)
    const rows = await db.query(
      `SELECT ${PRODUCT_SELECT},
              NULL::float AS fts_rank, NULL::float AS vec_distance,
              p.quality_score AS hybrid_score
       FROM products p
       JOIN stores s ON s.id = p.store_id
       WHERE ${whereStr}
       ORDER BY p.updated_at DESC, p.quality_score DESC
       LIMIT $${baseParamCount + 1} OFFSET $${baseParamCount + 2}`,
      params,
    )
    return (rows as any).rows as SearchResult[]
  }

  const tsq = tsQueryString(query)

  // Hybrid: FTS + vector RRF
  if (queryEmbedding) {
    const embStr = `[${queryEmbedding.join(',')}]`
    const baseCount = params.length

    // tsq and embStr are safe: tsq is derived from sanitized user input,
    // embStr is an array of floats from OpenAI.
    const rows = await db.query(
      `WITH
       fts AS (
         SELECT p.id,
           ts_rank_cd(p.fts_vector, to_tsquery('english', $${baseCount + 1})) AS rank
         FROM products p
         JOIN stores s ON s.id = p.store_id
         WHERE ${whereStr}
           AND p.fts_vector @@ to_tsquery('english', $${baseCount + 1})
         ORDER BY rank DESC
         LIMIT 100
       ),
       vec AS (
         SELECT p.id,
           1 - (p.embedding <=> '${embStr}'::vector) AS similarity
         FROM products p
         JOIN stores s ON s.id = p.store_id
         WHERE ${whereStr}
           AND p.embedding IS NOT NULL
         ORDER BY p.embedding <=> '${embStr}'::vector
         LIMIT 100
       ),
       fts_ranked AS (
         SELECT id, rank, row_number() OVER (ORDER BY rank DESC) AS rn FROM fts
       ),
       vec_ranked AS (
         SELECT id, similarity, row_number() OVER (ORDER BY similarity DESC) AS rn FROM vec
       ),
       rrf AS (
         SELECT
           COALESCE(f.id, v.id) AS id,
           COALESCE(1.0 / (${RRF_K} + f.rn), 0) + COALESCE(1.0 / (${RRF_K} + v.rn), 0) AS hybrid_score,
           f.rank AS fts_rank,
           v.similarity AS vec_similarity
         FROM fts_ranked f
         FULL OUTER JOIN vec_ranked v ON f.id = v.id
         ORDER BY hybrid_score DESC
         LIMIT $${baseCount + 2}
       )
       SELECT
         ${PRODUCT_SELECT},
         r.fts_rank, r.vec_similarity AS vec_distance,
         r.hybrid_score
       FROM rrf r
       JOIN products p ON p.id = r.id
       JOIN stores s ON s.id = p.store_id
       ORDER BY r.hybrid_score DESC
       LIMIT $${baseCount + 2} OFFSET $${baseCount + 3}`,
      [...params, tsq, limit + offset, offset],
    )
    return (rows as any).rows as SearchResult[]
  }

  // FTS only (no embedding key)
  const baseCount = params.length
  params.push(tsq, limit, offset)
  const rows = await db.query(
    `SELECT
       ${PRODUCT_SELECT},
       ts_rank_cd(p.fts_vector, to_tsquery('english', $${baseCount + 1})) AS fts_rank,
       NULL::float AS vec_distance,
       ts_rank_cd(p.fts_vector, to_tsquery('english', $${baseCount + 1})) * p.quality_score AS hybrid_score
     FROM products p
     JOIN stores s ON s.id = p.store_id
     WHERE ${whereStr}
       AND p.fts_vector @@ to_tsquery('english', $${baseCount + 1})
     ORDER BY hybrid_score DESC
     LIMIT $${baseCount + 2} OFFSET $${baseCount + 3}`,
    params,
  )
  return (rows as any).rows as SearchResult[]
}

export async function discoverProducts(
  seedEmbedding: number[],
  options: SearchOptions = {},
): Promise<SearchResult[]> {
  const { limit = 24, offset = 0, filters = {} } = options
  const db = sql()

  const params: unknown[] = []
  const whereStr = buildWhere(filters, params)
  const embStr = `[${seedEmbedding.join(',')}]`
  const baseCount = params.length
  params.push(limit, offset)

  const rows = await db.query(
    `SELECT
       ${PRODUCT_SELECT},
       NULL::float AS fts_rank,
       1 - (p.embedding <=> '${embStr}'::vector) AS vec_distance,
       (1 - (p.embedding <=> '${embStr}'::vector)) * p.quality_score AS hybrid_score
     FROM products p
     JOIN stores s ON s.id = p.store_id
     WHERE ${whereStr}
       AND p.embedding IS NOT NULL
     ORDER BY p.embedding <=> '${embStr}'::vector
     LIMIT $${baseCount + 1} OFFSET $${baseCount + 2}`,
    params,
  )
  return (rows as any).rows as SearchResult[]
}

export async function sampleProducts(options: SearchOptions = {}): Promise<SearchResult[]> {
  const { limit = 24, filters = {} } = options
  const db = sql()

  const params: unknown[] = []
  const whereStr = buildWhere(filters, params)
  const baseCount = params.length
  params.push(limit)

  const rows = await db.query(
    `SELECT
       ${PRODUCT_SELECT},
       NULL::float AS fts_rank, NULL::float AS vec_distance,
       p.quality_score AS hybrid_score
     FROM products p
     JOIN stores s ON s.id = p.store_id
     WHERE ${whereStr}
     ORDER BY RANDOM()
     LIMIT $${baseCount + 1}`,
    params,
  )
  return (rows as any).rows as SearchResult[]
}
