const { ConvexHttpClient } = require("convex/browser");

const client = new ConvexHttpClient("https://majestic-axolotl-627.convex.cloud");

client.query("merchants:listProducts", { merchant_id: "j5788bpqt505fbf8n841bas099853rg4" })
  .then(products => {
    console.log(`Found ${products.length} products.`);
    products.slice(0, 5).forEach((p, i) => {
      console.log(`[${i}] Title: ${p.title}`);
      console.log(`    Image URL: ${p.image_url}`);
    });
  })
  .catch(console.error);
