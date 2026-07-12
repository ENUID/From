import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { verifyServerSecret } from "./lib/serverAuth";

// Relevance ordering for a stable query + candidate set doesn't drift
// minute to minute the way raw catalog inventory can — a much longer TTL
// than search_cache's 15 minutes is safe here, and it's what makes this
// cache actually absorb repeat searches instead of expiring before a second
// shopper ever benefits from the first shopper's LLM judge call.
const TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

/** Return a cached rerank result for this key if still fresh, else null. */
export const get = query({
  args: { key: v.string(), serverSecret: v.string() },
  handler: async (ctx, args) => {
    if (!verifyServerSecret(args.serverSecret)) return null;
    const row = await ctx.db
      .query("rerank_cache")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    if (!row) return null;
    if (Date.now() - row.createdAt > TTL_MS) return null;
    return { ids: row.ids, scores: row.scores, createdAt: row.createdAt };
  },
});

/** Upsert a fresh rerank result. Best-effort; callers ignore failures. */
export const set = mutation({
  args: { key: v.string(), ids: v.string(), scores: v.string(), serverSecret: v.string() },
  handler: async (ctx, args) => {
    if (!verifyServerSecret(args.serverSecret)) return { ok: false };
    const existing = await ctx.db
      .query("rerank_cache")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { ids: args.ids, scores: args.scores, createdAt: Date.now() });
    } else {
      await ctx.db.insert("rerank_cache", { key: args.key, ids: args.ids, scores: args.scores, createdAt: Date.now() });
    }
    return { ok: true };
  },
});
