import { UCP_STORES } from './stores'

export type SearchParams = {
  query: string
  budgetMax?: number
}

export type UcpProduct = {
  id: string
  title: string
  vendor: string
  price: number
  currency: string
  store_url: string
  image_url: string
  in_stock: boolean
  tags: string[]
}

async function fetchStoreUCP(domain: string, query: string): Promise<UcpProduct[]> {
  const endpoint = `https://${domain}/api/mcp`
  const payload = {
    jsonrpc: "2.0",
    id: "1",
    method: "tools/call",
    params: {
      name: "search_catalog",
      arguments: { query }
    }
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    if (!res.ok) return []

    const data = await res.json()
    const textContent = data.result?.content?.[0]?.text
    if (!textContent) return []

    const parsed = JSON.parse(textContent)
    if (!parsed.products || !Array.isArray(parsed.products)) return []

    return parsed.products.map((p: any) => {
      // The UCP schema usually returns a first variant with price
      const priceAmount = p.variants?.[0]?.price?.amount || 0
      const currency = p.variants?.[0]?.price?.currency || 'USD'
      const inStock = p.variants?.[0]?.availability?.available ?? true
      
      return {
        id: p.id,
        title: p.title,
        vendor: domain,
        price: priceAmount / 100, // Shopify UCP usually returns cents if it's integer, wait let's check
        // The output from the script showed "amount": 7500 which is $75.00
        currency,
        store_url: `https://${domain}/products/${p.handle || p.id.split('/').pop()}`,
        image_url: p.media?.[0]?.url || '',
        in_stock: inStock,
        tags: p.tags || []
      }
    })
  } catch (err) {
    console.error(`UCP Error for ${domain}:`, err)
    return []
  }
}

export async function searchUCP(params: SearchParams): Promise<UcpProduct[]> {
  console.log('Real UCP: Searching across stores with params:', params)
  
  // Query all stores in parallel
  const resultsArray = await Promise.all(
    UCP_STORES.map(store => fetchStoreUCP(store, params.query))
  )
  
  let allProducts = resultsArray.flat()

  // Apply budget filter
  if (params.budgetMax) {
    allProducts = allProducts.filter(p => p.price <= params.budgetMax!)
  }

  // Pick top 4 products
  allProducts = allProducts.slice(0, 4)

  // Add affiliate tracking IDs to the URLs
  return allProducts.map(product => {
    try {
      const urlObj = new URL(product.store_url)
      urlObj.searchParams.set('ref', 'from_ai_affiliate')
      return {
        ...product,
        store_url: urlObj.toString()
      }
    } catch {
      return product
    }
  })
}
