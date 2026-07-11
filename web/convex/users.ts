import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { authProofValidator, verifyAuthProof } from "./lib/authProof";
import { verifyServerSecret } from "./lib/serverAuth";

/**
 * Ensures a user exists in the database. Called during NextAuth sign-in.
 */
export const ensureUser = mutation({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    role: v.optional(v.literal("buyer")),
  },
  handler: async (ctx, args) => {
    const email = args.email.toLowerCase().trim();
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (existingUser) {
      // Update existing user info if it changed
      if (
        existingUser.name !== args.name ||
        existingUser.image !== args.image
      ) {
        await ctx.db.patch(existingUser._id, {
          name: args.name,
          image: args.image,
        });
      }
      return existingUser._id;
    }

    // Create new user
    return await ctx.db.insert("users", {
      email,
      name: args.name,
      image: args.image,
      role: "buyer",
      createdAt: Date.now(),
    });
  },
});

export const createUser = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    passwordHash: v.string(),
  },
  handler: async (ctx, args) => {
    const email = args.email.toLowerCase().trim();
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (existing) {
      throw new Error("EMAIL_EXISTS");
    }

    return await ctx.db.insert("users", {
      name: args.name.trim(),
      email,
      passwordHash: args.passwordHash,
      role: "buyer",
      createdAt: Date.now(),
    });
  },
});

// Called both from our own server (the login flow, before any session
// exists — verified via serverSecret) and from the client fetching the
// signed-in shopper's own record (verified via authProof). Either is
// sufficient; a request needs to hold one or the other, never neither.
export const getUserByEmail = query({
  args: {
    email: v.string(),
    authProof: v.optional(authProofValidator),
    serverSecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const serverOk = verifyServerSecret(args.serverSecret);
    const selfOk = !serverOk && (await verifyAuthProof(args.authProof, args.email));
    if (!serverOk && !selfOk) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase().trim()))
      .first();
    if (!user) return null;
    // Strip fields that must not be exposed to the browser
    const { passwordHash: _ph, ipAddress: _ip, lat: _lat, lng: _lng, ...safe } = user as any;
    return safe;
  },
});

export const recordConsent = mutation({
  args: {
    email: v.string(),
    consentAnalytics: v.boolean(),
    consentLocation: v.boolean(),
    authProof: authProofValidator,
  },
  handler: async (ctx, args) => {
    if (!(await verifyAuthProof(args.authProof, args.email))) throw new Error("Unauthorized");
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase().trim()))
      .first();
    if (!user) return null;
    await ctx.db.patch(user._id, {
      consentAnalytics: args.consentAnalytics,
      consentLocation: args.consentLocation,
      consentGivenAt: Date.now(),
    });
    return user._id;
  },
});

export const recordIdentity = mutation({
  args: {
    email: v.string(),
    country: v.optional(v.string()),
    countryCode: v.optional(v.string()),
    city: v.optional(v.string()),
    timezone: v.optional(v.string()),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    deviceType: v.optional(v.string()),
    browser: v.optional(v.string()),
    os: v.optional(v.string()),
    language: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    authProof: authProofValidator,
  },
  handler: async (ctx, args) => {
    if (!(await verifyAuthProof(args.authProof, args.email))) throw new Error("Unauthorized");
    const { email, authProof, ...rest } = args;
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email.toLowerCase().trim()))
      .first();
    if (!user) return null;
    await ctx.db.patch(user._id, { ...rest, lastSeenAt: Date.now() });
    return user._id;
  },
});

export const updateUserName = mutation({
  args: { email: v.string(), name: v.string(), authProof: authProofValidator },
  handler: async (ctx, args) => {
    if (!(await verifyAuthProof(args.authProof, args.email))) throw new Error("Unauthorized");
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase().trim()))
      .first();
    if (!user) return null;
    await ctx.db.patch(user._id, { name: args.name.trim() });
    return user._id;
  },
});

export const trackEvent = mutation({
  args: {
    email: v.optional(v.string()),
    event: v.string(),
    properties: v.optional(v.any()),
    country: v.optional(v.string()),
    city: v.optional(v.string()),
    deviceType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let userId: any = undefined;
    if (args.email) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", args.email!.toLowerCase().trim()))
        .first();
      userId = user?._id;
    }
    await ctx.db.insert("user_events", {
      userId,
      event: args.event,
      properties: args.properties,
      country: args.country,
      city: args.city,
      deviceType: args.deviceType,
      createdAt: Date.now(),
    });
  },
});

/**
 * Aggregates "ai_usage" events (logged via trackEvent from the stylist route
 * — see logAiUsage in app/api/ai/stylist/route.ts) over a trailing window.
 * Read by the secret-gated /api/ai/stylist/health endpoint so token/request
 * consumption is actually visible somewhere, not just inferred from provider
 * dashboards after the fact. Token counts are estimates (chars/4), not exact
 * provider-reported usage — good enough to reason about headroom, not a
 * billing-grade figure.
 */
export const getAiUsageSummary = query({
  args: {
    windowMs: v.optional(v.number()), // defaults to 24h
  },
  handler: async (ctx, args) => {
    const since = Date.now() - (args.windowMs ?? 24 * 60 * 60 * 1000);
    const events = await ctx.db
      .query("user_events")
      .withIndex("by_event", (q) => q.eq("event", "ai_usage"))
      .filter((q) => q.gte(q.field("createdAt"), since))
      .collect();

    const byProvider: Record<string, { requests: number; estPromptTokens: number; estCompletionTokensCap: number; failures: number }> = {};
    const byPath: Record<string, number> = {};
    let totalRequests = 0;
    let totalEstPromptTokens = 0;
    let totalEstCompletionTokensCap = 0;

    for (const e of events) {
      const p = (e.properties ?? {}) as Record<string, any>;
      const provider = String(p.provider ?? "unknown");
      const path = String(p.path ?? "unknown");
      const promptTokens = Number(p.estPromptTokens ?? 0);
      const completionCap = Number(p.estCompletionTokensCap ?? 0);

      totalRequests++;
      totalEstPromptTokens += promptTokens;
      totalEstCompletionTokensCap += completionCap;
      byPath[path] = (byPath[path] ?? 0) + 1;

      if (!byProvider[provider]) byProvider[provider] = { requests: 0, estPromptTokens: 0, estCompletionTokensCap: 0, failures: 0 };
      byProvider[provider].requests++;
      byProvider[provider].estPromptTokens += promptTokens;
      byProvider[provider].estCompletionTokensCap += completionCap;
      if (p.ok === false) byProvider[provider].failures++;
    }

    return {
      windowMs: args.windowMs ?? 24 * 60 * 60 * 1000,
      totalRequests,
      totalEstPromptTokens,
      totalEstCompletionTokensCap,
      byProvider,
      byPath,
    };
  },
});
