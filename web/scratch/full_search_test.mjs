import { GlobalCatalogService } from '../lib/services/GlobalCatalogService.js';

async function run() {
  console.log('Starting full catalog search for "shirt" across all stores...');
  const results = await GlobalCatalogService.search('shirt', null, [], 'US', null);
  console.log(`Total products returned: ${results.length}`);
  const titles = results.map(p => p.title || p.product_type || 'Unnamed');
  console.log('Sample titles:', titles.slice(0, 20));
}

run().catch(e => console.error('Error:', e));
