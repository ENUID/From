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

async function fetchShopifyProducts(shop: string, accessToken: string) {
  const products: ShopifyProduct[] = []
  let url: string | null =
    `https://${shop}/admin/api/${API_VERSION}/products.json?limit=250&fields=id,title,body_html,vendor,handle,product_type,tags,status,variants`

  while (url) {
    const res: Response = await fetch(url, { headers: { 'X-Shopify-Access-Token': accessToken } })
    if (!res.ok) break
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

    const accessToken = decryptShopifySecret(merchant.access_token)
    if (!accessToken) throw new Error('Access token decryption failed')

    const resShop: Response = await fetch(`https://${merchant.shop_domain}/admin/api/${API_VERSION}/shop.json`, {
      headers: { 'X-Shopify-Access-Token': accessToken },
    })
    const shopData = await resShop.json()

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
