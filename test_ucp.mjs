const STORES = ['www.allbirds.com', 'colourpop.com', 'gymshark.com'];

async function testUCP(domain) {
  console.log(`Testing UCP for ${domain}...`);
  const endpoint = `https://${domain}/api/mcp`;
  
  const payload = {
    jsonrpc: "2.0",
    id: "1",
    method: "tools/call",
    params: {
      name: "search_catalog",
      arguments: {
        query: "shoes"
      }
    }
  };

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      console.log(`[${domain}] HTTP Error: ${res.status}`);
      return;
    }

    const data = await res.json();
    console.log(`[${domain}] Success:`, JSON.stringify(data).slice(0, 200) + '...');
  } catch (err) {
    console.log(`[${domain}] Network Error:`, err.message);
  }
}

async function run() {
  for (const store of STORES) {
    await testUCP(store);
  }
}

run();
