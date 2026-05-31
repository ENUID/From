const { ConvexHttpClient } = require("convex/browser");

const client = new ConvexHttpClient("https://majestic-axolotl-627.convex.cloud");

client.query("merchants:list")
  .then(merchants => {
    const m = merchants.find(x => x.shop_domain === "quickstart-c8e18392.myshopify.com");
    if (m) {
        console.log(`Owner: ${m.owner_user_id}`);
    }
  })
  .catch(console.error);
