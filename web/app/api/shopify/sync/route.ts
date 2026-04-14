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
    console.error('Manual sync error:', err.message)
    
    if (err.message.includes('token') || err.message.includes('expired')) {
      return NextResponse.json({
        error: 'token_expired',
        message: err.message
      }, { status: 401 })
    }

    return NextResponse.json({ 
      error: 'Sync failed', 
      message: err.message 
    }, { status: 500 })
  }
}
