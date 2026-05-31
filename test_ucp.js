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
        query: "eco-friendly denim",
        filters: { available: true }
      }
    }
  }
};

fetch('https://catalog.shopify.com/api/ucp/mcp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
}).then(r => r.json()).then(d => {
  const products = d.result.structuredContent.products;
  for (const p of products) {
    console.log("Title:", p.title);
    console.log("Description Plain:", p.description?.plain);
    console.log("Description HTML:", p.description?.html);
    console.log("Variant 0 Description Plain:", p.variants?.[0]?.description?.plain);
    console.log("----------------------");
  }
});
