import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    email: v.string(),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    role: v.optional(v.union(v.literal("buyer"), v.literal("merchant"))),
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
});
