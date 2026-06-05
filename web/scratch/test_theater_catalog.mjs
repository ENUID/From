async function listCatalog(domain) {
  const endpoint = `https://${domain}/api/mcp`;
  const payload = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "search_catalog",
      arguments: {
        catalog: {
          query: "", // Empty query to get default listing
          pagination: { limit: 50 }
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
    const textContent = data.result?.content?.[0]?.text;
    if (textContent) {
      const parsedInner = JSON.parse(textContent);
      console.log(`\n=== Catalog of ${domain} (${parsedInner.products?.length || 0} products) ===`);
      if (parsedInner.products) {
        parsedInner.products.forEach((p, i) => {
          console.log(`  ${i+1}. Title: ${p.title} | Tags: ${p.tags?.join(', ') || 'None'}`);
        });
      }
    }
  } catch (err) {
    console.error(`Error:`, err.message);
  }
}

listCatalog("theater.xyz");
