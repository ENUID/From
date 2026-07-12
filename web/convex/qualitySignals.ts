import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { authProofValidator, verifyAuthProof } from "./lib/authProof";
import { verifyAdminSecret } from "./lib/adminAuth";
import { verifyServerSecret } from "./lib/serverAuth";

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

// ── Feedback-loop aggregation (web/app/api/cron/quality-feedback) ─────────────

/** Raw bad-match rows since a cutoff — the cron does the concept-key
 * grouping itself (it can safely import lib/queryParser's decomposeQuery,
 * which this Convex runtime cannot). Capped generously; a daily cron over a
 * single day's flags should never come close to this. */
export const getSignalsForAggregation = query({
  args: { since: v.number(), serverSecret: v.string() },
  handler: async (ctx, args) => {
    if (!verifyServerSecret(args.serverSecret)) return [];
    const rows = await ctx.db.query("quality_signals").order("desc").take(5000);
    return rows.filter((r) => r.createdAt >= args.since && r.signal === "bad_match");
  },
});

/** Bulk upsert of computed relevance_adjustments — one row per (scope,
 * conceptKey, targetId). Replaces each row's counts wholesale each run
 * (the cron recomputes from the full trailing window every time, so this
 * is idempotent, not additive). */
export const writeRelevanceAdjustments = mutation({
  args: {
    serverSecret: v.string(),
    adjustments: v.array(v.object({
      scope: v.union(v.literal("product"), v.literal("vendor")),
      conceptKey: v.string(),
      targetId: v.string(),
      score: v.number(),
      badCount: v.number(),
      goodCount: v.number(),
      distinctFlaggers: v.number(),
    })),
  },
  handler: async (ctx, args) => {
    if (!verifyServerSecret(args.serverSecret)) throw new Error("Unauthorized");
    for (const adj of args.adjustments.slice(0, 2000)) {
      const existing = await ctx.db
        .query("relevance_adjustments")
        .withIndex("by_key", (q) => q.eq("scope", adj.scope).eq("conceptKey", adj.conceptKey).eq("targetId", adj.targetId))
        .first();
      const patch = { ...adj, updatedAt: Date.now() };
      if (existing) await ctx.db.patch(existing._id, patch);
      else await ctx.db.insert("relevance_adjustments", patch);
    }
    return { ok: true, count: args.adjustments.length };
  },
});

/** Cheap hot-path read — the whole active (score > 0) adjustment set, for
 * lib/services/relevanceAdjustments.ts's in-memory cache. Small in practice
 * (only products/vendors with real negative signal ever appear here). */
export const getActiveAdjustments = query({
  args: { serverSecret: v.string() },
  handler: async (ctx, args) => {
    if (!verifyServerSecret(args.serverSecret)) return [];
    const rows = await ctx.db.query("relevance_adjustments").take(5000);
    return rows.filter((r) => r.score > 0);
  },
});
