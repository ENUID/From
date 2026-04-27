import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { ConvexHttpClient } from 'convex/browser'
import { authOptions } from '@/lib/auth'
import { api } from '@/lib/convexApi'
import { isSupportedCurrency } from '@/lib/currency'
import { decryptShopifySecret } from '@/lib/shopifyCrypto'

type MerchantStoreRecord = {
  _id: string
  shop_name?: string
  shop_domain?: string
  public_store_domain?: string
  base_currency?: string
  currency?: string
  access_token?: string
}

function getConvex() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!url) throw new Error('NEXT_PUBLIC_CONVEX_URL is not set')
  return new ConvexHttpClient(url)
}

async function fetchShopifyMetadata(store: MerchantStoreRecord | null) {
  if (!store?.shop_domain || !store?.access_token) return null

  const accessToken = decryptShopifySecret(store.access_token)
  if (!accessToken) return null

  const res = await fetch(`https://${store.shop_domain}/admin/api/2024-04/shop.json`, {
    headers: { 'X-Shopify-Access-Token': accessToken },
    cache: 'no-store',
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Shopify shop metadata failed: ${res.status} ${errText}`)
  }

  const data = await res.json().catch(() => ({}))
  return {
    baseCurrency: typeof data?.shop?.currency === 'string' ? data.shop.currency.trim().toUpperCase() : undefined,
    publicStoreDomain:
      typeof data?.shop?.primary_domain?.host === 'string'
        ? data.shop.primary_domain.host.trim()
        : typeof data?.shop?.domain === 'string'
          ? data.shop.domain.trim()
          : undefined,
    shopName: typeof data?.shop?.name === 'string' ? data.shop.name.trim() : undefined,
  }
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

    const repairCandidates = await Promise.all(
      (stores ?? []).map(async (store) => {
        const rawStore = await convex.query(api.merchants.getStoreForOwner, {
          owner_user_id: session.user.id,
          merchant_id: store._id as any,
        }) as MerchantStoreRecord | null

        if (!rawStore) return null

        try {
          const metadata = await fetchShopifyMetadata(rawStore)
          if (!metadata?.baseCurrency) return null

          const shouldFillShopName = !rawStore.shop_name && !!metadata.shopName
          const shouldFillPublicDomain =
            !rawStore.public_store_domain && !!metadata.publicStoreDomain
          const shouldPatch =
            metadata.baseCurrency !== rawStore.base_currency
            || shouldFillPublicDomain
            || shouldFillShopName

          if (!shouldPatch) return null

          await convex.mutation(api.merchants.updateStoreProfile, {
            merchant_id: rawStore._id,
            shop_name: shouldFillShopName ? metadata.shopName : rawStore.shop_name,
            public_store_domain: shouldFillPublicDomain
              ? metadata.publicStoreDomain
              : rawStore.public_store_domain,
            base_currency: metadata.baseCurrency,
          })

          return rawStore._id
        } catch (err) {
          console.error(`Failed to repair store currency for ${rawStore._id}:`, err)
          return null
        }
      })
    )

    if (repairCandidates.some(Boolean)) {
      const refreshedStores = await convex.query(api.merchants.listByUser, {
        owner_user_id: session.user.id,
      }) as MerchantStoreRecord[]
      return NextResponse.json({ stores: refreshedStores ?? [] })
    }

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

  if (currency && !isSupportedCurrency(currency)) {
    return NextResponse.json({ error: 'Unsupported display currency' }, { status: 400 })
  }

  try {
    const convex = getConvex()
    const store = await convex.query(api.merchants.getStoreForOwner, {
      owner_user_id: session.user.id,
      merchant_id: merchantId as any,
    }) as MerchantStoreRecord | null

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    let resolvedBaseCurrency: string | undefined = store.base_currency
    try {
      const metadata = await fetchShopifyMetadata(store)
      if (metadata?.baseCurrency) {
        resolvedBaseCurrency = metadata.baseCurrency
      }
    } catch (err) {
      console.error(`Failed to refresh Shopify base currency for ${merchantId}:`, err)
    }

    await convex.mutation(api.merchants.updateStoreProfile, {
      merchant_id: merchantId,
      shop_name: shopName,
      public_store_domain: publicStoreDomain,
      base_currency: resolvedBaseCurrency,
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
