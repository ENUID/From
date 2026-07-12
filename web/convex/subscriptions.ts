import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { authProofValidator, verifyAuthProof } from "./lib/authProof";
import { verifyAdminSecret } from "./lib/adminAuth";
import { verifyServerSecret } from "./lib/serverAuth";

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getUserByEmail(ctx: any, email: string) {
  return ctx.db
    .query("users")
    .withIndex("by_email", (q: any) => q.eq("email", email.toLowerCase().trim()))
    .first();
}

// ── Queries ───────────────────────────────────────────────────────────────────

export const getSubscription = query({
  args: { userEmail: v.string(), authProof: authProofValidator },
  handler: async (ctx, args) => {
    if (!(await verifyAuthProof(args.authProof, args.userEmail))) return null;
    const user = await getUserByEmail(ctx, args.userEmail);
    if (!user) return null;
    return ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .first();
  },
});

export const isPremium = query({
  args: { userEmail: v.string(), authProof: authProofValidator },
  handler: async (ctx, args) => {
    if (!(await verifyAuthProof(args.authProof, args.userEmail))) return false;
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
  args: { userEmail: v.string(), authProof: authProofValidator },
  handler: async (ctx, args) => {
    if (!(await verifyAuthProof(args.authProof, args.userEmail))) return 0;
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
  args: { userEmail: v.string(), authProof: authProofValidator },
  handler: async (ctx, args) => {
    if (!(await verifyAuthProof(args.authProof, args.userEmail))) return null;
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

// Only ever called from app/api/billing/webhook/route.ts, after Stripe's own
// signature verification — but that route-level trust doesn't extend to
// Convex, since NEXT_PUBLIC_CONVEX_URL is public. Without this gate, anyone
// could call this directly and grant themselves (or anyone) free premium.
export const upgradeSubscription = mutation({
  args: {
    userEmail: v.string(),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.string(),
    currentPeriodEnd: v.number(),
    serverSecret: v.string(),
  },
  handler: async (ctx, args) => {
    if (!verifyServerSecret(args.serverSecret)) throw new Error("Unauthorized");
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

// Same reasoning as upgradeSubscription above — Stripe-webhook-only, gated
// so it can't be called directly to cancel an arbitrary subscription.
export const cancelSubscriptionByStripeCustomer = mutation({
  args: { stripeCustomerId: v.string(), serverSecret: v.string() },
  handler: async (ctx, args) => {
    if (!verifyServerSecret(args.serverSecret)) throw new Error("Unauthorized");
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

// ── Community allowlist (admin-managed free Community access) ─────────────────

// Only ever checked for the CALLER's own email (see app/api/community/me),
// so this uses the same self-identity authProof as everything else above —
// not the admin secret, which is for managing OTHER users' access below.
export const isOnAllowlist = query({
  args: { email: v.string(), authProof: authProofValidator },
  handler: async (ctx, args) => {
    if (!(await verifyAuthProof(args.authProof, args.email))) return false;
    const entry = await ctx.db
      .query("community_allowlist")
      .withIndex("by_email", (q: any) => q.eq("email", args.email.toLowerCase().trim()))
      .first()
    return entry !== null
  },
})

// These three manage OTHER users' access, not the caller's own — there's no
// "self" to prove, so they're gated by the same admin secret
// app/api/admin/community-access/route.ts already checks, now ALSO
// re-verified here. Previously these had no argument-level check at all:
// the route's ADMIN_SECRET gate was trivially bypassable by calling Convex
// directly (it's a public endpoint), letting anyone grant themselves free
// premium/community access.
export const listAllowlist = query({
  args: { adminSecret: v.string() },
  handler: async (ctx, args) => {
    if (!verifyAdminSecret(args.adminSecret)) return []
    return ctx.db.query("community_allowlist").order("desc").collect()
  },
})

export const grantAllowlistAccess = mutation({
  args: { email: v.string(), note: v.optional(v.string()), adminSecret: v.string() },
  handler: async (ctx, args) => {
    if (!verifyAdminSecret(args.adminSecret)) throw new Error("Unauthorized")
    const email = args.email.toLowerCase().trim()
    const existing = await ctx.db
      .query("community_allowlist")
      .withIndex("by_email", (q: any) => q.eq("email", email))
      .first()
    if (existing) return existing._id
    return ctx.db.insert("community_allowlist", { email, note: args.note, grantedAt: Date.now() })
  },
})

export const revokeAllowlistAccess = mutation({
  args: { email: v.string(), adminSecret: v.string() },
  handler: async (ctx, args) => {
    if (!verifyAdminSecret(args.adminSecret)) throw new Error("Unauthorized")
    const email = args.email.toLowerCase().trim()
    const entry = await ctx.db
      .query("community_allowlist")
      .withIndex("by_email", (q: any) => q.eq("email", email))
      .first()
    if (!entry) return null
    await ctx.db.delete(entry._id)
    return entry._id
  },
})

export const setStripeCustomerId = mutation({
  args: { userEmail: v.string(), stripeCustomerId: v.string(), authProof: authProofValidator },
  handler: async (ctx, args) => {
    if (!(await verifyAuthProof(args.authProof, args.userEmail))) throw new Error("Unauthorized");
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
