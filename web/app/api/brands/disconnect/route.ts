/**
 * POST /api/brands/disconnect — clear the brand session and mark the account
 * disconnected. Leaves already-synced products in place (they simply stop
 * refreshing) so the shopper feed doesn't suddenly gap.
 */

import { NextResponse } from 'next/server'
import { sql } from '@/lib/db/client'
import { getBrandSession, BRAND_COOKIE } from '@/lib/brands/session'

export const runtime = 'nodejs'

export async function POST() {
  const domain = await getBrandSession()
  if (domain && process.env.DATABASE_URL) {
    try {
      const db = sql()
      await db`UPDATE brand_accounts SET status = 'disconnected', updated_at = now() WHERE store_domain = ${domain}`
    } catch { /* best effort */ }
  }
  const res = NextResponse.json({ ok: true })
  res.cookies.delete(BRAND_COOKIE)
  return res
}
