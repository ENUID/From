import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { ConvexHttpClient } from 'convex/browser'
import { authOptions } from '@/lib/auth'
import { api } from '@/lib/convexApi'

type MerchantStoreRecord = {
  _id: string
}

function getConvex() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!url) throw new Error('NEXT_PUBLIC_CONVEX_URL is not set')
  return new ConvexHttpClient(url)
}

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const convex = getConvex()
    const stores = await convex.query(api.merchants.listByUser, {
      owner_user_id: session.user.id,
    }) as MerchantStoreRecord[]
    return NextResponse.json({ stores: stores ?? [] })
  } catch (err) {
    console.error('Convex query failed:', err)
    return NextResponse.json({ error: 'Failed to load stores' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const merchantId = typeof body.merchantId === 'string' ? body.merchantId : ''
  const shopName = typeof body.shop_name === 'string' ? body.shop_name.trim() : ''
  const publicStoreDomain = typeof body.public_store_domain === 'string'
    ? body.public_store_domain.trim()
    : undefined
  const currency = typeof body.currency === 'string' ? body.currency.trim().toUpperCase() : undefined

  if (!merchantId) {
    return NextResponse.json({ error: 'Missing merchantId' }, { status: 400 })
  }

  if (!shopName) {
    return NextResponse.json({ error: 'Store name is required' }, { status: 400 })
  }

  try {
    const convex = getConvex()
    const store = await convex.query(api.merchants.getStoreForOwner, {
      owner_user_id: session.user.id,
      merchant_id: merchantId as any,
    })

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    await convex.mutation(api.merchants.updateStoreProfile, {
      merchant_id: merchantId,
      shop_name: shopName,
      public_store_domain: publicStoreDomain,
      currency,
    })

    const stores = await convex.query(api.merchants.listByUser, {
      owner_user_id: session.user.id,
    }) as MerchantStoreRecord[]
    const updatedStore = (stores ?? []).find((item: MerchantStoreRecord) => item._id === merchantId) ?? null

    return NextResponse.json({ store: updatedStore })
  } catch (err) {
    console.error('Failed to update store:', err)
    return NextResponse.json({ error: 'Failed to update store' }, { status: 500 })
  }
}
