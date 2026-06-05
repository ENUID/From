async function testPayload(domain, payload) {
  const endpoint = `https://${domain}/api/mcp`;
  console.log(`\nTesting payload against ${endpoint}...`);
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(6000)
    });
    console.log(`Status: ${res.status}`);
    const data = await res.json();
    const textContent = data.result?.content?.[0]?.text;
    if (textContent) {
      const parsedInner = JSON.parse(textContent);
      console.log(`Products returned:`, parsedInner.products?.length || 0);
      if (parsedInner.products && parsedInner.products.length > 0) {
        console.log(`First product title:`, parsedInner.products[0].title);
      }
    } else {
      console.log(`No textContent. Data:`, JSON.stringify(data).substring(0, 500));
    }
  } catch (err) {
    console.error(`Error:`, err.message);
  }
}

async function main() {
  await testPayload("allbirds.com", {
    jsonrpc: "2.0",
    id: "1",
    method: "tools/call",
    params: {
      name: "search_catalog",
      arguments: {
        catalog: {
          query: "shoes",
          filters: { available: true, ships_to: { country: "US" } },
          pagination: { limit: 5 }
        }
      }
    }
  });
}

main();
