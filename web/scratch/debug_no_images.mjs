import { UCP_REGISTRY } from '../lib/stores.js';

async function main() {
  const q = "shoes";
  const domainClause = `"allbirds.com" OR "monkstory.com"`;
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
  
  console.log(`Debug images for ${products.length} products:`);
  products.forEach((p, i) => {
    console.log(`\n${i+1}. Title: ${p.title}`);
    console.log(`   Root media:`, JSON.stringify(p.media));
    console.log(`   Variant media:`, JSON.stringify(p.variants?.[0]?.media));
  });
}

main().catch(console.error);
