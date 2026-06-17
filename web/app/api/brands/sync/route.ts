/**
 * POST /api/brands/sync — re-pull the connected brand's catalog into the corpus.
 * Brand-session protected.
 */

import { NextResponse } from 'next/server'
import { sql } from '@/lib/db/client'
import { getBrandSession } from '@/lib/brands/session'
import { ingestConnectedBrand } from '@/lib/shopify/ingestBrand'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST() {
  const domain = await getBrandSession()
  if (!domain) return NextResponse.json({ error: 'Not connected' }, { status: 401 })
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'DB not configured' }, { status: 503 })

  try {
    const db = sql()
    const rows = await db`
      SELECT id, store_domain, public_domain, display_name, access_token
      FROM brand_accounts WHERE store_domain = ${domain} LIMIT 1
    `
    const brand = (rows as any[])[0]
    if (!brand || !brand.access_token) {
      return NextResponse.json({ error: 'Brand not found or missing token' }, { status: 404 })
    }

    const result = await ingestConnectedBrand({
      brandAccountId: brand.id,
      storeDomain: brand.store_domain,
      publicDomain: brand.public_domain,
      displayName: brand.display_name || domain,
      accessToken: brand.access_token,
    })
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
