import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const { UCP_REGISTRY } = await import('../lib/stores.js');

// Only test stores with "top" category
const topStores = UCP_REGISTRY.filter(s => s.categories.includes('top'));
console.log(`Testing ${topStores.length} stores with category "top" for query "shirt"...\n`);

const results = await Promise.allSettled(topStores.map(async (store) => {
  const start = Date.now();
  const endpoint = `https://${store.domain}/api/mcp`;
  const payload = {
    jsonrpc: "2.0", method: "tools/call", id: 1,
    params: { name: "search_catalog", arguments: { catalog: { query: "shirt", filters: { available: true }, pagination: { limit: 5 } } } }
  };

  try {
    const res = await fetch(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(6000)
    });
    const elapsed = Date.now() - start;
    if (!res.ok) return { domain: store.domain, count: -1, elapsed, error: `HTTP ${res.status}` };
    
    const data = await res.json();
    let products = [];
    if (data?.result?.structuredContent?.products) {
      products = data.result.structuredContent.products;
    } else {
      const textContent = data?.result?.content?.[0]?.text;
      if (textContent && typeof textContent === 'string') {
        try {
          const parsedInner = JSON.parse(textContent);
          if (parsedInner && Array.isArray(parsedInner.products)) {
            products = parsedInner.products;
          }
        } catch (e) {}
      }
    }
    if (products.length === 0 && data?.result?.products) {
      products = data.result.products;
    }
    return { domain: store.domain, count: products.length, elapsed };
  } catch (err) {
    return { domain: store.domain, count: -1, elapsed: Date.now() - start, error: err.message };
  }
}));

const rows = results.map(r => r.status === 'fulfilled' ? r.value : { domain: '?', count: -1, elapsed: 0, error: 'rejected' });
rows.sort((a, b) => a.elapsed - b.elapsed);

const zero = rows.filter(r => r.count === 0);
const errors = rows.filter(r => r.count === -1);
const hasResults = rows.filter(r => r.count > 0);

console.log(`=== Có kết quả (${hasResults.length} stores) ===`);
hasResults.forEach(r => console.log(`  ${r.domain.padEnd(35)} → ${r.count} products (${r.elapsed}ms)`));

console.log(`\n=== Trả 0 sản phẩm (${zero.length} stores) ===`);
zero.forEach(r => console.log(`  ${r.domain.padEnd(35)} → 0 products (${r.elapsed}ms)`));

console.log(`\n=== Lỗi/Timeout (${errors.length} stores) ===`);
errors.forEach(r => console.log(`  ${r.domain.padEnd(35)} → ERROR: ${r.error} (${r.elapsed}ms)`));
