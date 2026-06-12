import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Record a shopper's relevance feedback on a search result. Anonymous-friendly:
 * userEmail is optional. This is the learning loop's raw signal — reviewed
 * periodically to tune the reranker and mismatch thresholds.
 */
export const flagResult = mutation({
  args: {
    userEmail: v.optional(v.string()),
    query: v.string(),
    productId: v.string(),
    productTitle: v.optional(v.string()),
    vendor: v.optional(v.string()),
    signal: v.union(v.literal("bad_match"), v.literal("good_match")),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let userId = undefined;
    if (args.userEmail) {
      const user = await ctx.db
        .query("users")
        .filter((q) => q.eq(q.field("email"), args.userEmail))
        .first();
      userId = user?._id;
    }
    await ctx.db.insert("quality_signals", {
      userId,
      query: args.query.slice(0, 200),
      productId: args.productId,
      productTitle: args.productTitle?.slice(0, 200),
      vendor: args.vendor?.slice(0, 120),
      signal: args.signal,
      reason: args.reason?.slice(0, 300),
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

/** Recent quality signals for review/tuning (admin/analytics use). */
export const getRecentSignals = query({
  args: { signal: v.optional(v.union(v.literal("bad_match"), v.literal("good_match"))) },
  handler: async (ctx, args) => {
    const rows = args.signal
      ? await ctx.db
          .query("quality_signals")
          .withIndex("by_signal", (q) => q.eq("signal", args.signal!))
          .order("desc")
          .take(200)
      : await ctx.db.query("quality_signals").order("desc").take(200);
    return rows;
  },
});
