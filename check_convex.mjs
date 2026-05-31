import { ConvexHttpClient } from "convex/browser";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const client = new ConvexHttpClient(process.env.CONVEX_URL || process.env.NEXT_PUBLIC_CONVEX_URL);

async function run() {
  const products = await client.query("merchants:listProducts", { merchant_id: "j5788bpqt505fbf8n841bas099853rg4" });
  console.log(`Found ${products.length} products.`);
  products.slice(0, 5).forEach((p, i) => {
    console.log(`[${i}] Title: ${p.title}`);
    console.log(`    Image URL: ${p.image_url}`);
  });
}

run().catch(console.error);
