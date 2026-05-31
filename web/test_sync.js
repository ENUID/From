const { performShopifySync } = require('./lib/shopifySync');

async function run() {
  const result = await performShopifySync('j5788bpqt505fbf8n841bas099853rg4', 'user_2m1R0HkKxZyv6T7sK5O6GkS');
  console.log('Sync result:', result);
}

run().catch(console.error);
