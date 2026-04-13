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

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const merchantId = req.nextUrl.searchParams.get('merchantId')
  if (!merchantId) {
    return NextResponse.json({ count: 0 })
  }

  try {
    const convex = getConvex()
    const stores = await convex.query(api.merchants.listByUser, {
      owner_user_id: session.user.id,
    }) as MerchantStoreRecord[]
    const hasAccess = (stores ?? []).some((store: MerchantStoreRecord) => store._id === merchantId)

    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const products = await convex.query(api.merchants.listProducts, { merchant_id: merchantId })
    return NextResponse.json({ count: products?.length ?? 0, products: products ?? [] })
  } catch {
    return NextResponse.json({ count: 0, products: [] })
  }
}
