import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const { GlobalCatalogService } = await import('../lib/services/GlobalCatalogService.js');

const query = 'shirt';

console.log('=== TESTING LOAD MORE PAGINATION FOR "shirt" ===\n');

// Page 1: fastFirstPage
const startPage1 = Date.now();
const page1 = await GlobalCatalogService.search(
  query, null, [], null, true, [], 'trust_desc', 'USD', { fastFirstPage: true }
);
console.log(`\nPage 1: ${page1.length} products in ${Date.now() - startPage1}ms`);

console.log('--- Simulating 3 seconds of user scrolling and reading ---');
await new Promise(resolve => setTimeout(resolve, 3000));

// Page 2: loadMore with excludeIds from page 1
const excludeIds1 = page1.map(p => p.id);
const startPage2 = Date.now();
const page2 = await GlobalCatalogService.search(
  query, null, excludeIds1, null, true, [], 'trust_desc', 'USD', { loadMore: true, refreshReserve: true }
);
console.log(`Page 2: ${page2.length} products in ${Date.now() - startPage2}ms`);

// Page 3: loadMore with excludeIds from page 1 + page 2
const excludeIds2 = [...excludeIds1, ...page2.map(p => p.id)];
const startPage3 = Date.now();
const page3 = await GlobalCatalogService.search(
  query, null, excludeIds2, null, true, [], 'trust_desc', 'USD', { loadMore: true, refreshReserve: true }
);
console.log(`Page 3: ${page3.length} products in ${Date.now() - startPage3}ms`);

// Page 4
const excludeIds3 = [...excludeIds2, ...page3.map(p => p.id)];
const startPage4 = Date.now();
const page4 = await GlobalCatalogService.search(
  query, null, excludeIds3, null, true, [], 'trust_desc', 'USD', { loadMore: true, refreshReserve: true }
);
console.log(`Page 4: ${page4.length} products in ${Date.now() - startPage4}ms`);

// Page 5
const excludeIds4 = [...excludeIds3, ...page4.map(p => p.id)];
const startPage5 = Date.now();
const page5 = await GlobalCatalogService.search(
  query, null, excludeIds4, null, true, [], 'trust_desc', 'USD', { loadMore: true, refreshReserve: true }
);
console.log(`Page 5: ${page5.length} products in ${Date.now() - startPage5}ms`);

const totalProducts = page1.length + page2.length + page3.length + page4.length + page5.length;
console.log(`\n=== TOTAL: ${totalProducts} unique products across 5 pages ===`);
