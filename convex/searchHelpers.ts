import { internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

function normalizeStoreDomain(domain?: string) {
  return (domain ?? "").trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
}

export const enrichResults = internalQuery({
  args: {
    ids: v.array(v.id("products")),
    scores: v.any(),
    budgetMax: v.union(v.float64(), v.null()),
    limit: v.number(),
  },
  handler: async (ctx, { ids, scores, budgetMax, limit }) => {
    const results = [];

    for (const id of ids) {
      const product = await ctx.db.get(id);
      if (!product || product.status !== "active") continue;

      const variants = await ctx.db
        .query("product_variants")
        .withIndex("by_product", (q) => q.eq("product_id", id))
        .collect();

      if (!variants.length) continue;

      const minPrice = Math.min(...variants.map((v) => v.price));
      if (budgetMax !== null && budgetMax !== undefined && minPrice > budgetMax) continue;

      const merchant = await ctx.db.get(product.merchant_id);
      if (!merchant?.is_active) continue;

      // Bug 4 fix: use the actual myshopify domain, not .com substitution
      const shopDomain = normalizeStoreDomain(merchant?.public_store_domain ?? merchant?.shop_domain);
      const storeUrl = shopDomain
        ? `https://${shopDomain}/products/${product.handle}`
        : "#";

      const inStock = variants.some(
        (v) => v.inventory_quantity > 0 || v.inventory_policy === "continue"
      );

      results.push({
        id: product._id,
        merchant_id: product.merchant_id,
        title: product.title,
        description: product.description ?? "",
        vendor: product.vendor ?? "",
        handle: product.handle,
        product_type: product.product_type ?? "",
        tags: product.tags,
        store_url: storeUrl,
        price: minPrice,
        currency: merchant.currency ?? merchant.base_currency ?? "USD",
        base_currency: merchant.base_currency ?? merchant.currency ?? "USD",
        in_stock: inStock,
        variants: variants.map((v) => ({
          shopify_variant_id: v.shopify_variant_id,
          title: v.title,
          price: v.price,
          inventory_quantity: v.inventory_quantity,
        })),
        similarity: scores[id] ?? 0,
      });

      if (results.length >= limit) break;
    }

    return results.sort((a, b) => b.similarity - a.similarity);
  },
});
