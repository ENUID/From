import { UCP_REGISTRY } from '../lib/stores.js';

async function main() {
  const q = "shoes";
  const matchedDomains = UCP_REGISTRY.filter(store => 
    store.categories.some(cat => cat === 'footwear')
  ).map(s => s.domain.toLowerCase().trim());

  const chunk = matchedDomains.slice(0, 10);
  const domainClause = chunk.map(d => `"${d}"`).join(" OR ");
  const chunkQuery = `(${q}) AND (${domainClause})`;

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
  console.log(`Querying with ships_to: US -> returned ${products.length} products`);
}

main().catch(console.error);
