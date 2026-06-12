import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Record one daily probe outcome for a brand. Accumulates consecutiveDown so a
 * persistently-unreachable store can be auto-pruned from search; a healthy
 * probe resets it so recovered stores rejoin automatically.
 */
export const recordProbe = mutation({
  args: {
    domain: v.string(),
    healthy: v.boolean(),
    productCount: v.number(),
  },
  handler: async (ctx, args) => {
    const domain = args.domain.toLowerCase().trim();
    const existing = await ctx.db
      .query("brand_health")
      .withIndex("by_domain", (q) => q.eq("domain", domain))
      .first();

    const consecutiveDown = args.healthy ? 0 : (existing?.consecutiveDown ?? 0) + 1;
    const patch = {
      domain,
      healthy: args.healthy,
      lastProductCount: args.productCount,
      consecutiveDown,
      lastProbedAt: Date.now(),
    };
    if (existing) await ctx.db.patch(existing._id, patch);
    else await ctx.db.insert("brand_health", patch);
    return { ok: true };
  },
});

/** Domains down for at least `minDown` consecutive probes — auto-prune list. */
export const getPrunedDomains = query({
  args: { minDown: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const threshold = args.minDown ?? 3;
    const rows = await ctx.db.query("brand_health").collect();
    return rows
      .filter((r) => !r.healthy && r.consecutiveDown >= threshold)
      .map((r) => r.domain);
  },
});

/** Full persisted health snapshot for the admin report. */
export const getAllHealth = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("brand_health").collect();
    return rows.sort((a, b) => b.consecutiveDown - a.consecutiveDown);
  },
});
