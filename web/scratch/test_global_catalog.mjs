async function runTests() {
  const endpoint = 'https://catalog.shopify.com/api/ucp/mcp';
  
  const test = async (name, catalogArgs) => {
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
          catalog: catalogArgs
        }
      }
    };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json.error) {
        console.log(`[${name}] RPC Error:`, json.error.message);
        return;
      }
      const products = json.result?.structuredContent?.products || [];
      console.log(`[${name}] Found ${products.length} products:`);
      products.slice(0, 3).forEach((p, idx) => {
        const variant = p.variants?.[0] || {};
        const seller = variant.seller || {};
        console.log(`  ${idx+1}. ${p.title} by ${seller.name} (${seller.domain}) - Price: ${variant.price?.amount} ${variant.price?.currency}`);
        console.log(`     Image URL: ${p.media?.[0]?.url || variant.media?.[0]?.url || 'NONE'}`);
        console.log(`     All Media:`, p.media ? p.media.map(m => m.url) : 'NONE');
        console.log(`     Variant Media:`, variant.media ? variant.media.map(m => m.url) : 'NONE');
      });
    } catch (e) {
      console.log(`[${name}] Exception:`, e.message);
    }
  };

  // Test 1: country in filters
  await test("Filter country: IN", {
    query: "linen shirt",
    filters: { available: true, country: "IN" }
  });

  // Test 2: locale in context
  await test("Context locale: hi-IN", {
    query: "linen shirt",
    filters: { available: true },
    context: { locale: "hi-IN" }
  });

  // Test 3: country in context
  await test("Context country: IN", {
    query: "linen shirt",
    filters: { available: true },
    context: { country: "IN" }
  });

  // Test 4: query with location name
  await test("Query with 'India'", {
    query: "linen shirt India",
    filters: { available: true }
  });
}

runTests();
