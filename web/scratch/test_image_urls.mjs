// Test: check if image URLs actually load from Vietnam perspective
async function testImageUrls() {
  const endpoint = 'https://catalog.shopify.com/api/ucp/mcp';
  
  const payload = {
    jsonrpc: "2.0",
    method: "tools/call",
    id: "1",
    params: {
      name: "search_catalog",
      arguments: {
        meta: {
          "ucp-agent": {
            profile: "https://shopify.dev/ucp/agent-profiles/2026-04-08/valid-with-capabilities.json"
          }
        },
        catalog: {
          query: "jeans Vietnam",
          filters: { 
            available: true,
            ships_to: { country: "VN" }
          },
          pagination: { limit: 50 }
        }
      }
    }
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const json = await res.json();
  const products = json.result?.structuredContent?.products || [];
  
  console.log(`\n=== Found ${products.length} products with ships_to:VN filter ===\n`);
  
  // Check each product's image URL
  for (let i = 0; i < Math.min(products.length, 12); i++) {
    const p = products[i];
    const imgUrl = p.media?.[0]?.url || p.variants?.[0]?.media?.[0]?.url || '';
    
    console.log(`${i+1}. ${p.title}`);
    console.log(`   image_url: "${imgUrl}"`);
    console.log(`   url empty? ${!imgUrl || imgUrl.trim().length === 0}`);
    console.log(`   starts with //? ${imgUrl.startsWith('//')}`);
    
    // Try to HEAD-fetch the image to see if it's accessible
    if (imgUrl) {
      try {
        const imgRes = await fetch(imgUrl.startsWith('//') ? `https:${imgUrl}` : imgUrl, { 
          method: 'HEAD',
          signal: AbortSignal.timeout(5000)
        });
        console.log(`   HTTP status: ${imgRes.status} ${imgRes.statusText}`);
        console.log(`   Content-Type: ${imgRes.headers.get('content-type')}`);
      } catch (e) {
        console.log(`   FETCH ERROR: ${e.message}`);
      }
    }
    console.log('');
  }
}

testImageUrls();
