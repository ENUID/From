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

async function searchGoogleStores(query: string): Promise<string[]> {
  const apiKey = process.env.SERPER_API_KEY
  if (!apiKey) {
    console.warn('No SERPER_API_KEY found, falling back to whitelist.')
    return UCP_STORES
  }

  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        q: `buy ${query} online store`,
        num: 10
      })
    })

    if (!res.ok) return UCP_STORES

    const json = await res.json()
    const domains: string[] = []
    
    if (json.organic) {
      for (const result of json.organic) {
        try {
          const urlObj = new URL(result.link)
          // Exclude huge marketplaces that aren't single-store UCPs typically
          if (!['amazon.com', 'ebay.com', 'walmart.com', 'etsy.com', 'target.com'].includes(urlObj.hostname.replace('www.', ''))) {
            if (!domains.includes(urlObj.hostname)) {
              domains.push(urlObj.hostname)
            }
          }
        } catch (e) {}
      }
    }
    
    // Always include a few known good stores as fallback just in case Google only returns non-UCP stores
    return Array.from(new Set([...domains, ...UCP_STORES])).slice(0, 8)
  } catch (err) {
    console.error('Serper API error:', err)
    return UCP_STORES
  }
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
    // Timeout so we don't hang too long on bad domains
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    })
    
    clearTimeout(timeoutId);

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
        vendor: domain.replace('www.', ''),
        price: priceAmount / 100,
        currency,
        store_url: `https://${domain}/products/${p.handle || p.id.split('/').pop()}`,
        image_url: p.media?.[0]?.url || '',
        in_stock: inStock,
        tags: p.tags || []
      }
    })
  } catch (err) {
    // Silently fail for domains that don't support UCP or timeout
    return []
  }
}

export async function searchUCP(params: SearchParams): Promise<UcpProduct[]> {
  console.log('Real UCP: Searching dynamically via Google & UCP for params:', params)
  
  // 1. Discover domains
  const targetDomains = await searchGoogleStores(params.query)
  console.log(`Found domains to query UCP:`, targetDomains)

  // 2. Query discovered stores in parallel
  const resultsArray = await Promise.all(
    targetDomains.map(store => fetchStoreUCP(store, params.query))
  )
  
  let allProducts = resultsArray.flat()

  // Apply budget filter
  if (params.budgetMax) {
    allProducts = allProducts.filter(p => p.price <= params.budgetMax!)
  }

  // Deduplicate by title to avoid identical variants
  const seen = new Set()
  allProducts = allProducts.filter(p => {
    if (seen.has(p.title)) return false
    seen.add(p.title)
    return true
  })

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
