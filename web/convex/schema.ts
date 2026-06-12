import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    email: v.string(),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    role: v.optional(v.literal("buyer")),
    passwordHash: v.optional(v.string()),
    createdAt: v.optional(v.number()),
  }).index("by_email", ["email"]),

  saved_products: defineTable({
    userId: v.id("users"),
    product: v.any(),
    savedAt: v.number(),
  }).index("by_user", ["userId"])
    .index("by_user_product", ["userId", "product.id"]),

  search_history: defineTable({
    userId: v.id("users"),
    query: v.string(),
    resultCount: v.number(),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  subscriptions: defineTable({
    userId: v.id("users"),
    plan: v.union(v.literal("free"), v.literal("premium")),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    currentPeriodEnd: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_user", ["userId"])
    .index("by_stripe_customer", ["stripeCustomerId"])
    .index("by_stripe_subscription", ["stripeSubscriptionId"]),

  taste_profile: defineTable({
    userId: v.id("users"),
    styles: v.optional(v.array(v.string())),
    budgetMin: v.optional(v.number()),
    budgetMax: v.optional(v.number()),
    currency: v.optional(v.string()),
    sizes: v.optional(v.any()),
    colors: v.optional(v.array(v.string())),
    occasions: v.optional(v.array(v.string())),
    notes: v.optional(v.string()),
    wardrobe: v.optional(v.object({
      items: v.array(v.object({
        type: v.string(),
        color: v.string(),
        style: v.string(),
        occasions: v.array(v.string()),
      })),
      summary: v.string(),
      gaps: v.array(v.string()),
      analyzedAt: v.number(),
    })),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  stylist_memory: defineTable({
    userId: v.id("users"),
    summary: v.string(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  verification_codes: defineTable({
    email: v.string(),
    code: v.string(),
    expiresAt: v.number(),
    used: v.boolean(),
    attempts: v.optional(v.number()),
  }).index("by_email", ["email"]),
});
# deployed 2026-06-12T11:42:08Z
