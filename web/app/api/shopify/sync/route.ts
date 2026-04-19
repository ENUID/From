import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { ConvexHttpClient } from 'convex/browser'
import { authOptions } from '@/lib/auth'
import { api } from '@/lib/convexApi'
import { performShopifySync } from '@/lib/shopifySync'

function getConvex() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!url) throw new Error('NEXT_PUBLIC_CONVEX_URL is not set')
  return new ConvexHttpClient(url)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const merchantId = typeof body.merchantId === 'string' ? body.merchantId : null

  if (!merchantId) {
    return NextResponse.json({ error: 'Missing merchantId' }, { status: 400 })
  }

  let reconnectUrl = '/onboarding'
  try {
    const convex = getConvex()
    const merchant = await convex.query(api.merchants.getStoreForOwner, {
      owner_user_id: session.user.id,
      merchant_id: merchantId as any,
    }) as { shop_domain?: string } | null

    if (merchant?.shop_domain) {
      reconnectUrl = `/api/shopify/install?shop=${encodeURIComponent(merchant.shop_domain)}`
    }
  } catch {}

  try {
    const result = await performShopifySync(merchantId, session.user.id)
    return NextResponse.json({
      ...result,
      message: 'Sync successful',
    })
  } catch (err: any) {
    const msg = err?.message ?? String(err)
    console.error('Manual sync error:', msg)

    // Token-related errors -> tell user to reconnect.
    if (
      msg.includes('decryption failed') ||
      msg.includes('Decryption failed') ||
      msg.includes('Invalid encrypted Shopify token format') ||
      msg.includes('Unsupported state or unable to authenticate data') ||
      msg.includes('Invalid API key or access token') ||
      msg.includes('refresh token') ||
      msg.includes('token refresh failed') ||
      (msg.includes('token') && msg.includes('expired'))
    ) {
      return NextResponse.json({
        error: 'token_expired',
        message: `Shopify authentication failed: ${msg}. Try reconnecting your store.`,
        reconnect_url: reconnectUrl,
      }, { status: 401 })
    }

    // Store not in DB -> tell user to connect first.
    if (msg.includes('Merchant record') && msg.includes('not found')) {
      return NextResponse.json({
        error: 'store_not_found',
        message: 'No store found. Please connect your Shopify store first.',
        reconnect_url: reconnectUrl,
      }, { status: 404 })
    }

    return NextResponse.json({
      error: 'Sync failed',
      message: msg,
    }, { status: 500 })
  }
}
