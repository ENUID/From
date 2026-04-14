import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import crypto from 'crypto'
import { authOptions } from '@/lib/auth'

const SCOPES = 'read_products,read_inventory,read_product_listings'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.redirect(new URL('/merchant/login', req.url))
  }

  const shop = req.nextUrl.searchParams.get('shop')
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
  let baseUrl = process.env.NEXTAUTH_URL
  
  if (process.env.SHOPIFY_APP_URL) {
    baseUrl = process.env.SHOPIFY_APP_URL
  } else if (host.startsWith('store.')) {
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

  const installUrl =
    `https://${fullDomain}/admin/oauth/authorize` +
    `?client_id=${clientId}` +
    `&scope=${SCOPES}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${state}` +
    `&grant_options[]=offline`

  return NextResponse.redirect(installUrl)
}
