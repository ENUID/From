/**
 * Ingest a connected brand's catalog into the shared product corpus.
 *
 * Connected products are marked source='connected' + verified=true and given a
 * quality boost, so they rank above anonymously-crawled products in shopper
 * search. Same Postgres table the shopper side already searches — connecting a
 * brand instantly makes its catalog discoverable.
 */

import { sql } from '../db/client'
import { embedProducts } from '../ingestion/embed'
import { fetchBrandCatalog } from './catalog'
import type { NormalizedProduct } from '../ingestion/normalize'

const EMBED_BATCH = 50
// Connected brands rank above crawled (default 0.5) but search relevance still decides order.
const CONNECTED_QUALITY = 0.8

export type BrandIngestResult = {
  fetched: number
  upserted: number
  error?: string
}

async function ensureStore(domain: string, displayName: string): Promise<string> {
  const db = sql()
  const rows = await db`
    INSERT INTO stores (domain, name)
    VALUES (${domain}, ${displayName})
    ON CONFLICT (domain) DO UPDATE SET name = EXCLUDED.name, updated_at = now()
    RETURNING id
  `
  return ((rows as any[])[0] as any).id as string
}

async function upsertConnectedProduct(
  db: ReturnType<typeof sql>,
  storeId: string,
  brandAccountId: string,
  p: NormalizedProduct,
  emb: number[] | null,
): Promise<boolean> {
  try {
    await db`
      INSERT INTO products (
        store_id, brand_account_id, source, verified, quality_score,
        external_id, title, vendor,
        price_min, price_max, currency,
        store_url, image_url, images,
        in_stock, tags, description,
        categories, gender, options, variants,
        crawled_at, updated_at
      ) VALUES (
        ${storeId}, ${brandAccountId}, 'connected', TRUE, ${CONNECTED_QUALITY},
        ${p.external_id}, ${p.title}, ${p.vendor},
        ${p.price_min}, ${p.price_max}, ${p.currency},
        ${p.store_url}, ${p.image_url}, ${JSON.stringify(p.images)},
        ${p.in_stock}, ${p.tags}, ${p.description},
        ${p.categories}, ${p.gender},
        ${JSON.stringify(p.options)}, ${JSON.stringify(p.variants)},
        now(), now()
      )
      ON CONFLICT (store_id, external_id) DO UPDATE SET
        brand_account_id = EXCLUDED.brand_account_id,
        source           = 'connected',
        verified         = TRUE,
        quality_score    = ${CONNECTED_QUALITY},
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

    if (emb) {
      const embLiteral = `[${emb.join(',')}]`
      await db.query(
        `UPDATE products SET embedding = '${embLiteral}'::vector
         WHERE store_id = $1 AND external_id = $2`,
        [storeId, p.external_id],
      )
    }
    return true
  } catch (err) {
    console.error('[ingestBrand] upsert failed for', p.external_id, (err as Error).message)
    return false
  }
}

/** Fetch + ingest one connected brand. Updates brand_accounts bookkeeping. */
export async function ingestConnectedBrand(args: {
  brandAccountId: string
  storeDomain: string
  publicDomain?: string | null
  displayName: string
  accessToken: string
}): Promise<BrandIngestResult> {
  const db = sql()
  try {
    const products = await fetchBrandCatalog(args.storeDomain, args.accessToken)
    const storeId = await ensureStore(args.publicDomain || args.storeDomain, args.displayName)

    // Tie the brand account to its store row.
    await db`UPDATE brand_accounts SET store_id = ${storeId}, updated_at = now() WHERE id = ${args.brandAccountId}`

    let upserted = 0
    for (let i = 0; i < products.length; i += EMBED_BATCH) {
      const chunk = products.slice(i, i + EMBED_BATCH)
      const embeddings = await embedProducts(chunk)
      for (let j = 0; j < chunk.length; j++) {
        if (await upsertConnectedProduct(db, storeId, args.brandAccountId, chunk[j], embeddings[j])) upserted++
      }
    }

    await db`
      UPDATE brand_accounts
      SET product_count = ${upserted}, last_synced_at = now(), sync_error = NULL, status = 'connected', updated_at = now()
      WHERE id = ${args.brandAccountId}
    `
    await db`UPDATE stores SET product_count = ${upserted}, last_crawled_at = now() WHERE id = ${storeId}`

    return { fetched: products.length, upserted }
  } catch (err) {
    const msg = (err as Error).message
    await db`UPDATE brand_accounts SET sync_error = ${msg}, status = 'error', updated_at = now() WHERE id = ${args.brandAccountId}`
      .catch(() => {})
    return { fetched: 0, upserted: 0, error: msg }
  }
}
