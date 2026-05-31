// Mock the environment
process.env.SERPER_API_KEY = "b5a9c1a8cc46160c25154293463cec8346dc90c0";

async function runTest() {
  const args = {
    coreProduct: "bowl",
    attributes: ["ceramic", "minimalist", "white"],
    searchQuery: "minimalist white ceramic bowl"
  };

  const res = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': process.env.SERPER_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      q: `buy ${args.searchQuery} independent online store`,
      num: 10
    })
  });
  
  const json = await res.json();
  const domains = [];
  const excludeList = ['amazon.com', 'ebay.com', 'walmart.com', 'etsy.com', 'target.com', 'pinterest.com'];
  for (const result of json.organic || []) {
    try {
      const urlObj = new URL(result.link);
      const hostname = urlObj.hostname.replace('www.', '');
      if (!excludeList.includes(hostname) && !domains.includes(hostname)) {
        domains.push(hostname);
      }
    } catch (e) {}
  }
  const finalDomains = domains.slice(0, 8);
  console.log("Discovered domains:", finalDomains);

  const nestedProducts = await Promise.all(
    finalDomains.map(async (domain) => {
      const endpoint = `https://${domain}/api/mcp`;
      const payload = {
        jsonrpc: "2.0", id: "1", method: "tools/call",
        params: { name: "search_catalog", arguments: { query: args.searchQuery } }
      };
      try {
        const fetchRes = await fetch(endpoint, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        if (!fetchRes.ok) return [];
        const data = await fetchRes.json();
        const textContent = data.result?.content?.[0]?.text;
        if (!textContent) return [];
        const parsedInner = JSON.parse(textContent);
        if (!parsedInner.products) return [];
        
        return parsedInner.products.map(p => ({
          id: p.id, title: p.title, vendor: domain, price: 0, currency: 'USD',
          store_url: p.url, image_url: '', in_stock: true, tags: p.tags || []
        }));
      } catch (e) { return []; }
    })
  );

  let allProducts = nestedProducts.flat();
  console.log("Raw products fetched:", allProducts.length);

  function getWordVariants(word) {
    const w = word.toLowerCase();
    const variants = [w];
    if (w.endsWith('s')) variants.push(w.slice(0, -1));
    else variants.push(w + 's');
    if (w.endsWith('es')) variants.push(w.slice(0, -2));
    else if (w.endsWith('y')) variants.push(w.slice(0, -1) + 'ies');
    return variants;
  }
  
  const coreVariants = getWordVariants(args.coreProduct);
  const scoredProducts = allProducts.map(p => {
    let score = 0;
    const searchSpace = `${p.title} ${p.vendor} ${(p.tags || []).join(' ')}`.toLowerCase();
    const hasCoreProduct = coreVariants.some(variant => searchSpace.includes(variant));
    if (hasCoreProduct) score += 10;
    
    args.attributes.forEach(attr => {
      if (searchSpace.includes(attr.toLowerCase())) score += 2;
    });
    if (searchSpace.includes(args.searchQuery.toLowerCase())) score += 5;
    
    return { title: p.title, score, hasCoreProduct };
  });

  console.log("Scored products (Top 5):", scoredProducts.sort((a,b) => b.score - a.score).slice(0, 5));
  const topProducts = scoredProducts.filter(p => p.score >= 10);
  console.log("Final products surviving strict filter:", topProducts.length);
}

runTest();
