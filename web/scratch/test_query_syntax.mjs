async function testQuery(domain, query) {
  const endpoint = `https://${domain}/api/mcp`;
  const payload = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "search_catalog",
      arguments: {
        catalog: {
          query: query,
          filters: { available: true },
          pagination: { limit: 10 }
        }
      }
    }
  };

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(6000)
    });
    const data = await res.json();
    
    // Parse products
    let products = [];
    if (data?.result?.structuredContent?.products) {
      products = data.result.structuredContent.products;
    } else {
      const textContent = data?.result?.content?.[0]?.text;
      if (textContent && typeof textContent === 'string') {
        try {
          const parsedInner = JSON.parse(textContent);
          products = parsedInner.products || [];
        } catch {}
      }
    }
    
    console.log(`[${domain}] Query: "${query}" -> Found ${products.length} products (HTTP Status ${res.status})`);
    if (products.length > 0) {
      console.log(`  First product: "${products[0].title}"`);
    }
  } catch (err) {
    console.error(`[${domain}] Query: "${query}" -> Error:`, err.message);
  }
}

async function testQueryAll(domain, query) {
  const endpoint = `https://${domain}/api/mcp`;
  const payload = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "search_catalog",
      arguments: {
        catalog: {
          query: query,
          filters: { available: true },
          pagination: { limit: 20 }
        }
      }
    }
  };
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    let products = [];
    if (data?.result?.structuredContent?.products) {
      products = data.result.structuredContent.products;
    } else {
      const textContent = data?.result?.content?.[0]?.text;
      if (textContent && typeof textContent === 'string') {
        try {
          const parsedInner = JSON.parse(textContent);
          products = parsedInner.products || [];
        } catch {}
      }
    }
    console.log(`\n--- Results for: "${query}" (${products.length} found) ---`);
    products.forEach((p, idx) => console.log(`  ${idx+1}. ${p.title}`));
  } catch (err) {
    console.error(err);
  }
}

async function main() {
  const testStore = "wearneutralground.com";
  await testQueryAll(testStore, "denim OR linen");
}

main().catch(console.error);
