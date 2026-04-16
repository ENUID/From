import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { performShopifySync } from '@/lib/shopifySync'

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

  try {
    const result = await performShopifySync(merchantId, session.user.id)
    return NextResponse.json({
      ...result,
      message: 'Sync successful'
    })
  } catch (err: any) {
    const msg = err?.message ?? String(err)
    console.error('Manual sync error:', msg)
    
    // Token-related errors → tell user to reconnect
    if (
      msg === 'Access token decryption failed' ||
      msg === 'Invalid encrypted Shopify token format' ||
      msg.includes('Invalid API key or access token') ||
      msg.includes('token') && msg.includes('expired')
    ) {
      return NextResponse.json({
        error: 'token_expired',
        message: 'The Shopify access token is missing, corrupted, or has expired.',
        reconnect_url: '/merchant/onboarding'
      }, { status: 401 })
    }

    // Store not in DB → tell user to connect first
    if (msg.includes('Merchant record') && msg.includes('not found')) {
      return NextResponse.json({
        error: 'store_not_found',
        message: 'No store found. Please connect your Shopify store first.',
        reconnect_url: '/merchant/onboarding'
      }, { status: 404 })
    }

    return NextResponse.json({ 
      error: 'Sync failed', 
      message: msg 
    }, { status: 500 })
  }
}
