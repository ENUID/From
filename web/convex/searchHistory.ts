import { query } from "./_generated/server";
import { v } from "convex/values";
import { verifyServerSecret } from "./lib/serverAuth";

// Returns every signed-in user's recent search queries plus their internal
// user id, across the whole app — real behavioral data, not just this
// caller's own. Only the trend-signal cron job should ever see it.
export const getRecentSearches = query({
  args: { cutoff: v.number(), serverSecret: v.string() },
  handler: async (ctx, args) => {
    if (!verifyServerSecret(args.serverSecret)) return [];
    // Range on the createdAt index (newest first) so a low-traffic window that
    // never fills the 200 stops at the cutoff instead of scanning the whole
    // ever-growing table.
    return ctx.db
      .query("search_history")
      .withIndex("by_created", (q) => q.gte("createdAt", args.cutoff))
      .order("desc")
      .take(200);
  },
});
