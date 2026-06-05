async function main() {
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
          query: `shoes AND ("allbirds.com" OR "monkstory.com")`,
          filters: { available: true },
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
  console.log(`Found ${products.length} products for shoes:`);
  products.forEach(p => console.log(` - ${p.title} (${p.variants?.[0]?.seller?.domain})`));
}

main().catch(console.error);
