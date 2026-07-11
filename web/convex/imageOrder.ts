import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { verifyServerSecret } from "./lib/serverAuth";

// Persistent cache of vision-classified, model-shot-first image orderings.
// Keyed by a hash of the product's image URL set. Orderings are stable, so
// there is no TTL — once a product is classified, every later view is free.

/** Return the cached on-body-first ordering for this image set, or null. */
export const get = query({
  args: { key: v.string(), serverSecret: v.string() },
  handler: async (ctx, args) => {
    if (!verifyServerSecret(args.serverSecret)) return null;
    const row = await ctx.db
      .query("image_order")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    return row ? { order: row.order } : null;
  },
});

/** Upsert an ordering. Best-effort; callers ignore failures. */
export const set = mutation({
  args: { key: v.string(), order: v.string(), serverSecret: v.string() },
  handler: async (ctx, args) => {
    if (!verifyServerSecret(args.serverSecret)) return { ok: false };
    const existing = await ctx.db
      .query("image_order")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { order: args.order, createdAt: Date.now() });
    } else {
      await ctx.db.insert("image_order", { key: args.key, order: args.order, createdAt: Date.now() });
    }
    return { ok: true };
  },
});
