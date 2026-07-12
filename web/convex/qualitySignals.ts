import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { authProofValidator, verifyAuthProof } from "./lib/authProof";
import { verifyAdminSecret } from "./lib/adminAuth";

/**
 * Record a shopper's relevance feedback on a search result. Anonymous-friendly:
 * userEmail is optional. This is the learning loop's raw signal — reviewed
 * periodically to tune the reranker and mismatch thresholds. authProof is
 * optional too (unlike the identity-bound functions elsewhere) so feedback
 * never blocks — but a userEmail is only ever attributed to the record if
 * its matching proof actually checks out, otherwise it's dropped rather
 * than trusted at face value.
 */
export const flagResult = mutation({
  args: {
    userEmail: v.optional(v.string()),
    authProof: v.optional(authProofValidator),
    query: v.string(),
    productId: v.string(),
    productTitle: v.optional(v.string()),
    vendor: v.optional(v.string()),
    signal: v.union(v.literal("bad_match"), v.literal("good_match")),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let userId = undefined;
    if (args.userEmail && (await verifyAuthProof(args.authProof, args.userEmail))) {
      const user = await ctx.db
        .query("users")
        .filter((q) => q.eq(q.field("email"), args.userEmail!.toLowerCase().trim()))
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
  args: {
    signal: v.optional(v.union(v.literal("bad_match"), v.literal("good_match"))),
    adminSecret: v.string(),
  },
  handler: async (ctx, args) => {
    if (!verifyAdminSecret(args.adminSecret)) return [];
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
