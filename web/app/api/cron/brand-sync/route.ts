/**
 * GET /api/cron/brand-sync — periodic safety-net re-sync of connected brands.
 *
 * Webhooks keep the corpus live in real time, but a missed webhook (downtime,
 * Shopify hiccup) would leave a product stale. This sweep re-pulls every active
 * connected brand so data is never more than one cron interval out of date.
 * Secured by CRON_SECRET.
 */

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db/client'
import { ingestConnectedBrand } from '@/lib/shopify/ingestBrand'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'DB not configured' }, { status: 503 })

  try {
    const db = sql()
    // Refresh approved (live) and pending (so their preview stays current) brands.
    const rows = await db`
      SELECT id, store_domain, public_domain, display_name, access_token
      FROM brand_accounts
      WHERE status IN ('approved', 'pending') AND access_token IS NOT NULL
      ORDER BY last_synced_at ASC NULLS FIRST
      LIMIT 25
    `
    const brands = rows as any[]

    const results: { domain: string; upserted: number; error?: string }[] = []
    for (const b of brands) {
      const r = await ingestConnectedBrand({
        brandAccountId: b.id,
        storeDomain: b.store_domain,
        publicDomain: b.public_domain,
        displayName: b.display_name || b.store_domain,
        accessToken: b.access_token,
      })
      results.push({ domain: b.store_domain, upserted: r.upserted, error: r.error })
    }

    return NextResponse.json({ ok: true, synced: results.length, results })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
