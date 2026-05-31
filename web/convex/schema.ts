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
    product: v.object({
      id: v.string(),
      title: v.string(),
      vendor: v.string(),
      handle: v.string(),
      store_url: v.string(),
      price: v.number(),
      currency: v.optional(v.string()),
      base_currency: v.optional(v.string()),
      tags: v.array(v.string()),
      in_stock: v.boolean(),
      merchant_id: v.optional(v.string()),
      image_url: v.optional(v.string()),
      description: v.optional(v.string()),
      product_type: v.optional(v.string()),
      options: v.optional(
        v.array(
          v.object({
            name: v.string(),
            values: v.array(v.string()),
          })
        )
      ),
      variants: v.optional(
        v.array(
          v.object({
            shopify_variant_id: v.string(),
            price: v.number(),
            title: v.string(),
            inventory_quantity: v.number(),
          })
        )
      ),
    }),
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
