import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getUserByEmail(ctx: any, email: string) {
  return ctx.db
    .query("users")
    .withIndex("by_email", (q: any) => q.eq("email", email.toLowerCase().trim()))
    .first();
}

// ── Queries ───────────────────────────────────────────────────────────────────

export const getSubscription = query({
  args: { userEmail: v.string() },
  handler: async (ctx, args) => {
    const user = await getUserByEmail(ctx, args.userEmail);
    if (!user) return null;
    return ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .first();
  },
});

export const isPremium = query({
  args: { userEmail: v.string() },
  handler: async (ctx, args) => {
    const user = await getUserByEmail(ctx, args.userEmail);
    if (!user) return false;
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .first();
    if (!sub) return false;
    if (sub.plan !== "premium") return false;
    // Check expiry
    if (sub.currentPeriodEnd && sub.currentPeriodEnd < Date.now()) return false;
    return true;
  },
});

export const getDailySearchCount = query({
  args: { userEmail: v.string() },
  handler: async (ctx, args) => {
    const user = await getUserByEmail(ctx, args.userEmail);
    if (!user) return 0;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const entries = await ctx.db
      .query("search_history")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .collect();
    return entries.filter((e: any) => e.createdAt >= startOfDay.getTime()).length;
  },
});

// ── Mutations ─────────────────────────────────────────────────────────────────

export const ensureFreeSubscription = mutation({
  args: { userEmail: v.string() },
  handler: async (ctx, args) => {
    const user = await getUserByEmail(ctx, args.userEmail);
    if (!user) return null;
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .first();
    if (existing) return existing._id;
    return ctx.db.insert("subscriptions", {
      userId: user._id,
      plan: "free",
      createdAt: Date.now(),
    });
  },
});

export const upgradeSubscription = mutation({
  args: {
    userEmail: v.string(),
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.string(),
    currentPeriodEnd: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await getUserByEmail(ctx, args.userEmail);
    if (!user) throw new Error("User not found");
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        plan: "premium",
        stripeCustomerId: args.stripeCustomerId,
        stripeSubscriptionId: args.stripeSubscriptionId,
        currentPeriodEnd: args.currentPeriodEnd,
      });
      return existing._id;
    }
    return ctx.db.insert("subscriptions", {
      userId: user._id,
      plan: "premium",
      stripeCustomerId: args.stripeCustomerId,
      stripeSubscriptionId: args.stripeSubscriptionId,
      currentPeriodEnd: args.currentPeriodEnd,
      createdAt: Date.now(),
    });
  },
});

export const cancelSubscriptionByStripeCustomer = mutation({
  args: { stripeCustomerId: v.string() },
  handler: async (ctx, args) => {
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_stripe_customer", (q: any) =>
        q.eq("stripeCustomerId", args.stripeCustomerId)
      )
      .first();
    if (!sub) return null;
    await ctx.db.patch(sub._id, { plan: "free", currentPeriodEnd: undefined });
    return sub._id;
  },
});

export const setStripeCustomerId = mutation({
  args: { userEmail: v.string(), stripeCustomerId: v.string() },
  handler: async (ctx, args) => {
    const user = await getUserByEmail(ctx, args.userEmail);
    if (!user) throw new Error("User not found");
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .first();
    if (sub) {
      await ctx.db.patch(sub._id, { stripeCustomerId: args.stripeCustomerId });
    } else {
      await ctx.db.insert("subscriptions", {
        userId: user._id,
        plan: "free",
        stripeCustomerId: args.stripeCustomerId,
        createdAt: Date.now(),
      });
    }
  },
});
