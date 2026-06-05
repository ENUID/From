import { GlobalCatalogService } from '../lib/services/GlobalCatalogService.js';
import { UCP_REGISTRY } from '../lib/stores.js';

async function main() {
  console.log("Running search for 'shirt' and debugging each product's filtering status...");
  
  // We will run search, but we want to log what happens inside applyCatalogFilters
  // Let's manually fetch the cached or raw products and check them against the logic
  const query = "shirt";
  
  // Call search but capture what is processed
  const results = await GlobalCatalogService.search(query, null, [], 'US', null);
  console.log(`\nReturned results count: ${results.length}`);
}

main().catch(console.error);
