import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const { GlobalCatalogService } = await import('../lib/services/GlobalCatalogService.js');

console.log("=== Testing 'áo' ===");
const start = Date.now();
const results = await GlobalCatalogService.search(
  'áo', null, [], null, true, [], 'trust_desc', 'USD', { fastFirstPage: true }
);
const elapsed = Date.now() - start;
console.log(`→ ${results.length} products in ${elapsed}ms`);
if (results.length > 0) {
  console.log("Sample products:");
  results.slice(0, 5).forEach((p, i) => console.log(`  ${i+1}. ${p.title} (${p.vendor}) - ${p.store_url}`));
}
