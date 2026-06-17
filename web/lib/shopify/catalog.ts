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
      images(first: 8) { nodes { url } }
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
  images: { nodes: { url: string }[] }
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
  const images = (p.images?.nodes ?? []).map(n => n.url).filter(Boolean)
  const image = p.featuredImage?.url || images[0] || ''
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
    images: image && !images.includes(image) ? [image, ...images] : images,
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
