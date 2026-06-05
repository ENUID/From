import { GlobalCatalogService } from '../lib/services/GlobalCatalogService.js';

async function debugLinenShirt() {
  const query = "linen shirt";
  console.log(`Searching for "${query}"...`);
  try {
    const products = await GlobalCatalogService.search(query, null, [], 'US', null);
    console.log(`Total returned products: ${products.length}`);
    products.forEach((p, idx) => {
      console.log(`\n[${idx + 1}] Title: ${p.title}`);
      console.log(`    Vendor: ${p.vendor}`);
      console.log(`    Price: ${p.price} ${p.currency}`);
      console.log(`    Trust Score: ${p.trust_score}`);
      console.log(`    URL: ${p.store_url}`);
      console.log(`    Image: ${p.image_url}`);
    });
  } catch (err) {
    console.error("Error running debug search:", err);
  }
}

debugLinenShirt();
