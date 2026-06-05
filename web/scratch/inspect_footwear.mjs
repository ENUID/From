import { UCP_REGISTRY } from '../lib/stores.js';

async function main() {
  const footwearStores = UCP_REGISTRY.filter(s => s.categories.includes('footwear'));
  console.log(`Footwear stores count: ${footwearStores.length}`);
  footwearStores.forEach(s => console.log(` - ${s.domain}`));
}

main().catch(console.error);
