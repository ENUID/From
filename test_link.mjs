import https from 'https';

const url = 'https://theminimalistceramist.com/products/7510795419827';
https.get(url, (res) => {
    console.log('Status code for /products/ID:', res.statusCode);
    console.log('Location:', res.headers.location);
});

// also try to run the exact search they did and log the raw product
async function testUCP() {
  const payload = {
    jsonrpc: "2.0",
    id: "1",
    method: "tools/call",
    params: {
      name: "search_catalog",
      arguments: { query: "Minimalist white ceramic bowls" }
    }
  }

  const res = await fetch('https://theminimalistceramist.com/api/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
  });
  const data = await res.json();
  const textContent = data.result?.content?.[0]?.text;
  const parsed = JSON.parse(textContent);
  console.log('Raw keys of first product:', Object.keys(parsed.products[0]));
  console.log('Product:', JSON.stringify(parsed.products[0]).slice(0, 500));
}

testUCP();
