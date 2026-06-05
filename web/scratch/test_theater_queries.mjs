async function testQuery(domain, query) {
  const endpoint = `https://${domain}/api/mcp`;
  const payload = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "search_catalog",
      arguments: { query }
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
      console.log(`\n=== Query "${query}" against ${domain} returned ${parsedInner.products?.length || 0} products ===`);
      if (parsedInner.products) {
        parsedInner.products.slice(0, 3).forEach((p, i) => {
          console.log(`  ${i+1}. Title: ${p.title}`);
          console.log(`     URL: ${p.url}`);
          console.log(`     Description: ${p.description?.plain || p.description?.html?.substring(0, 150) || 'None'}`);
        });
      }
    }
  } catch (err) {
    console.error(`Error:`, err.message);
  }
}

async function main() {
  await testQuery("theater.xyz", "shirt");
  await testQuery("theater.xyz", "stockings");
}

main();
