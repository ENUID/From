import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

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

export const getUserByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase().trim()))
      .first();
  },
});

export const recordConsent = mutation({
  args: {
    email: v.string(),
    consentAnalytics: v.boolean(),
    consentLocation: v.boolean(),
  },
  handler: async (ctx, args) => {
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
  },
  handler: async (ctx, args) => {
    const { email, ...rest } = args;
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
  args: { email: v.string(), name: v.string() },
  handler: async (ctx, args) => {
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
