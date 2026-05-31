const { ConvexHttpClient } = require("convex/browser");

const client = new ConvexHttpClient("https://majestic-axolotl-627.convex.cloud");

client.query("merchants:list")
  .then(merchants => {
    console.log(`Found ${merchants.length} merchants.`);
    merchants.forEach((m, i) => {
      console.log(`[${i}] Shop: ${m.shop_domain}`);
      console.log(`    Last sync error: ${m.last_sync_error}`);
      console.log(`    Active: ${m.is_active}`);
    });
  })
  .catch(console.error);
