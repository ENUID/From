export type MerchantStore = {
  _id: string
  shop_name: string
  shop_domain: string
  public_store_domain?: string
  base_currency?: string
  currency?: string
  is_active: boolean
}

export type MerchantProduct = {
  id: string
  title: string
  vendor: string
  handle: string
  store_url: string
  price: number
  currency?: string
  base_currency?: string
  tags: string[]
  in_stock: boolean
  description?: string
  product_type?: string
  merchant_id?: string
  variants: Array<{
    shopify_variant_id: string
    price: number
    title: string
    inventory_quantity: number
  }>
}

const STORES_KEY = 'merchant:stores'
const PRODUCTS_KEY_PREFIX = 'merchant:products:'
const TTL_MS = 30_000

type CacheEntry<T> = {
  ts: number
  data: T
}

function readCache<T>(key: string): T | null {
  if (typeof window === 'undefined') return null
  const raw = window.sessionStorage.getItem(key)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as CacheEntry<T>
    if (Date.now() - parsed.ts > TTL_MS) {
      window.sessionStorage.removeItem(key)
      return null
    }
    return parsed.data
  } catch {
    window.sessionStorage.removeItem(key)
    return null
  }
}

function writeCache<T>(key: string, data: T) {
  if (typeof window === 'undefined') return
  const payload: CacheEntry<T> = { ts: Date.now(), data }
  window.sessionStorage.setItem(key, JSON.stringify(payload))
}

function scopedKey(base: string, scope: string) {
  return `${base}:${scope}`
}

async function readJsonOrThrow(res: Response) {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(
      typeof data.error === 'string' && data.error.trim()
        ? data.error
        : `Request failed with status ${res.status}`
    )
  }
  return data
}

export async function loadStores(scope: string, force = false): Promise<MerchantStore[]> {
  const key = scopedKey(STORES_KEY, scope)
  if (!force) {
    const cached = readCache<MerchantStore[]>(key)
    if (cached) return cached
  }
  const res = await fetch('/api/merchant/stores')
  const data = await readJsonOrThrow(res)
  const stores = data.stores ?? []
  writeCache(key, stores)
  return stores
}

export async function loadProducts(scope: string, merchantId: string, force = false): Promise<{ count: number; products: MerchantProduct[] }> {
  const key = scopedKey(`${PRODUCTS_KEY_PREFIX}${merchantId}`, scope)
  if (!force) {
    const cached = readCache<{ count: number; products: MerchantProduct[] }>(key)
    if (cached) return cached
  }
  const res = await fetch(`/api/merchant/products?merchantId=${merchantId}`)
  const data = await readJsonOrThrow(res)
  const payload = { count: data.count ?? 0, products: data.products ?? [] }
  writeCache(key, payload)
  return payload
}

export function primeProductsCache(scope: string, merchantId: string, payload: { count: number; products: MerchantProduct[] }) {
  writeCache(scopedKey(`${PRODUCTS_KEY_PREFIX}${merchantId}`, scope), payload)
}
