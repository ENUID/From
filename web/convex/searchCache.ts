import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Matches the in-memory cache TTL — entries older than this are never served.
const TTL_MS = 15 * 60 * 1000;

/** Return a cached product snapshot for this key if still fresh, else null. */
export const get = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("search_cache")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    if (!row) return null;
    if (Date.now() - row.createdAt > TTL_MS) return null;
    return { products: row.products, createdAt: row.createdAt };
  },
});

/** Upsert a fresh snapshot. Best-effort; callers ignore failures. */
export const set = mutation({
  args: { key: v.string(), products: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("search_cache")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { products: args.products, createdAt: Date.now() });
    } else {
      await ctx.db.insert("search_cache", { key: args.key, products: args.products, createdAt: Date.now() });
    }
    return { ok: true };
  },
});
