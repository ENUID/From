import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const { GlobalCatalogService } = await import('../lib/services/GlobalCatalogService.js');

async function testMismatchRanking() {
  const query = "linen shirt";
  console.log(`\n========================================`);
  console.log(`Testing Mismatch Ranking for query: "${query}"`);
  console.log(`========================================`);
  
  const products = await GlobalCatalogService.search(query, null, [], 'US', null);
  console.log(`Total returned products: ${products.length}`);
  
  console.log("\nTop 10 products:");
  products.slice(0, 10).forEach((p, i) => {
    console.log(`  ${i+1}. [Trust: ${p.trust_score}] ${p.title} (${p.vendor})`);
  });
  
  console.log("\nBottom 10 products:");
  products.slice(-10).forEach((p, i) => {
    const idx = products.length - 10 + i + 1;
    console.log(`  ${idx}. [Trust: ${p.trust_score}] ${p.title} (${p.vendor})`);
  });

  const mismatched = products.filter(p => (p.trust_score || 0) < 40);
  console.log(`\nTotal products penalized (Trust < 40): ${mismatched.length}`);
}

testMismatchRanking().catch(console.error);
