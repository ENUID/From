import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env.local') });

// Direct MCP test to coverchord to verify both language queries work
async function directTest() {
  const endpoint = 'https://coverchord.com/api/mcp';
  
  const queries = ['shirt', 'シャツ', 'linen shirt', 'リネン シャツ', 'jacket', 'ジャケット'];
  
  for (const q of queries) {
    const payload = {
      jsonrpc: "2.0",
      method: "tools/call",
      id: 1,
      params: {
        name: "search_catalog",
        arguments: {
          catalog: {
            query: q,
            filters: { available: true },
            pagination: { limit: 5 }
          }
        }
      }
    };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(6000)
      });
      
      if (!res.ok) {
        console.log(`"${q}" → HTTP ${res.status}`);
        continue;
      }
      
      const data = await res.json();
      const products = data?.result?.structuredContent?.products 
        || data?.result?.content?.[0]?.text && (() => { try { return JSON.parse(data.result.content[0].text).products } catch { return [] } })()
        || [];
      
      console.log(`"${q}" → ${products.length} products`);
      products.slice(0, 3).forEach((p, i) => console.log(`  ${i+1}. ${p.title}`));
    } catch (err) {
      console.log(`"${q}" → ERROR: ${err.message}`);
    }
  }
}

directTest().catch(console.error);
