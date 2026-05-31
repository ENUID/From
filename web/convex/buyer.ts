import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ────────────────────────────────────────────────────────────────────────────
// Saved Products
// ────────────────────────────────────────────────────────────────────────────

export const toggleSavedProduct = mutation({
  args: {
    userEmail: v.string(),
    product: v.object({
      id: v.string(),
      title: v.string(),
      vendor: v.string(),
      handle: v.string(),
      store_url: v.string(),
      price: v.number(),
      currency: v.optional(v.string()),
      base_currency: v.optional(v.string()),
      tags: v.array(v.string()),
      in_stock: v.boolean(),
      merchant_id: v.optional(v.string()),
      image_url: v.optional(v.string()),
      description: v.optional(v.string()),
      product_type: v.optional(v.string()),
      options: v.optional(
        v.array(
          v.object({
            name: v.string(),
            values: v.array(v.string()),
          })
        )
      ),
      variants: v.optional(
        v.array(
          v.object({
            shopify_variant_id: v.string(),
            price: v.number(),
            title: v.string(),
            inventory_quantity: v.number(),
          })
        )
      ),
    }),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.userEmail))
      .first();

    if (!user) throw new Error("User not found");

    const existing = await ctx.db
      .query("saved_products")
      .withIndex("by_user_product", (q) =>
        q.eq("userId", user._id).eq("product.id", args.product.id)
      )
      .first();

    if (existing) {
      // Unsave
      await ctx.db.delete(existing._id);
      return false;
    } else {
      // Save
      await ctx.db.insert("saved_products", {
        userId: user._id,
        product: args.product,
        savedAt: Date.now(),
      });
      return true;
    }
  },
});

export const getSavedProducts = query({
  args: { userEmail: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.userEmail))
      .first();

    if (!user) return [];

    const saved = await ctx.db
      .query("saved_products")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();

    return saved.map((s) => s.product);
  },
});

// ────────────────────────────────────────────────────────────────────────────
// Search History
// ────────────────────────────────────────────────────────────────────────────

export const saveSearchHistory = mutation({
  args: {
    userEmail: v.string(),
    query: v.string(),
    resultCount: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.userEmail))
      .first();

    if (!user) return; // Silent fail if not logged in

    await ctx.db.insert("search_history", {
      userId: user._id,
      query: args.query,
      resultCount: args.resultCount,
      createdAt: Date.now(),
    });
  },
});

export const getSearchHistory = query({
  args: { userEmail: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.userEmail))
      .first();

    if (!user) return [];

    const history = await ctx.db
      .query("search_history")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(50); // Get last 50 searches

    return history.map((h) => ({
      id: h._id,
      query: h.query,
      createdAt: h.createdAt,
      resultCount: h.resultCount,
    }));
  },
});
