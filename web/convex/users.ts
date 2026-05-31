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
    role: v.optional(v.union(v.literal("buyer"), v.literal("merchant"))),
  },
  handler: async (ctx, args) => {
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
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
      email: args.email,
      name: args.name,
      image: args.image,
      role: args.role || "buyer",
    });
  },
});

export const getUserByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
  },
});
