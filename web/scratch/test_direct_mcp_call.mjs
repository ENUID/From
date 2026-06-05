async function testSingle() {
  const domain = "allbirds.com";
  const query = "shoes";
  const endpoint = `https://${domain}/api/mcp`;
  
  const payload = {
    jsonrpc: "2.0",
    method: "tools/call",
    id: 1, // Integer ID
    params: {
      name: "search_catalog",
      arguments: {
        catalog: {
          query: query,
          filters: { available: true, ships_to: { country: "US" } },
          pagination: { limit: 30 }
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
    console.log(`Status: ${res.status}`);
    const data = await res.json();
    console.log(`Data keys:`, Object.keys(data));
    if (data.result) {
      console.log(`Result content:`, JSON.stringify(data.result.content).substring(0, 500));
    } else {
      console.log(`Data:`, JSON.stringify(data));
    }
  } catch (err) {
    console.error(`Error:`, err);
  }
}

testSingle();
