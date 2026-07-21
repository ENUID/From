import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { verifyServerSecret } from "./lib/serverAuth";
import { verifyAdminSecret } from "./lib/adminAuth";

// The self-improving loop's memory: LLM-generated improvement recommendations,
// written by the analyze route + weekly cron (serverSecret), read by the
// dashboard + report (adminSecret). Kept small — last ~20.

export const writeInsight = mutation({
  args: {
    serverSecret: v.string(),
    windowDays: v.number(),
    content: v.string(),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!verifyServerSecret(args.serverSecret)) throw new Error("Unauthorized");
    await ctx.db.insert("learning_insights", {
      createdAt: Date.now(),
      windowDays: args.windowDays,
      content: args.content.slice(0, 20000),
      model: args.model,
    });
    // Prune to the newest 20.
    const all = await ctx.db.query("learning_insights").withIndex("by_created").order("desc").collect();
    for (let i = 20; i < all.length; i++) await ctx.db.delete(all[i]._id);
    return { ok: true };
  },
});

export const getLatest = query({
  args: { adminSecret: v.string() },
  handler: async (ctx, args) => {
    if (!verifyAdminSecret(args.adminSecret)) return null;
    const rows = await ctx.db.query("learning_insights").withIndex("by_created").order("desc").take(1);
    return rows[0] ?? null;
  },
});

export const getRecent = query({
  args: { adminSecret: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    if (!verifyAdminSecret(args.adminSecret)) return [];
    return await ctx.db.query("learning_insights").withIndex("by_created").order("desc").take(Math.min(Math.max(args.limit ?? 10, 1), 50));
  },
});
