import { GlobalCatalogService } from '../lib/services/GlobalCatalogService.js';
import { UCP_REGISTRY } from '../lib/stores.js';

async function main() {
  console.log("Registry length:", UCP_REGISTRY.length);
  console.log("First store in registry:", JSON.stringify(UCP_REGISTRY[0], null, 2));
}

main().catch(console.error);
