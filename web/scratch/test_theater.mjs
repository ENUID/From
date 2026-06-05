async function findSearchCatalogTool(domain) {
  const endpoint = `https://${domain}/api/mcp`;
  const payload = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
    params: {}
  };
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(6000)
    });
    const data = await res.json();
    const tools = data.result?.tools || [];
    const searchTool = tools.find(t => t.name === "search_catalog");
    if (searchTool) {
      console.log(`Tool 'search_catalog' definition:`, JSON.stringify(searchTool, null, 2));
    } else {
      console.log(`Tool 'search_catalog' not found! Existing tools:`, tools.map(t => t.name));
    }
  } catch (err) {
    console.error(`Error:`, err.message);
  }
}

findSearchCatalogTool("theater.xyz");
