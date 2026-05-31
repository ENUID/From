const SERPER_API_KEY = "b5a9c1a8cc46160c25154293463cec8346dc90c0";
const UCP_STORES = ['www.allbirds.com', 'colourpop.com', 'gymshark.com'];

async function searchGoogleStores(query) {
  if (!SERPER_API_KEY) {
    console.warn('No SERPER_API_KEY found, falling back to whitelist.')
    return UCP_STORES
  }

  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': SERPER_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        q: `buy ${query} online store`,
        num: 10
      })
    })

    if (!res.ok) return UCP_STORES

    const json = await res.json()
    const domains = []
    
    if (json.organic) {
      for (const result of json.organic) {
        try {
          const urlObj = new URL(result.link)
          if (!['amazon.com', 'ebay.com', 'walmart.com', 'etsy.com', 'target.com'].includes(urlObj.hostname.replace('www.', ''))) {
            if (!domains.includes(urlObj.hostname)) {
              domains.push(urlObj.hostname)
            }
          }
        } catch (e) {}
      }
    }
    
    return [...new Set([...domains, ...UCP_STORES])].slice(0, 8)
  } catch (err) {
    return UCP_STORES
  }
}

async function fetchStoreUCP(domain, query) {
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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    })
    
    clearTimeout(timeoutId);

    if (!res.ok) {
        console.log(`[${domain}] HTTP Error ${res.status}`);
        return []
    }

    const data = await res.json()
    if (data.error) {
        console.log(`[${domain}] MCP Error:`, data.error.message);
        return [];
    }

    const textContent = data.result?.content?.[0]?.text
    if (!textContent) return []

    const parsed = JSON.parse(textContent)
    if (!parsed.products || !Array.isArray(parsed.products)) return []

    return parsed.products.map(p => ({
      title: p.title,
      vendor: domain
    }))
  } catch (err) {
    console.log(`[${domain}] Exception:`, err.message);
    return []
  }
}

async function searchUCP(query) {
  const targetDomains = await searchGoogleStores(query)
  console.log(`Found domains to query UCP:`, targetDomains)

  const resultsArray = await Promise.all(
    targetDomains.map(store => fetchStoreUCP(store, query))
  )
  
  let allProducts = resultsArray.flat()
  console.log('Final Products:', allProducts);
}

searchUCP("Minimalist ceramic home decor");
