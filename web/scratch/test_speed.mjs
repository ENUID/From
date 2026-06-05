import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const { GlobalCatalogService } = await import('../lib/services/GlobalCatalogService.js');

const queries = [
  { q: 'linen shirt', label: 'linen shirt (122 stores, fastFirstPage)' },
  { q: 'shoes', label: 'shoes (broad, many stores)' },
  { q: 'シャツ', label: 'シャツ (Japanese query)' },
];

for (const { q, label } of queries) {
  console.log(`\n=== ${label} ===`);
  const start = Date.now();
  const results = await GlobalCatalogService.search(
    q, null, [], null, true, [], 'trust_desc', 'USD', { fastFirstPage: true }
  );
  const elapsed = Date.now() - start;
  console.log(`→ ${results.length} products in ${elapsed}ms`);
}
