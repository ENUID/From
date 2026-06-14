import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ────────────────────────────────────────────────────────────────────────────
// Saved Products
// ────────────────────────────────────────────────────────────────────────────

export const toggleSavedProduct = mutation({
  args: {
    userEmail: v.string(),
    product: v.any(),
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

export const deleteSearchHistory = mutation({
  args: { userEmail: v.string(), id: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.userEmail))
      .first();

    if (!user) return;

    // The client sends a string id — normalize it; bail if it isn't a real
    // search_history document id (e.g. a locally generated entry).
    const docId = ctx.db.normalizeId("search_history", args.id);
    if (!docId) return;

    const entry = await ctx.db.get(docId);
    // Only delete the user's own entry.
    if (entry && entry.userId === user._id) {
      await ctx.db.delete(docId);
    }
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
