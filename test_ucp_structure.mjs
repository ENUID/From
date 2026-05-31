const domain = 'www.allbirds.com';
const endpoint = `https://${domain}/api/mcp`;
  
const payload = {
  jsonrpc: "2.0",
  id: "1",
  method: "tools/call",
  params: {
    name: "search_catalog",
    arguments: {
      query: "runner"
    }
  }
};

async function test() {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  const textContent = data.result.content[0].text;
  const parsed = JSON.parse(textContent);
  console.log(JSON.stringify(parsed, null, 2));
}

test();
