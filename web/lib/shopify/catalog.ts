/**
 * Pull a connected brand's full catalog from the Shopify Admin GraphQL API and
 * map it to the corpus NormalizedProduct shape. Authoritative data: real
 * inventory, real prices, real variants — straight from the brand's store.
 */

import { SHOPIFY_API_VERSION } from './oauth'
import type { NormalizedProduct } from '../ingestion/normalize'

const PAGE_SIZE = 50

const PRODUCTS_QUERY = `
query Products($cursor: String) {
  products(first: ${PAGE_SIZE}, after: $cursor, query: "status:active") {
    pageInfo { hasNextPage endCursor }
    nodes {
      id
      title
      handle
      vendor
      productType
      description
      tags
      onlineStoreUrl
      totalInventory
      priceRangeV2 {
        minVariantPrice { amount currencyCode }
        maxVariantPrice { amount currencyCode }
      }
      featuredImage { url }
      images(first: 20) { nodes { url altText } }
      options { name values }
      variants(first: 50) {
        nodes {
          id
          title
          availableForSale
          price
          selectedOptions { name value }
        }
      }
    }
  }
}`

type GqlVariant = {
  id: string
  title: string
  availableForSale: boolean
  price: string
  selectedOptions: { name: string; value: string }[]
}

type GqlProduct = {
  id: string
  title: string
  handle: string
  vendor: string
  productType: string
  description: string
  tags: string[]
  onlineStoreUrl: string | null
  totalInventory: number | null
  priceRangeV2: {
    minVariantPrice: { amount: string; currencyCode: string }
    maxVariantPrice: { amount: string; currencyCode: string }
  }
  featuredImage: { url: string } | null
  images: { nodes: { url: string; altText: string | null }[] }
  options: { name: string; values: string[] }[]
  variants: { nodes: GqlVariant[] }
}

async function gql<T>(shop: string, token: string, query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(`https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-Shopify-Access-Token': token,
    },
    body: JSON.stringify({ query, variables }),
  })
  if (!res.ok) throw new Error(`Shopify GraphQL ${res.status}: ${await res.text()}`)
  const json = await res.json() as { data?: T; errors?: unknown }
  if (json.errors) throw new Error(`Shopify GraphQL errors: ${JSON.stringify(json.errors)}`)
  return json.data as T
}

// Signals that an image is a model/lifestyle "best shot" (vs a flat packshot).
const MODEL_RE = /\b(model|worn|wearing|on[\s-]?body|on[\s-]?model|lifestyle|editorial|look\b|outfit|street|full[\s-]?length|campaign)\b/i
const FLAT_RE  = /\b(flat[\s-]?lay|packshot|product[\s-]?only|white[\s-]?background|ghost|still|swatch|detail|close[\s-]?up|back\b)\b/i

/** Order a product's images so the best model/lifestyle shot leads — that's the
 *  hero shown in the FROM feed. Falls back to the merchant's featured image, then
 *  original order. Pure heuristic (alt text + position); cheap, runs at ingest. */
function orderByBestShot(
  nodes: { url: string; altText: string | null }[],
  featuredUrl?: string,
): string[] {
  const seen = new Set<string>()
  const unique = nodes.filter(n => n.url && !seen.has(n.url) && seen.add(n.url))
  const scored = unique.map((n, i) => {
    const alt = n.altText ?? ''
    let score = -i * 0.1                       // gentle preference for original order
    if (MODEL_RE.test(alt)) score += 10
    if (FLAT_RE.test(alt)) score -= 6
    if (featuredUrl && n.url === featuredUrl) score += 3
    return { url: n.url, score }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored.map(s => s.url)
}

function inferGender(p: GqlProduct): string[] {
  const hay = `${p.title} ${p.productType} ${p.tags.join(' ')}`.toLowerCase()
  const g: string[] = []
  if (/\b(women|woman|womens|ladies|female|her)\b/.test(hay)) g.push('women')
  if (/\b(men|man|mens|male|him)\b/.test(hay)) g.push('men')
  return g.length ? g : ['unisex']
}

function toNormalized(p: GqlProduct, storeDomain: string): NormalizedProduct {
  const min = Number(p.priceRangeV2?.minVariantPrice?.amount ?? 0)
  const max = Number(p.priceRangeV2?.maxVariantPrice?.amount ?? min)
  const currency = p.priceRangeV2?.minVariantPrice?.currencyCode || 'USD'
  // Best model/lifestyle shot leads; full gallery preserved behind it.
  const images = orderByBestShot(p.images?.nodes ?? [], p.featuredImage?.url)
  const image = images[0] || p.featuredImage?.url || ''
  const externalId = p.id.split('/').pop() || p.handle

  return {
    external_id: externalId,
    title: p.title,
    vendor: p.vendor || p.title,
    price_min: min,
    price_max: max,
    currency,
    store_url: p.onlineStoreUrl || `https://${storeDomain}/products/${p.handle}`,
    image_url: image,
    images,
    in_stock: (p.totalInventory ?? 1) > 0 || p.variants.nodes.some(v => v.availableForSale),
    tags: (p.tags ?? []).slice(0, 25),
    description: (p.description ?? '').slice(0, 2000),
    categories: p.productType ? [p.productType] : [],
    gender: inferGender(p),
    options: (p.options ?? []).map(o => ({ name: o.name, values: o.values })),
    variants: (p.variants?.nodes ?? []).map(v => ({
      id: v.id.split('/').pop() || v.id,
      title: v.title,
      price: Number(v.price ?? min),
      availability: Boolean(v.availableForSale),
      options: (v.selectedOptions ?? []).map(o => ({ name: o.name, label: o.value })),
    })),
  }
}

const SINGLE_PRODUCT_QUERY = `
query Product($id: ID!) {
  product(id: $id) {
    id title handle vendor productType description tags onlineStoreUrl totalInventory
    priceRangeV2 { minVariantPrice { amount currencyCode } maxVariantPrice { amount currencyCode } }
    featuredImage { url }
    images(first: 20) { nodes { url altText } }
    options { name values }
    variants(first: 50) { nodes { id title availableForSale price selectedOptions { name value } } }
  }
}`

/** Fetch one product by numeric id (from a webhook), normalized for the corpus.
 *  Returns null if it no longer exists or has no image. */
export async function fetchProductById(
  shop: string, token: string, productId: string | number,
): Promise<NormalizedProduct | null> {
  const gid = String(productId).startsWith('gid://')
    ? String(productId)
    : `gid://shopify/Product/${productId}`
  const data = await gql<{ product: GqlProduct | null }>(shop, token, SINGLE_PRODUCT_QUERY, { id: gid })
  if (!data.product) return null
  const n = toNormalized(data.product, shop)
  return n.image_url ? n : null
}

/** Fetch every active product from a connected store, normalized for the corpus. */
export async function fetchBrandCatalog(shop: string, token: string): Promise<NormalizedProduct[]> {
  const out: NormalizedProduct[] = []
  let cursor: string | null = null

  // Hard page cap so a huge catalog can't run forever in a serverless function.
  for (let page = 0; page < 40; page++) {
    const data: { products: { pageInfo: { hasNextPage: boolean; endCursor: string }; nodes: GqlProduct[] } } =
      await gql(shop, token, PRODUCTS_QUERY, { cursor })

    for (const node of data.products.nodes) {
      const n = toNormalized(node, shop)
      if (n.image_url) out.push(n)   // skip imageless products — they look broken in the feed
    }

    if (!data.products.pageInfo.hasNextPage) break
    cursor = data.products.pageInfo.endCursor
  }

  return out
}
