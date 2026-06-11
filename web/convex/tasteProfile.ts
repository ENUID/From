import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

async function getUserByEmail(ctx: any, email: string) {
  return ctx.db
    .query("users")
    .withIndex("by_email", (q: any) => q.eq("email", email.toLowerCase().trim()))
    .first();
}

export const getTasteProfile = query({
  args: { userEmail: v.string() },
  handler: async (ctx, args) => {
    const user = await getUserByEmail(ctx, args.userEmail);
    if (!user) return null;
    return ctx.db
      .query("taste_profile")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .first();
  },
});

export const upsertTasteProfile = mutation({
  args: {
    userEmail: v.string(),
    styles: v.optional(v.array(v.string())),
    budgetMin: v.optional(v.number()),
    budgetMax: v.optional(v.number()),
    sizes: v.optional(v.any()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getUserByEmail(ctx, args.userEmail);
    if (!user) throw new Error("User not found");
    const existing = await ctx.db
      .query("taste_profile")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .first();
    const data: any = { updatedAt: Date.now() };
    if (args.styles !== undefined) data.styles = args.styles;
    if (args.budgetMin !== undefined) data.budgetMin = args.budgetMin;
    if (args.budgetMax !== undefined) data.budgetMax = args.budgetMax;
    if (args.sizes !== undefined) data.sizes = args.sizes;
    if (args.notes !== undefined) data.notes = args.notes;
    if (existing) {
      await ctx.db.patch(existing._id, data);
      return existing._id;
    }
    return ctx.db.insert("taste_profile", { userId: user._id, ...data });
  },
});

export const upsertWardrobeAnalysis = mutation({
  args: {
    userEmail: v.string(),
    wardrobe: v.object({
      items: v.array(v.object({
        type: v.string(),
        color: v.string(),
        style: v.string(),
        occasions: v.array(v.string()),
      })),
      summary: v.string(),
      gaps: v.array(v.string()),
      analyzedAt: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    const user = await getUserByEmail(ctx, args.userEmail);
    if (!user) throw new Error("User not found");
    const existing = await ctx.db
      .query("taste_profile")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { wardrobe: args.wardrobe, updatedAt: Date.now() });
      return existing._id;
    }
    return ctx.db.insert("taste_profile", { userId: user._id, wardrobe: args.wardrobe, updatedAt: Date.now() });
  },
});
