/**
 * GET /api/brands/connect?shop=acme.myshopify.com
 *
 * Kicks off the Shopify OAuth handshake: validates the shop domain, sets a
 * signed state nonce cookie (CSRF guard), and redirects to Shopify's authorize
 * screen.
 */

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { buildInstallUrl, normalizeShopDomain, shopifyConfigured } from '@/lib/shopify/oauth'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  if (!shopifyConfigured()) {
    return NextResponse.json(
      { error: 'Shopify app not configured. Set SHOPIFY_API_KEY, SHOPIFY_API_SECRET, SHOPIFY_APP_URL.' },
      { status: 503 },
    )
  }

  const shop = normalizeShopDomain(req.nextUrl.searchParams.get('shop') ?? '')
  if (!shop) {
    return NextResponse.json({ error: 'Invalid shop domain. Use your-store.myshopify.com' }, { status: 400 })
  }

  const state = crypto.randomBytes(16).toString('hex')
  const res = NextResponse.redirect(buildInstallUrl(shop, state))
  res.cookies.set('from_oauth_state', state, {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 600,
  })
  res.cookies.set('from_oauth_shop', shop, {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 600,
  })
  return res
}
