/**
 * Normalize a raw UCP/MCP product object into a clean DB row.
 * Replicates the parsing logic from GlobalCatalogService but outputs
 * a schema-friendly structure instead of UcpProduct.
 */

export type NormalizedProduct = {
  external_id: string
  title: string
  vendor: string
  price_min: number
  price_max: number
  currency: string
  store_url: string
  image_url: string
  images: string[]
  in_stock: boolean
  tags: string[]
  description: string
  categories: string[]
  gender: string[]
  options: Array<{ name: string; values: string[] }>
  variants: Array<{
    id: string
    title: string
    price: number
    availability: boolean
    options: Array<{ name: string; label: string }>
  }>
}

const ZERO_DECIMAL_CURRENCIES = new Set(['VND', 'JPY', 'KRW', 'IDR', 'CLP', 'HUF', 'TWD'])

function normalizeCurrency(c?: string | null): string {
  return String(c || 'USD').trim().toUpperCase() || 'USD'
}

function normalizeImageUrl(url?: string): string {
  if (!url) return ''
  let u = url.startsWith('//') ? `https:${url}` : url
  if (u.includes('cdn.shopify.com')) {
    try {
      const obj = new URL(u)
      obj.searchParams.set('width', '600')
      u = obj.toString()
    } catch {}
  }
  return u
}

function readAvailability(v: any): boolean | null {
  if (typeof v.availability?.available === 'boolean') return v.availability.available
  if (typeof v.available === 'boolean') return v.available
  if (typeof v.availableForSale === 'boolean') return v.availableForSale
  if (typeof v.available_for_sale === 'boolean') return v.available_for_sale
  if (typeof v.inventoryQuantity === 'number') return v.inventoryQuantity > 0
  return null
}

function cleanDomainToken(d: string): string {
  return d.toLowerCase().replace(/^www\./, '').replace(/[-_]/g, '').split('.')[0] ?? ''
}

export function normalizeProduct(raw: any, domain: string, storeGender: string[]): NormalizedProduct | null {
  try {
    const variant = raw.variants?.[0] ?? {}
    const currency = normalizeCurrency(variant.price?.currency ?? raw.price_range?.min?.currency)
    const isZero = ZERO_DECIMAL_CURRENCIES.has(currency)

    const parseAmount = (amt: number) => isZero ? amt : amt / 100

    const price = parseAmount(variant.price?.amount ?? raw.price_range?.min?.amount ?? 0)
    const priceMax = parseAmount(
      raw.price_range?.max?.amount ?? variant.price?.amount ?? raw.price_range?.min?.amount ?? 0
    )

    const token = cleanDomainToken(domain)
    let vendor = variant.seller?.name ?? variant.seller?.domain
    if (!vendor) vendor = token ? token.charAt(0).toUpperCase() + token.slice(1) : domain
    vendor = vendor || 'Independent'

    let store_url = variant.url ?? raw.url ?? ''
    if (store_url.startsWith('/')) {
      store_url = `https://${domain}${store_url}`
    } else if (!store_url) {
      const idPart = String(raw.id ?? '').split('/').pop()
      store_url = `https://${domain}/products/${idPart}`
    } else if (store_url && !store_url.startsWith('http')) {
      store_url = `https://${store_url}`
    }

    const descCandidates = [
      raw.description?.plain,
      variant.description?.plain,
      raw.metadata?.tech_specs,
    ].filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
    const description = descCandidates.length
      ? descCandidates.reduce((a, b) => (b.length > a.length ? b : a))
      : ''

    const allMedia: any[] = raw.media ?? []
    const images = allMedia
      .map((m: any) => normalizeImageUrl(m.url))
      .filter(Boolean)

    const image_url = images[0] ?? normalizeImageUrl(variant.media?.[0]?.url ?? '') ?? ''
    if (!image_url) return null

    const options = Array.isArray(raw.options)
      ? raw.options
          .map((o: any) => ({
            name: o.name,
            values: (o.values ?? []).map((v: any) => v.label ?? String(v)),
          }))
          .filter((o: any) => o.values.length > 0)
      : []

    const variants = (raw.variants ?? []).map((v: any) => {
      const vc = normalizeCurrency(v.price?.currency ?? currency)
      const vz = ZERO_DECIMAL_CURRENCIES.has(vc)
      const avail = readAvailability(v) ?? true
      return {
        id: String(v.id ?? ''),
        title: v.title ?? '',
        price: vz ? (v.price?.amount ?? 0) : ((v.price?.amount ?? 0) / 100),
        availability: avail,
        options: v.options ?? [],
      }
    })

    const inStock = variants.length > 0
      ? variants.some((v: { availability: boolean }) => v.availability)
      : (readAvailability(raw) ?? readAvailability(variant) ?? true)

    // Infer gender from tags + store profile
    const tagStr = (raw.tags ?? []).join(' ').toLowerCase()
    const gender: string[] = []
    if (tagStr.includes('women') || tagStr.includes("women's") || tagStr.includes('female')) {
      gender.push('women')
    }
    if (tagStr.includes('men') || tagStr.includes("men's") || tagStr.includes('male')) {
      if (!gender.includes('men')) gender.push('men')
    }
    if (gender.length === 0) gender.push(...storeGender)

    return {
      external_id: String(raw.id ?? ''),
      title: raw.title ?? 'Untitled',
      vendor,
      price_min: price,
      price_max: Math.max(price, priceMax),
      currency,
      store_url,
      image_url,
      images,
      in_stock: inStock,
      tags: raw.tags ?? [],
      description,
      categories: [],
      gender,
      options,
      variants,
    }
  } catch {
    return null
  }
}
