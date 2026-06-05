async function testQuerySyntax(queryString, label) {
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
          query: queryString,
          filters: { available: true },
          pagination: { limit: 5 }
        }
      }
    }
  };

  try {
    const res = await fetch('https://catalog.shopify.com/api/ucp/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    const products = json.result?.structuredContent?.products || [];
    console.log(`\n=== [${label}] Returned ${products.length} products ===`);
    products.forEach((p, idx) => {
      console.log(`  ${idx+1}. Title: ${p.title} | Seller domain: ${p.variants?.[0]?.seller?.domain}`);
    });
  } catch (e) {
    console.log(`[${label}] Failed: ${e.message}`);
  }
}

async function main() {
  await testQuerySyntax("(shoes OR shoe OR sneakers OR boots OR dép OR giày) AND (domain:allbirds.com OR domain:aloyoga.com)", "ORed domain fields");
}

main().catch(console.error);
