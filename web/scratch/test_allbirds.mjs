import { GlobalCatalogService } from '../lib/services/GlobalCatalogService.js';
import { UCP_REGISTRY } from '../lib/stores.js';

async function main() {
  const query = "shoes";
  console.log("Searching for shoes...");
  const results = await GlobalCatalogService.search(query, null, [], 'US', null);
  
  console.log(`\nFiltered Results count: ${results.length}`);
  results.forEach(r => {
    console.log(` - ${r.title} | ${r.vendor} | ${r.store_url}`);
  });
}

main().catch(console.error);
