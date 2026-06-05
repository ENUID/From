async function testDirect(domain, query) {
  const endpoint = `https://${domain}/api/mcp`;
  console.log(`Querying ${endpoint} for "${query}"...`);
  const payload = {
    jsonrpc: "2.0",
    id: "1",
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
      console.log(`ParsedInner keys:`, Object.keys(parsedInner));
      console.log(`Products count:`, parsedInner.products?.length);
      if (parsedInner.products && parsedInner.products.length > 0) {
        console.log(`First product:`, JSON.stringify(parsedInner.products[0], null, 2));
      }
    }
  } catch (err) {
    console.error(`Error querying ${domain}:`, err.message);
  }
}

async function main() {
  await testDirect("allbirds.com", "shoes");
}

main();
