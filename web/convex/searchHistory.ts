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
    return ctx.db
      .query("search_history")
      .order("desc")
      .filter((q) => q.gte(q.field("createdAt"), args.cutoff))
      .take(200);
  },
});
