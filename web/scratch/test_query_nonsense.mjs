import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function checkStoreSearch(domain, q) {
  const endpoint = `https://${domain}/api/mcp`;
  const payload = {
    jsonrpc: "2.0", method: "tools/call", id: 1,
    params: { name: "search_catalog", arguments: { catalog: { query: q, pagination: { limit: 10 } } } }
  };

  try {
    const res = await fetch(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    let products = [];
    const textContent = data?.result?.content?.[0]?.text;
    if (textContent && typeof textContent === 'string') {
      try {
        const parsed = JSON.parse(textContent);
        products = parsed.products || [];
      } catch (e) {}
    }
    console.log(`Query "${q}" on ${domain} -> ${products.length} products`);
    if (products.length > 0) {
      console.log(`  First product: ${products[0].title}`);
    }
  } catch (err) {
    console.log(`Query "${q}" on ${domain} -> Error: ${err.message}`);
  }
}

await checkStoreSearch("porterjames.com", "áo");
await checkStoreSearch("porterjames.com", "shirt");
await checkStoreSearch("porterjames.com", "randomnonsense");
await checkStoreSearch("gymsharkusa.myshopify.com", "áo");
await checkStoreSearch("gymsharkusa.myshopify.com", "shirt");
await checkStoreSearch("gymsharkusa.myshopify.com", "randomnonsense");
