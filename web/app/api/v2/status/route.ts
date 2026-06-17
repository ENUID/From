/**
 * GET /api/v2/status
 *
 * Returns corpus health: product count, store count, last sync time.
 * Public endpoint — no auth required.
 */

import { NextResponse } from 'next/server'
import { sql } from '@/lib/db/client'

export const runtime = 'nodejs'
export const maxDuration = 10

export async function GET() {
  try {
    const db = sql()

    const [productRows, storeRows, syncRows] = await Promise.all([
      db`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE in_stock) AS in_stock,
              COUNT(*) FILTER (WHERE embedding IS NOT NULL) AS with_embedding
         FROM products`,
      db`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE is_active) AS active,
              COUNT(*) FILTER (WHERE last_crawled_at IS NOT NULL) AS crawled
         FROM stores`,
      db`SELECT started_at, finished_at, stores_succeeded, products_upserted, error
         FROM sync_log ORDER BY started_at DESC LIMIT 1`,
    ] as const)

    const pRow = (productRows as any[])[0] as any
    const sRow = (storeRows as any[])[0] as any
    const lRow = (syncRows as any[])[0] as any ?? null

    return NextResponse.json({
      products: pRow,
      stores:   sRow,
      lastSync: lRow,
      ready:    Number(pRow?.total ?? 0) > 0,
    })
  } catch (err) {
    // If DB isn't configured yet, return a helpful message
    const msg = (err as Error).message
    if (msg.includes('DATABASE_URL') || msg.includes('connect')) {
      return NextResponse.json({
        ready: false,
        message: 'Database not configured. Set DATABASE_URL and run db-setup.ts.',
      })
    }
    return NextResponse.json({ ready: false, error: msg }, { status: 500 })
  }
}
