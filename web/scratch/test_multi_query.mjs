import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const { GlobalCatalogService } = await import('../lib/services/GlobalCatalogService.js');

async function testMultiQuery() {
  const query = "シャツ OR shirt";
  console.log(`\n========================================`);
  console.log(`Testing Multi-Query Search for: "${query}"`);
  console.log(`========================================`);
  
  const startTime = Date.now();
  const products = await GlobalCatalogService.search(query, null, [], 'US', null);
  const duration = Date.now() - startTime;
  
  console.log(`\nSearch finished in ${duration}ms.`);
  console.log(`Total returned products (merged & deduplicated): ${products.length}`);
  
  if (products.length > 0) {
    console.log("Sample product titles (first 10):");
    products.slice(0, 10).forEach((p, i) => {
      console.log(`  ${i+1}. ${p.title} (${p.vendor})`);
    });
  }
}

testMultiQuery().catch(console.error);
