import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'
import { authOptions } from '@/lib/auth'
import { decryptShopifySecret, encryptShopifySecret } from '@/lib/shopifyCrypto'

function getConvex() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!url) throw new Error('NEXT_PUBLIC_CONVEX_URL is not set')
  return new ConvexHttpClient(url)
}

type MerchantSyncRecord = {
  _id: Id<'merchants'>
  access_token: string
  refresh_token?: string
  refresh_token_expires_at?: number
  token_expires_at?: number
  shop_domain: string
}

type ShopifyVariant = {
  id: number
  title?: string
  price?: string
  inventory_quantity?: number
  inventory_policy?: string
}

type ShopifyProduct = {
  id: number
  title?: string
  body_html?: string
  vendor?: string
  handle?: string
  product_type?: string
  tags?: string
  status?: string
  variants?: ShopifyVariant[]
}

function isTokenExpired(merchant: MerchantSyncRecord) {
  if (!merchant.token_expires_at) return false
  return Date.now() > merchant.token_expires_at - 5 * 60 * 1000
}

function isRefreshTokenExpired(merchant: MerchantSyncRecord) {
  if (!merchant.refresh_token_expires_at) return false
  return Date.now() > merchant.refresh_token_expires_at - 5 * 60 * 1000
}

async function refreshShopifyToken(merchant: MerchantSyncRecord) {
  const refreshToken = decryptShopifySecret(merchant.refresh_token)
  if (!refreshToken) {
    throw new TokenError('Shopify refresh token is missing. Please reconnect your store.')
  }
  if (isRefreshTokenExpired(merchant)) {
    throw new TokenError('Shopify refresh token has expired. Please reconnect your store.')
  }

  const res = await fetch(`https://${merchant.shop_domain}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.SHOPIFY_CLIENT_ID,
      client_secret: process.env.SHOPIFY_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    console.error(`Shopify refresh ${res.status}:`, errText)
    throw new TokenError('Shopify access token refresh failed. Please reconnect your store.')
  }

  const data = await res.json() as {
    access_token: string
    expires_in?: number
    refresh_token?: string
    refresh_token_expires_in?: number
  }

  return {
    access_token: data.access_token,
    token_expires_at: data.expires_in ? Date.now() + Number(data.expires_in) * 1000 : undefined,
    refresh_token: data.refresh_token,
    refresh_token_expires_at: data.refresh_token_expires_in
      ? Date.now() + Number(data.refresh_token_expires_in) * 1000
      : undefined,
  }
}

async function fetchShopifyProducts(shop: string, accessToken: string) {
  const products: ShopifyProduct[] = []
  let url: string | null =
    `https://${shop}/admin/api/2024-01/products.json?limit=250&fields=id,title,body_html,vendor,handle,product_type,tags,status,variants`

  while (url) {
    const res: Response = await fetch(url, { headers: { 'X-Shopify-Access-Token': accessToken } })

    if (!res.ok) {
      const errText = await res.text()
      console.error(`Shopify ${res.status}:`, errText)

      if (res.status === 401 || res.status === 403) {
        throw new TokenError('Shopify access token is expired or invalid. Please reconnect your store.')
      }
      break
    }

    const data = await res.json() as { products?: ShopifyProduct[] }
    products.push(...(data.products ?? []))

    const link = res.headers.get('Link') ?? ''
    const next = link.match(/<([^>]+)>;\s*rel="next"/)
    url = next ? next[1] : null
  }

  return products
}

async function fetchShopifyShopInfo(shop: string, accessToken: string) {
  const res: Response = await fetch(`https://${shop}/admin/api/2024-01/shop.json`, {
    headers: { 'X-Shopify-Access-Token': accessToken },
  })

  if (!res.ok) {
    const errText = await res.text()
    console.error(`Shop info ${res.status}:`, errText)
    if (res.status === 401 || res.status === 403) {
      throw new TokenError('Shopify access token is expired or invalid. Please reconnect your store.')
    }
    throw new Error('Failed to fetch shop info')
  }

  const data = await res.json()
  return {
    shopName: data?.shop?.name ?? shop,
    currency: data?.shop?.currency ?? 'USD',
    publicStoreDomain: data?.shop?.primary_domain?.host ?? data?.shop?.domain ?? shop,
  }
}

class TokenError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TokenError'
  }
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

  const convex = getConvex()

  let merchant: MerchantSyncRecord | null = null
  try {
    merchant = await convex.query(api.merchants.getStoreForOwner, {
      owner_user_id: session.user.id,
      merchant_id: merchantId as Id<'merchants'>,
    }) as MerchantSyncRecord | null
  } catch {
    return NextResponse.json({ error: 'Failed to fetch stores' }, { status: 500 })
  }

  if (!merchant) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 })
  }

  if (isTokenExpired(merchant)) {
    try {
      const refreshed = await refreshShopifyToken(merchant)
      await convex.mutation(api.merchants.updateToken, {
        merchant_id: merchant._id,
        access_token: encryptShopifySecret(refreshed.access_token) ?? refreshed.access_token,
        token_expires_at: refreshed.token_expires_at,
        refresh_token: encryptShopifySecret(refreshed.refresh_token),
        refresh_token_expires_at: refreshed.refresh_token_expires_at,
      })
      merchant = {
        ...merchant,
        access_token: encryptShopifySecret(refreshed.access_token) ?? refreshed.access_token,
        refresh_token: encryptShopifySecret(refreshed.refresh_token),
        token_expires_at: refreshed.token_expires_at,
        refresh_token_expires_at: refreshed.refresh_token_expires_at,
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error
        ? err.message
        : 'Your Shopify access token has expired. Please reconnect your store to continue syncing.'
      return NextResponse.json({
        error: 'token_expired',
        message: errorMessage,
        reconnect_url: `/api/shopify/install?shop=${merchant.shop_domain}`,
      }, { status: 401 })
    }
  }

  let shopifyProducts: ShopifyProduct[]
  let shopInfo: { shopName: string; currency: string; publicStoreDomain: string } | null = null
  try {
    const accessToken = decryptShopifySecret(merchant.access_token)
    if (!accessToken) {
      throw new TokenError('Shopify access token is missing. Please reconnect your store.')
    }
    shopInfo = await fetchShopifyShopInfo(merchant.shop_domain, accessToken)
    shopifyProducts = await fetchShopifyProducts(merchant.shop_domain, accessToken)
  } catch (err: unknown) {
    if (err instanceof TokenError) {
      return NextResponse.json({
        error: 'token_expired',
        message: err.message,
        reconnect_url: `/api/shopify/install?shop=${merchant.shop_domain}`,
      }, { status: 401 })
    }
    return NextResponse.json({ error: 'Failed to fetch from Shopify' }, { status: 502 })
  }

  if (shopInfo) {
    await convex.mutation(api.merchants.updateStoreProfile, {
      merchant_id: merchant._id,
      shop_name: shopInfo.shopName,
      currency: shopInfo.currency,
      public_store_domain: shopInfo.publicStoreDomain,
    }).catch((err: unknown) => {
      const errorMessage = err instanceof Error ? err.message : String(err)
      console.error('Failed to update store profile:', errorMessage)
    })
  }

  let synced = 0
  let failed = 0
  const activeShopifyProductIds: string[] = []

  for (const product of shopifyProducts) {
    if (product.status !== 'active') continue
    activeShopifyProductIds.push(String(product.id))

    try {
      const productId = await convex.mutation(api.merchants.upsertProduct, {
        merchant_id: merchantId,
        shopify_product_id: String(product.id),
        title: product.title ?? '',
        description: product.body_html ? product.body_html.replace(/<[^>]*>/g, '').trim().slice(0, 1000) : '',
        vendor: product.vendor ?? '',
        handle: product.handle ?? '',
        product_type: product.product_type ?? '',
        tags: typeof product.tags === 'string'
          ? product.tags.split(',').map((tag) => tag.trim()).filter(Boolean)
          : [],
        status: 'active',
      })

      for (const variant of product.variants ?? []) {
        await convex.mutation(api.merchants.upsertVariant, {
          product_id: productId,
          merchant_id: merchantId,
          shopify_variant_id: String(variant.id),
          title: variant.title ?? 'Default',
          price: parseFloat(variant.price ?? '0'),
          inventory_quantity: variant.inventory_quantity ?? 0,
          inventory_policy: variant.inventory_policy ?? 'deny',
        })
      }

      synced++
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      console.error('Failed to save product:', product.title, errorMessage)
      failed++
    }
  }

  await convex.mutation(api.merchants.deactivateMissingProducts, {
    merchant_id: merchantId,
    active_shopify_product_ids: activeShopifyProductIds,
  })

  return NextResponse.json({
    synced,
    failed,
    total: shopifyProducts.length,
    embedding_mode: 'worker',
  })
}
