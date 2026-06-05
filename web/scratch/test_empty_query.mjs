import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const zeroStores = [
  "pariya.in",
  "loomforma.com",
  "sleepscientist.in",
  "moderaegy.myshopify.com",
  "bamboovogue.in"
];

for (const domain of zeroStores) {
  const endpoint = `https://${domain}/api/mcp`;
  const payload = {
    jsonrpc: "2.0", method: "tools/call", id: 1,
    params: { name: "search_catalog", arguments: { catalog: { query: "", pagination: { limit: 10 } } } }
  };

  try {
    const res = await fetch(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      console.log(`${domain} → HTTP ${res.status}`);
      continue;
    }
    const data = await res.json();
    let products = [];
    const textContent = data?.result?.content?.[0]?.text;
    if (textContent && typeof textContent === 'string') {
      try {
        const parsed = JSON.parse(textContent);
        products = parsed.products || [];
      } catch (e) {}
    }
    console.log(`${domain} (total=${products.length} products):`);
    products.forEach(p => {
      console.log(`  - Title: ${p.title}`);
      console.log(`    Tags: ${JSON.stringify(p.tags)}`);
      console.log(`    Description: ${p.description?.plain?.substring(0, 100)}`);
    });
  } catch (err) {
    console.log(`${domain} → Error: ${err.message}`);
  }
}
