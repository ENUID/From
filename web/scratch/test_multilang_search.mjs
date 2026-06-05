import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const { GlobalCatalogService } = await import('../lib/services/GlobalCatalogService.js');

async function testMultiLang() {
  console.log('=== Test 1: English query "shirt" (should also search シャツ at coverchord) ===');
  const results1 = await GlobalCatalogService.search(
    'shirt', null, [], null, true, [['shirt', 'シャツ']], 'trust_desc', 'USD', { fastFirstPage: true }
  );
  console.log(`Results: ${results1.length} products`);
  const coverchordEn = results1.filter(p => p.store_url?.includes('coverchord'));
  console.log(`  coverchord products: ${coverchordEn.length}`);
  coverchordEn.slice(0, 3).forEach((p, i) => console.log(`    ${i+1}. ${p.title} (${p.vendor})`));

  console.log('\n=== Test 2: Japanese query "シャツ" (should also search shirt at coverchord) ===');
  const results2 = await GlobalCatalogService.search(
    'シャツ', null, [], null, true, [['shirt', 'シャツ']], 'trust_desc', 'USD', { fastFirstPage: true }
  );
  console.log(`Results: ${results2.length} products`);
  const coverchordJa = results2.filter(p => p.store_url?.includes('coverchord'));
  console.log(`  coverchord products: ${coverchordJa.length}`);
  coverchordJa.slice(0, 3).forEach((p, i) => console.log(`    ${i+1}. ${p.title} (${p.vendor})`));

  console.log('\n=== Test 3: "linen shirt" (should also search リネン シャツ at coverchord) ===');
  const results3 = await GlobalCatalogService.search(
    'linen shirt', null, [], null, true, [['linen', 'リネン'], ['shirt', 'シャツ']], 'trust_desc', 'USD', { fastFirstPage: true }
  );
  console.log(`Results: ${results3.length} products`);
  const coverchordLinen = results3.filter(p => p.store_url?.includes('coverchord'));
  console.log(`  coverchord products: ${coverchordLinen.length}`);
  coverchordLinen.slice(0, 3).forEach((p, i) => console.log(`    ${i+1}. ${p.title} (${p.vendor})`));
}

testMultiLang().catch(console.error);
