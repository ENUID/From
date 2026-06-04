import { GlobalCatalogService } from './web/lib/services/GlobalCatalogService';

async function runTest() {
  console.log("=== TEST 1: Searching for 'dress' without concepts (Basic Search) ===");
  const res1 = await GlobalCatalogService.search(
    "dress",
    null,
    [],
    "US",
    false,
    [],
    "trust_desc"
  );
  console.log(`Found ${res1.length} results.`);
  res1.slice(0, 3).forEach(p => {
    console.log(`- [${p.trust_score}] ${p.title} (Vendor: ${p.vendor})`);
  });

  console.log("\n=== TEST 2: Searching for 'dress' WITH mandatory concepts ===");
  const res2 = await GlobalCatalogService.search(
    "dress",
    null,
    [],
    "US",
    false,
    [["dress", "váy", "đầm"]],
    "trust_desc"
  );
  console.log(`Found ${res2.length} results.`);
  res2.slice(0, 3).forEach(p => {
    console.log(`- [${p.trust_score}] ${p.title} (Vendor: ${p.vendor})`);
  });

  console.log("\n=== TEST 3: Searching with multiple concepts (strict) ===");
  const res3 = await GlobalCatalogService.search(
    "dress",
    null,
    [],
    "US",
    false,
    [["dress", "váy"], ["cotton"]],
    "trust_desc"
  );
  console.log(`Found ${res3.length} results.`);
  res3.slice(0, 3).forEach(p => {
    console.log(`- [${p.trust_score}] ${p.title} (Vendor: ${p.vendor})`);
  });
}

runTest().catch(console.error);
