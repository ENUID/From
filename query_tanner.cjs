const { ConvexHttpClient } = require("convex/browser");

const client = new ConvexHttpClient("https://majestic-axolotl-627.convex.cloud");

client.query("merchants:listProducts", { merchant_id: "j574py0k2cwe2fe20cgm58905d853mst" })
  .then(products => {
    console.log(`Found ${products.length} products.`);
    products.slice(0, 5).forEach((p, i) => {
      console.log(`[${i}] Title: ${p.title}`);
      console.log(`    Image URL: ${p.image_url}`);
    });
  })
  .catch(console.error);
