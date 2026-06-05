import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env.local') });

// Dynamically import GlobalCatalogService
const { GlobalCatalogService } = await import('../lib/services/GlobalCatalogService.js');

// Access the private/internal helper functions by writing a wrapper or using GlobalCatalogService.search
// Wait, we can test via search, or we can just invoke search with a debug log or mockup.
// Since we put console.log inside cleanQueryForStorefront when LLM translates, we can see if it triggers LLM.

const testCases = [
  { q: 'linen shirt', label: 'Trivially English (Bypass LLM)' },
  { q: 'áo khoác lanh', label: 'Vietnamese (Should use LLM)' },
  { q: 'シャツ', label: 'Japanese (Should use LLM)' },
  { q: 'chemise de lin', label: 'French (Should use LLM)' },
  { q: '棉质衬衫', label: 'Chinese (Should use LLM)' },
  { q: 'chemise OR 衬衫', label: 'French OR Chinese (Should translate both)' }
];

console.log('--- STARTING LLM TRANSLATION TEST ---');

for (const { q, label } of testCases) {
  console.log(`\n[Test Case] ${label}: "${q}"`);
  const start = Date.now();
  // We call search but we can pass options to avoid querying all domains if we want,
  // or we can query with a limited subset. Let's just do search with options.fastFirstPage: true
  // to run a speed test and see the console output of cleanQueryForStorefront.
  try {
    const results = await GlobalCatalogService.search(
      q, null, [], null, true, [], 'trust_desc', 'USD', { fastFirstPage: true }
    );
    const elapsed = Date.now() - start;
    console.log(`→ Search returned ${results.length} products in ${elapsed}ms`);
  } catch (err) {
    console.error(`Error searching for "${q}":`, err);
  }
}

console.log('\n--- TESTING TRANSLATION CACHING ---');
console.log('Running "chemise de lin" again (should hit cache and be instant):');
const startCache = Date.now();
try {
  const results = await GlobalCatalogService.search(
    'chemise de lin', null, [], null, true, [], 'trust_desc', 'USD', { fastFirstPage: true }
  );
  const elapsedCache = Date.now() - startCache;
  console.log(`→ Search returned ${results.length} products in ${elapsedCache}ms`);
} catch (err) {
  console.error(err);
}

console.log('\n--- LLM TRANSLATION TEST COMPLETE ---');
