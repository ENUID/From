/**
 * POST /api/brands/webhook — Shopify pushes catalog changes here.
 *
 * Verifies the HMAC, identifies the connected brand by shop domain, and applies
 * the change to the corpus in real time:
 *   products/create|update → re-fetch that product and upsert
 *   products/delete        → remove it
 *   app/uninstalled        → mark the brand disconnected, drop the token
 */

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db/client'
import { verifyWebhookHmac } from '@/lib/shopify/oauth'
import { fetchProductById } from '@/lib/shopify/catalog'
import { ingestProducts, deleteConnectedProduct } from '@/lib/shopify/ingestBrand'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  const raw = await req.text()
  const hmac = req.headers.get('x-shopify-hmac-sha256')
  if (!verifyWebhookHmac(raw, hmac)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const topic = req.headers.get('x-shopify-topic') ?? ''
  const shop = req.headers.get('x-shopify-shop-domain') ?? ''
  if (!shop) return NextResponse.json({ ok: true })   // ack anything we can't route

  // Always 200 quickly on config gaps so Shopify doesn't retry-storm us.
  if (!process.env.DATABASE_URL) return NextResponse.json({ ok: true })

  let payload: Record<string, unknown> = {}
  try { payload = JSON.parse(raw) } catch {}

  try {
    const db = sql()
    const rows = await db`
      SELECT id, store_id, access_token, status FROM brand_accounts WHERE store_domain = ${shop} LIMIT 1
    `
    const brand = (rows as any[])[0]
    if (!brand) return NextResponse.json({ ok: true })

    if (topic === 'app/uninstalled') {
      await db`UPDATE brand_accounts SET status = 'disconnected', access_token = NULL, updated_at = now() WHERE id = ${brand.id}`
      return NextResponse.json({ ok: true, action: 'uninstalled' })
    }

    if (!brand.store_id) return NextResponse.json({ ok: true })
    const externalId = String(payload.id ?? '')

    if (topic === 'products/delete') {
      if (externalId) await deleteConnectedProduct(brand.store_id, externalId)
      return NextResponse.json({ ok: true, action: 'deleted' })
    }

    if (topic === 'products/create' || topic === 'products/update') {
      if (!brand.access_token || !externalId) return NextResponse.json({ ok: true })
      const product = await fetchProductById(shop, brand.access_token, externalId)
      if (product) {
        await ingestProducts(brand.store_id, brand.id, [product], brand.status === 'approved')
      } else {
        // Went unavailable/out of catalog — remove it from search.
        await deleteConnectedProduct(brand.store_id, externalId)
      }
      return NextResponse.json({ ok: true, action: 'upserted' })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[brands/webhook]', err)
    // Still 200 — a 500 makes Shopify retry; we'll catch up on next full sync.
    return NextResponse.json({ ok: true })
  }
}
