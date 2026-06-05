async function main() {
  const chunkQuery = `(shoes) AND ("aloyoga.com" OR "allbirds.com" OR "coverchord.com" OR "monkstory.com" OR "lamastore.in" OR "daxuen.com")`;

  const payload = {
    jsonrpc: "2.0",
    method: "tools/call",
    id: `chunk-test`,
    params: {
      name: "search_catalog",
      arguments: {
        meta: {
          "ucp-agent": {
            profile: "https://shopify.dev/ucp/agent-profiles/2026-04-08/valid-with-capabilities.json"
          }
        },
        catalog: {
          query: chunkQuery,
          filters: { 
            available: true,
            ships_to: { country: "US" }
          },
          pagination: { limit: 10 }
        }
      }
    }
  };

  const res = await fetch('https://catalog.shopify.com/api/ucp/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  
  const json = await res.json();
  const products = json.result?.structuredContent?.products || [];
  console.log(`Query returned ${products.length} products`);
  
  products.forEach((p, idx) => {
    console.log(`\n${idx+1}. Title: ${p.title}`);
    console.log(`   Media:`, JSON.stringify(p.media));
    console.log(`   Variant Media:`, JSON.stringify(p.variants?.[0]?.media));
    console.log(`   Seller domain:`, p.variants?.[0]?.seller?.domain);
  });
}

main().catch(console.error);
