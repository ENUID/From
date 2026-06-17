/**
 * GET /api/brands/connect/callback
 *
 * Shopify redirects here after the brand approves. We verify the HMAC + state,
 * exchange the code for a permanent admin token, persist the brand account,
 * issue the brand session cookie, kick off the first catalog ingest, and send
 * the brand to their dashboard.
 */

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db/client'
import {
  exchangeCodeForToken, normalizeShopDomain, verifyOAuthHmac, shopifyConfigured,
} from '@/lib/shopify/oauth'
import { ingestConnectedBrand } from '@/lib/shopify/ingestBrand'
import { registerWebhooks } from '@/lib/shopify/webhooks'
import { signBrandToken, BRAND_COOKIE, BRAND_COOKIE_MAX_AGE } from '@/lib/brands/session'

export const runtime = 'nodejs'
export const maxDuration = 300

function fail(req: NextRequest, reason: string) {
  const url = new URL('/brands', req.url)
  url.searchParams.set('error', reason)
  return NextResponse.redirect(url)
}

export async function GET(req: NextRequest) {
  if (!shopifyConfigured()) return fail(req, 'not_configured')

  const params = Object.fromEntries(req.nextUrl.searchParams.entries())
  const shop = normalizeShopDomain(params.shop ?? '')
  if (!shop) return fail(req, 'bad_shop')

  // CSRF: state must match the cookie we set, and shop must match too.
  const cookieState = req.cookies.get('from_oauth_state')?.value
  const cookieShop = req.cookies.get('from_oauth_shop')?.value
  if (!params.state || params.state !== cookieState || cookieShop !== shop) {
    return fail(req, 'state_mismatch')
  }
  if (!verifyOAuthHmac(params)) return fail(req, 'hmac_failed')
  if (!params.code) return fail(req, 'no_code')

  if (!process.env.DATABASE_URL) return fail(req, 'db_unconfigured')

  try {
    const { access_token, scope } = await exchangeCodeForToken(shop, params.code)
    const displayName = shop.replace(/\.myshopify\.com$/, '')

    const db = sql()
    const rows = await db`
      INSERT INTO brand_accounts (store_domain, display_name, platform, access_token, scope, status)
      VALUES (${shop}, ${displayName}, 'shopify', ${access_token}, ${scope}, 'connected')
      ON CONFLICT (store_domain) DO UPDATE SET
        access_token = EXCLUDED.access_token,
        scope        = EXCLUDED.scope,
        status       = 'connected',
        updated_at   = now()
      RETURNING id
    `
    const brandAccountId = ((rows as any[])[0] as any).id as string

    // Register real-time webhooks (best-effort — never block connect on this).
    await registerWebhooks(shop, access_token).catch(() => 0)

    // First ingest — pull their catalog into the corpus right away.
    const result = await ingestConnectedBrand({
      brandAccountId,
      storeDomain: shop,
      displayName,
      accessToken: access_token,
    })

    const dest = new URL('/brands', req.url)
    dest.searchParams.set('connected', '1')
    dest.searchParams.set('synced', String(result.upserted))
    const res = NextResponse.redirect(dest)
    res.cookies.set(BRAND_COOKIE, signBrandToken(shop), {
      httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: BRAND_COOKIE_MAX_AGE,
    })
    res.cookies.delete('from_oauth_state')
    res.cookies.delete('from_oauth_shop')
    return res
  } catch (err) {
    console.error('[brands/callback]', err)
    return fail(req, 'exchange_failed')
  }
}
