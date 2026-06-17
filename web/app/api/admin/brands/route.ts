/**
 * Admin brand review — gated by CRON_SECRET (only you hold it).
 *
 * GET  /api/admin/brands            → list brands grouped by status
 * POST /api/admin/brands            → { domain, action: 'approve'|'reject', reason? }
 *
 * Approving flips the brand's products to published=TRUE so they go live in
 * shopper search; rejecting hides them.
 */

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db/client'

export const runtime = 'nodejs'
export const maxDuration = 30

function authorized(req: NextRequest): boolean {
  const secret = req.headers.get('x-cron-secret') ?? req.headers.get('authorization')?.replace('Bearer ', '')
  return Boolean(process.env.CRON_SECRET && secret === process.env.CRON_SECRET)
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'DB not configured' }, { status: 503 })

  try {
    const db = sql()
    const rows = await db`
      SELECT store_domain, display_name, status, product_count, tagline,
             logo_url, instagram, website, submitted_at, reviewed_at,
             rejection_reason, last_synced_at, sync_error
      FROM brand_accounts
      ORDER BY
        CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 WHEN 'rejected' THEN 2 ELSE 3 END,
        submitted_at DESC
    `
    const list = rows as any[]
    return NextResponse.json({
      pending:  list.filter(b => b.status === 'pending'),
      approved: list.filter(b => b.status === 'approved'),
      other:    list.filter(b => b.status !== 'pending' && b.status !== 'approved'),
      counts: {
        pending:  list.filter(b => b.status === 'pending').length,
        approved: list.filter(b => b.status === 'approved').length,
      },
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'DB not configured' }, { status: 503 })

  let body: { domain?: string; action?: string; reason?: string } = {}
  try { body = await req.json() } catch {}
  const domain = (body.domain ?? '').trim().toLowerCase()
  const action = body.action
  if (!domain || (action !== 'approve' && action !== 'reject')) {
    return NextResponse.json({ error: 'domain and action (approve|reject) required' }, { status: 400 })
  }

  try {
    const db = sql()
    const rows = await db`SELECT id, store_id FROM brand_accounts WHERE store_domain = ${domain} LIMIT 1`
    const brand = (rows as any[])[0]
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 })

    if (action === 'approve') {
      await db`
        UPDATE brand_accounts
        SET status = 'approved', reviewed_at = now(), rejection_reason = NULL, updated_at = now()
        WHERE id = ${brand.id}
      `
      await db`UPDATE products SET published = TRUE, updated_at = now() WHERE brand_account_id = ${brand.id}`
      if (brand.store_id) await db`UPDATE stores SET is_active = TRUE WHERE id = ${brand.store_id}`
      return NextResponse.json({ ok: true, domain, status: 'approved' })
    }

    // reject
    await db`
      UPDATE brand_accounts
      SET status = 'rejected', reviewed_at = now(), rejection_reason = ${body.reason ?? null}, updated_at = now()
      WHERE id = ${brand.id}
    `
    await db`UPDATE products SET published = FALSE, updated_at = now() WHERE brand_account_id = ${brand.id}`
    return NextResponse.json({ ok: true, domain, status: 'rejected' })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
