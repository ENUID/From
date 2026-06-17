/**
 * Catalog sync orchestrator.
 *
 * 1. Upsert store records from CURATED_STORES.
 * 2. Crawl each store via UCP/MCP in parallel batches.
 * 3. Generate embeddings in batches.
 * 4. Upsert products into Postgres.
 * 5. Write sync_log entry.
 */

import { sql } from '../db/client'
import { crawlStore } from './crawl'
import { embedProducts } from './embed'
import { CURATED_STORES } from './curatedStores'
import type { NormalizedProduct } from './normalize'

const CRAWL_CONCURRENCY = 8
const EMBED_BATCH = 50

export type SyncReport = {
  storesAttempted: number
  storesSucceeded: number
  productsUpserted: number
  errors: string[]
  durationMs: number
}

async function upsertStore(
  domain: string,
  name: string,
  categories: string[],
  gender: string[],
  priceRange: string,
  vibe: string[],
  about: string,
): Promise<string> {
  const db = sql()
  const rows = await db`
    INSERT INTO stores (domain, name, categories, gender, price_range, vibe, about)
    VALUES (${domain}, ${name}, ${categories}, ${gender}, ${priceRange}, ${vibe}, ${about})
    ON CONFLICT (domain) DO UPDATE SET
      name        = EXCLUDED.name,
      categories  = EXCLUDED.categories,
      gender      = EXCLUDED.gender,
      price_range = EXCLUDED.price_range,
      vibe        = EXCLUDED.vibe,
      about       = EXCLUDED.about,
      updated_at  = now()
    RETURNING id
  `
  return ((rows as any[])[0] as any).id as string
}

async function upsertProduct(
  db: ReturnType<typeof sql>,
  storeId: string,
  p: NormalizedProduct,
  emb: number[] | null,
): Promise<boolean> {
  try {
    // Upsert core fields (no embedding yet)
    await db`
      INSERT INTO products (
        store_id, external_id, title, vendor,
        price_min, price_max, currency,
        store_url, image_url, images,
        in_stock, tags, description,
        categories, gender, options, variants,
        crawled_at, updated_at
      ) VALUES (
        ${storeId}, ${p.external_id}, ${p.title}, ${p.vendor},
        ${p.price_min}, ${p.price_max}, ${p.currency},
        ${p.store_url}, ${p.image_url}, ${JSON.stringify(p.images)},
        ${p.in_stock}, ${p.tags}, ${p.description},
        ${p.categories}, ${p.gender},
        ${JSON.stringify(p.options)}, ${JSON.stringify(p.variants)},
        now(), now()
      )
      ON CONFLICT (store_id, external_id) DO UPDATE SET
        title       = EXCLUDED.title,
        vendor      = EXCLUDED.vendor,
        price_min   = EXCLUDED.price_min,
        price_max   = EXCLUDED.price_max,
        currency    = EXCLUDED.currency,
        store_url   = EXCLUDED.store_url,
        image_url   = EXCLUDED.image_url,
        images      = EXCLUDED.images,
        in_stock    = EXCLUDED.in_stock,
        tags        = EXCLUDED.tags,
        description = EXCLUDED.description,
        gender      = EXCLUDED.gender,
        options     = EXCLUDED.options,
        variants    = EXCLUDED.variants,
        updated_at  = now()
    `

    // Update embedding separately (requires raw SQL for vector cast)
    if (emb) {
      const embLiteral = `[${emb.join(',')}]`
      // Vectors can't be parameterized — use query() with safe float-only string
      await db.query(
        `UPDATE products SET embedding = '${embLiteral}'::vector
         WHERE store_id = $1 AND external_id = $2 AND embedding IS NULL`,
        [storeId, p.external_id],
      )
    }

    return true
  } catch (err) {
    console.error('[sync] upsert failed for', p.external_id, (err as Error).message)
    return false
  }
}

async function upsertProducts(
  storeId: string,
  products: NormalizedProduct[],
  embeddings: Array<number[] | null>,
): Promise<number> {
  if (products.length === 0) return 0
  const db = sql()
  let count = 0

  for (let i = 0; i < products.length; i++) {
    const ok = await upsertProduct(db, storeId, products[i], embeddings[i])
    if (ok) count++
  }

  await db`
    UPDATE stores
    SET product_count = ${count}, last_crawled_at = now(), crawl_error = NULL
    WHERE id = ${storeId}
  `

  return count
}

async function writeSyncLog(
  startedAt: Date,
  storesAttempted: number,
  storesSucceeded: number,
  productsUpserted: number,
  error?: string,
) {
  try {
    const db = sql()
    await db`
      INSERT INTO sync_log (started_at, finished_at, stores_attempted, stores_succeeded, products_upserted, error)
      VALUES (${startedAt.toISOString()}, now(), ${storesAttempted}, ${storesSucceeded}, ${productsUpserted}, ${error ?? null})
    `
  } catch (err) {
    console.error('[sync] could not write sync_log:', (err as Error).message)
  }
}

export async function runSync(
  domains?: string[],
  dryRun = false,
): Promise<SyncReport> {
  const startedAt = new Date()
  const startMs = Date.now()
  const errors: string[] = []
  let storesSucceeded = 0
  let totalProducts = 0

  const stores = domains
    ? CURATED_STORES.filter(s => domains.includes(s.domain))
    : CURATED_STORES

  for (let i = 0; i < stores.length; i += CRAWL_CONCURRENCY) {
    const batch = stores.slice(i, i + CRAWL_CONCURRENCY)

    await Promise.all(batch.map(async store => {
      try {
        console.log(`[sync] crawling ${store.domain}`)
        const { products, rawCount, errored } = await crawlStore(
          store.domain,
          store.gender,
          store.categories,
        )

        if (errored) {
          errors.push(`${store.domain}: MCP unreachable`)
          const db = sql()
          await db`
            UPDATE stores SET crawl_error = 'MCP unreachable', last_crawled_at = now()
            WHERE domain = ${store.domain}
          `.catch(() => {})
          return
        }

        console.log(`[sync] ${store.domain}: ${rawCount} raw → ${products.length} normalized`)

        if (dryRun) {
          storesSucceeded++
          totalProducts += products.length
          return
        }

        const storeId = await upsertStore(
          store.domain, store.name, store.categories,
          store.gender, store.priceRange, store.vibe, store.about,
        )

        const allEmbeddings: Array<number[] | null> = []
        for (let j = 0; j < products.length; j += EMBED_BATCH) {
          const chunk = products.slice(j, j + EMBED_BATCH)
          const embeddings = await embedProducts(chunk)
          allEmbeddings.push(...embeddings)
        }

        const upserted = await upsertProducts(storeId, products, allEmbeddings)
        storesSucceeded++
        totalProducts += upserted
        console.log(`[sync] ${store.domain}: upserted ${upserted} products`)

      } catch (err) {
        const msg = (err as Error).message
        errors.push(`${store.domain}: ${msg}`)
        console.error(`[sync] ${store.domain} failed:`, msg)
      }
    }))
  }

  if (!dryRun) {
    await writeSyncLog(startedAt, stores.length, storesSucceeded, totalProducts, errors.join('; ') || undefined)
  }

  return {
    storesAttempted: stores.length,
    storesSucceeded,
    productsUpserted: totalProducts,
    errors,
    durationMs: Date.now() - startMs,
  }
}
