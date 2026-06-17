/**
 * GET /api/brands/me — current connected brand + corpus stats for the dashboard.
 */

import { NextResponse } from 'next/server'
import { sql } from '@/lib/db/client'
import { getBrandSession } from '@/lib/brands/session'

export const runtime = 'nodejs'

export async function GET() {
  const domain = await getBrandSession()
  if (!domain) return NextResponse.json({ connected: false })

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ connected: true, store_domain: domain, db: false })
  }

  try {
    const db = sql()
    const rows = await db`
      SELECT store_domain, display_name, plan, status, product_count,
             tagline, bio, logo_url, hero_url, instagram, website,
             connected_at, last_synced_at, sync_error, reviewed_at, rejection_reason
      FROM brand_accounts WHERE store_domain = ${domain} LIMIT 1
    `
    const brand = (rows as any[])[0]
    if (!brand) return NextResponse.json({ connected: false })

    // Live in-corpus count (what shoppers can actually find right now).
    const live = await db`
      SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE in_stock) AS in_stock
      FROM products p
      JOIN brand_accounts b ON b.id = p.brand_account_id
      WHERE b.store_domain = ${domain}
    `
    return NextResponse.json({ connected: true, brand, live: (live as any[])[0] })
  } catch (err) {
    return NextResponse.json({ connected: true, store_domain: domain, error: (err as Error).message })
  }
}
