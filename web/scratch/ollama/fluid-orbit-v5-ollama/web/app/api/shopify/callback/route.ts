import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@convex/_generated/api'
import { encryptShopifySecret } from '@/lib/shopifyCrypto'

function getConvex() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!url) throw new Error('NEXT_PUBLIC_CONVEX_URL is not set')
  return new ConvexHttpClient(url)
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code = searchParams.get('code')
  const stateRaw = searchParams.get('state')
  const hmac = searchParams.get('hmac')
  const shop = searchParams.get('shop')

  if (!code || !stateRaw || !shop || !hmac) {
    return NextResponse.redirect(new URL('/merchant/stores?error=invalid_params', req.url))
  }

  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET!
  const params = Object.fromEntries(searchParams.entries())
  delete params.hmac
  const message = Object.keys(params).sort().map((key) => `${key}=${params[key]}`).join('&')
  const crypto = await import('crypto')
  const expectedHmac = crypto.createHmac('sha256', clientSecret).update(message).digest('hex')

  if (expectedHmac !== hmac) {
    return NextResponse.redirect(new URL('/merchant/stores?error=hmac_invalid', req.url))
  }

  let userId: string
  let expectedShop: string
  try {
    const parsed = JSON.parse(Buffer.from(stateRaw, 'base64url').toString())
    userId = parsed.userId
    expectedShop = parsed.shop
  } catch {
    return NextResponse.redirect(new URL('/merchant/stores?error=invalid_state', req.url))
  }

  if (expectedShop !== shop) {
    return NextResponse.redirect(new URL('/merchant/stores?error=shop_mismatch', req.url))
  }

  const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.SHOPIFY_CLIENT_ID,
      client_secret: clientSecret,
      code,
      expiring: 1,
    }),
  })

  if (!tokenRes.ok) {
    console.error('Token exchange failed:', await tokenRes.text())
    return NextResponse.redirect(new URL('/merchant/stores?error=token_exchange_failed', req.url))
  }

  const tokenData = await tokenRes.json() as {
    access_token: string
    expires_in?: number
    refresh_token?: string
    refresh_token_expires_in?: number
  }
  const { access_token, expires_in, refresh_token, refresh_token_expires_in } = tokenData

  const tokenExpiresAt = expires_in ? Date.now() + expires_in * 1000 : undefined
  const refreshTokenExpiresAt = refresh_token_expires_in
    ? Date.now() + refresh_token_expires_in * 1000
    : undefined

  let shopName = shop
  let currency = 'USD'
  let publicStoreDomain = shop
  try {
    const shopRes = await fetch(`https://${shop}/admin/api/2024-01/shop.json`, {
      headers: { 'X-Shopify-Access-Token': access_token },
    })
    const shopJson = await shopRes.json()
    shopName = shopJson?.shop?.name ?? shop
    currency = shopJson?.shop?.currency ?? 'USD'
    publicStoreDomain =
      shopJson?.shop?.primary_domain?.host ??
      shopJson?.shop?.domain ??
      shop
  } catch {}

  try {
    const convex = getConvex()
    await convex.mutation(api.merchants.saveStore, {
      owner_user_id: userId,
      shop_domain: shop,
      public_store_domain: publicStoreDomain,
      shop_name: shopName,
      access_token: encryptShopifySecret(access_token) ?? '',
      token_expires_at: tokenExpiresAt,
      refresh_token: encryptShopifySecret(refresh_token),
      refresh_token_expires_at: refreshTokenExpiresAt,
      currency,
      is_active: true,
    })
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error('Failed to save store:', errorMessage)
    return NextResponse.redirect(
      new URL(`/merchant/stores?error=save_failed&msg=${encodeURIComponent(errorMessage)}`, req.url)
    )
  }

  return NextResponse.redirect(new URL('/merchant/stores?connected=1', req.url))
}
