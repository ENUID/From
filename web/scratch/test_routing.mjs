import { GlobalCatalogService } from '../lib/services/GlobalCatalogService.js';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest(query) {
  console.log(`\n========================================`);
  console.log(`TESTING SEARCH FOR: "${query}"`);
  console.log(`========================================`);
  const startTime = Date.now();
  const results = await GlobalCatalogService.search(query, null, [], 'US', null);
  const duration = Date.now() - startTime;
  console.log(`Results: ${results.length} products found in ${duration}ms`);
  if (results.length > 0) {
    console.log(`Sample results (up to 5):`);
    results.slice(0, 5).forEach((p, i) => {
      console.log(`  ${i+1}. ${p.title} | Store: ${p.vendor} (URL: ${p.store_url})`);
    });
  }
}

async function main() {
  // 1. Search for shirt (should match 'top')
  await runTest("shirt");
  await sleep(3000); // Wait 3s to let rate limit reset

  // 2. Search for shoes (should match 'footwear')
  await runTest("shoes");
  await sleep(3000);

  // 3. Search for underwear (should match 'underwear')
  await runTest("underwear");
  await sleep(3000);

  // 4. Fallback search (should use all stores)
  await runTest("random_xyz_nonexistent");
}

main().catch(console.error);
