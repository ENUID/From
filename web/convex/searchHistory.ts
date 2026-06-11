import { query } from "./_generated/server";
import { v } from "convex/values";

export const getRecentSearches = query({
  args: { cutoff: v.number() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("search_history")
      .order("desc")
      .filter((q) => q.gte(q.field("createdAt"), args.cutoff))
      .take(200);
  },
});
