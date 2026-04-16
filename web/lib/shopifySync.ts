import { ConvexHttpClient } from 'convex/browser'
import { decryptShopifySecret, encryptShopifySecret } from '@/lib/shopifyCrypto'
import { api } from '@/lib/convexApi'

const API_VERSION = '2024-04'

function getConvex() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!url) throw new Error('NEXT_PUBLIC_CONVEX_URL is not set')
  return new ConvexHttpClient(url)
}

type MerchantSyncRecord = {
  _id: string
  access_token: string
  refresh_token?: string
  refresh_token_expires_at?: number
  token_expires_at?: number
  shop_domain: string
  owner_user_id: string
  shop_name: string
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

class TokenError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TokenError'
  }
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
  if (!refreshToken) throw new TokenError('Shopify refresh token is missing. Please reconnect your store.')
  if (isRefreshTokenExpired(merchant)) throw new TokenError('Shopify refresh token has expired. Please reconnect your store.')

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
    const errText = await res.text().catch(() => '')
    throw new TokenError(`Shopify token refresh failed: ${res.status} ${errText}`)
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
    `https://${shop}/admin/api/${API_VERSION}/products.json?limit=250&fields=id,title,body_html,vendor,handle,product_type,tags,status,variants`

  while (url) {
    const res: Response = await fetch(url, { headers: { 'X-Shopify-Access-Token': accessToken } })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      if (res.status === 401 || res.status === 403) {
        throw new TokenError('Invalid API key or access token')
      }
      throw new Error(`Shopify products failed: ${res.status} ${errText}`)
    }
    const data = await res.json()
    products.push(...(data.products ?? []))
    const link = res.headers.get('Link') ?? ''
    const next = link.match(/<([^>]+)>;\s*rel="next"/)
    url = next ? next[1] : null
  }
  return products
}

export async function performShopifySync(merchantId: string, userId: string) {
  const convex = getConvex()
  
  try {
    const merchant = await convex.query(api.merchants.getStoreForSync, {
      merchant_id: merchantId as any,
      owner_user_id: userId,
    }) as any

    if (!merchant) throw new Error(`Merchant record ${merchantId} not found or permission denied.`)

    // AUTO-REPAIR: Claim orphaned store
    if (merchant.owner_user_id === 'undefined' || !merchant.owner_user_id) {
       console.log(`[Sync] Claiming orphaned store for user: ${userId}`);
       await convex.mutation(api.merchants.updateStoreProfile, {
         merchant_id: merchant._id,
         owner_user_id: userId,
         shop_name: merchant.shop_name,
       })
       merchant.owner_user_id = userId
    }

    if (merchant.owner_user_id !== userId) {
      throw new Error(`Ownership mismatch. Please contact support.`)
    }

    if (isTokenExpired(merchant)) {
      console.log(`[Sync] Token expired for ${merchant.shop_domain}, refreshing...`)
      const refreshed = await refreshShopifyToken(merchant)
      
      const encryptedAccess = encryptShopifySecret(refreshed.access_token)
      if (!encryptedAccess) throw new Error('Failed to encrypt new access token during refresh.')

      await convex.mutation(api.merchants.updateToken, {
        merchant_id: merchant._id,
        access_token: encryptedAccess,
        token_expires_at: refreshed.token_expires_at,
        refresh_token: encryptShopifySecret(refreshed.refresh_token),
        refresh_token_expires_at: refreshed.refresh_token_expires_at,
      })

      merchant.access_token = encryptedAccess
      merchant.token_expires_at = refreshed.token_expires_at
      merchant.refresh_token = encryptShopifySecret(refreshed.refresh_token)
      merchant.refresh_token_expires_at = refreshed.refresh_token_expires_at
    }

    const accessToken = decryptShopifySecret(merchant.access_token)
    if (!accessToken) {
      throw new Error(`Access token decryption failed for ${merchant.shop_domain}. Format check: ${merchant.access_token?.substring(0, 10)}...`)
    }

    const resShop: Response = await fetch(`https://${merchant.shop_domain}/admin/api/${API_VERSION}/shop.json`, {
      headers: { 'X-Shopify-Access-Token': accessToken },
    })
    if (!resShop.ok) {
      const errText = await resShop.text().catch(() => '');
      if (resShop.status === 401 || resShop.status === 403) {
        throw new TokenError('Invalid API key or access token')
      }
      throw new Error(`Shopify API failed: ${resShop.status} ${errText}`)
    }
    const shopData = await resShop.json().catch(() => ({}))

    await convex.mutation(api.merchants.updateStoreProfile, {
      merchant_id: merchant._id,
      shop_name: shopData?.shop?.name ?? merchant.shop_name,
      currency: shopData?.shop?.currency ?? 'USD',
      public_store_domain: shopData?.shop?.primary_domain?.host ?? shopData?.shop?.domain ?? merchant.shop_domain,
    })

    const shopifyProducts = await fetchShopifyProducts(merchant.shop_domain, accessToken)
    let synced = 0
    const activeIds: string[] = []

    for (const product of shopifyProducts) {
      if (product.status !== 'active') continue
      activeIds.push(String(product.id))

      try {
        const productId = await convex.mutation(api.merchants.upsertProduct, {
          merchant_id: merchant._id,
          shopify_product_id: String(product.id),
          title: product.title ?? '',
          description: product.body_html ? product.body_html.replace(/<[^>]*>/g, '').trim().slice(0, 1000) : '',
          vendor: product.vendor ?? '',
          handle: product.handle ?? '',
          product_type: product.product_type ?? '',
          tags: typeof product.tags === 'string' ? product.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
          status: 'active',
        })

        for (const variant of product.variants ?? []) {
          await convex.mutation(api.merchants.upsertVariant, {
            product_id: productId as string,
            merchant_id: merchant._id,
            shopify_variant_id: String(variant.id),
            title: variant.title ?? 'Default',
            price: parseFloat(variant.price ?? '0'),
            inventory_quantity: variant.inventory_quantity ?? 0,
            inventory_policy: variant.inventory_policy ?? 'deny',
          })
        }
        synced++
      } catch (err: any) {
        console.error(`[Sync] Failed product ${product.id}:`, err.message)
      }
    }

    await convex.mutation(api.merchants.deactivateMissingProducts, {
      merchant_id: merchant._id,
      active_shopify_product_ids: activeIds,
    })

    await convex.mutation(api.merchants.recordSyncResult, {
      merchant_id: merchant._id,
    })

    return { synced, total: shopifyProducts.length }

  } catch (err: any) {
    console.error(`[Sync Error]:`, err.message)
    try {
      await convex.mutation(api.merchants.recordSyncResult, {
        merchant_id: merchantId as any,
        error: err.message,
      })
    } catch {}
    throw err
  }
}
