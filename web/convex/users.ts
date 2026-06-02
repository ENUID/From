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
