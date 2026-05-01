import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import crypto from 'crypto'
import { authOptions } from '@/lib/auth'
import { SHOPIFY_REQUIRED_SCOPE_STRING } from '@/lib/shopifyScopes'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const shop = req.nextUrl.searchParams.get('shop')

  if (!session?.user?.id) {
    console.warn('[Shopify Install] User ID missing from session, redirecting to login')
    const loginUrl = new URL('/merchant/login', req.url)
    if (shop) {
      loginUrl.searchParams.set('next', `/api/shopify/install?shop=${encodeURIComponent(shop)}`)
    }
    return NextResponse.redirect(loginUrl)
  }

  if (!shop) {
    return NextResponse.json({ error: 'Missing shop parameter' }, { status: 400 })
  }

  const shopDomain = shop.replace(/^https?:\/\//, '').replace(/\/$/, '')
  const fullDomain = shopDomain.endsWith('.myshopify.com')
    ? shopDomain
    : `${shopDomain}.myshopify.com`

  const clientId = process.env.SHOPIFY_CLIENT_ID!
  
  // Determine the base URL for the callback. 
  // Priority: 1. SHOPIFY_APP_URL, 2. Current host (if it's the store subdomain), 3. NEXTAUTH_URL
  const host = req.headers.get('host') || ''
  let baseUrl = process.env.SHOPIFY_APP_URL || process.env.NEXTAUTH_URL
  
  if (!process.env.SHOPIFY_APP_URL && host.startsWith('store.')) {
    const protocol = host.includes('localhost') ? 'http' : 'https'
    baseUrl = `${protocol}://${host}`
  }

  if (!baseUrl) {
    return NextResponse.json({ error: 'NEXTAUTH_URL or SHOPIFY_APP_URL environment variable is missing' }, { status: 500 })
  }
  
  const redirectUri = `${baseUrl.replace(/\/$/, '')}/api/shopify/callback`

  const nonce = crypto.randomBytes(16).toString('hex')
  const state = Buffer.from(JSON.stringify({
    nonce,
    userId: session.user.id,
    shop: fullDomain,
  })).toString('base64url')

  console.log(`[Shopify Auth Debug] baseUrl: ${baseUrl}, redirectUri: ${redirectUri}, clientId: ${clientId}`);

  const installUrl =
    `https://${fullDomain}/admin/oauth/authorize` +
    `?client_id=${clientId}` +
    `&scope=${SHOPIFY_REQUIRED_SCOPE_STRING}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${state}` +
    `&grant_options[]=offline`

  return NextResponse.redirect(installUrl)
}
