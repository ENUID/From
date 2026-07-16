import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { verifyServerSecret } from "./lib/serverAuth";

/**
 * Trend-concepts persistence — the missing back half of the style-signals
 * cron. The cron distills 8–12 emerging aesthetic concepts from real search
 * volume every ~2 days; before this table its output went to console.log and
 * evaporated. Now it lands here, and the LLM relevance judge reads it as
 * light context via lib/services/trendConcepts.ts (context only — a trend is
 * a nudge, never a filter).
 *
 * Server-to-server only (the cron writes, the search stack reads) — gated on
 * serverSecret, same as every other internal aggregate table.
 */

/** Replace the trend set wholesale with the cron's latest distillation.
 *  firstSeenAt survives replacement for concepts that persist run-to-run,
 *  so a long-running trend is distinguishable from this week's blip. */
export const replaceTrendConcepts = mutation({
  args: {
    concepts: v.array(v.string()),
    serverSecret: v.string(),
  },
  handler: async (ctx, args) => {
    if (!verifyServerSecret(args.serverSecret)) return { ok: false };
    const now = Date.now();
    const incoming = Array.from(
      new Set(
        args.concepts
          .map((c) => c.toLowerCase().trim().slice(0, 60))
          .filter((c) => c.length >= 3)
      )
    ).slice(0, 16);

    const existing = await ctx.db.query("trend_concepts").collect();
    const firstSeen = new Map(existing.map((r) => [r.concept, r.firstSeenAt]));
    for (const row of existing) await ctx.db.delete(row._id);
    for (const concept of incoming) {
      await ctx.db.insert("trend_concepts", {
        concept,
        firstSeenAt: firstSeen.get(concept) ?? now,
        lastSeenAt: now,
      });
    }
    return { ok: true, count: incoming.length };
  },
});

/** Current trend set, freshest first. */
export const getTrendConcepts = query({
  args: { serverSecret: v.string() },
  handler: async (ctx, args) => {
    if (!verifyServerSecret(args.serverSecret)) return [];
    const rows = await ctx.db.query("trend_concepts").collect();
    return rows
      .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
      .map((r) => ({ concept: r.concept, firstSeenAt: r.firstSeenAt, lastSeenAt: r.lastSeenAt }));
  },
});
