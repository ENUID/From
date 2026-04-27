import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.string(),
    passwordHash: v.string(),
    createdAt: v.number(),
  })
    .index("by_email", ["email"]),


  merchants: defineTable({
    owner_user_id: v.string(),
    shop_name: v.string(),
    shop_domain: v.string(),
    public_store_domain: v.optional(v.string()),
    base_currency: v.optional(v.string()),
    access_token: v.string(),
    token_expires_at: v.optional(v.number()),
    refresh_token: v.optional(v.string()),
    refresh_token_expires_at: v.optional(v.number()),
    currency: v.optional(v.string()),
    is_active: v.boolean(),
    last_sync_at: v.optional(v.number()),
    last_sync_error: v.optional(v.string()),
  })
    .index("by_owner", ["owner_user_id"])
    .index("by_domain", ["shop_domain"]),

  products: defineTable({
    merchant_id: v.id("merchants"),
    shopify_product_id: v.optional(v.string()),
    title: v.string(),
    description: v.optional(v.string()),
    vendor: v.optional(v.string()),
    handle: v.string(),
    product_type: v.optional(v.string()),
    tags: v.array(v.string()),
    status: v.string(),
    // Giữ vector index 768 dims; OpenAI text-embedding-3-small sẽ được request với dimensions=768.
    embedding: v.optional(v.array(v.float64())),
    embedding_status: v.optional(v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("embedded"),
      v.literal("failed"),
    )),
    embedding_model: v.optional(v.string()),
    embedding_updated_at: v.optional(v.number()),
    embedding_content_hash: v.optional(v.string()),
    embedding_error: v.optional(v.string()),
  })
    .index("by_merchant", ["merchant_id"])
    .index("by_status", ["status"])
    .index("by_merchant_status", ["merchant_id", "status"])
    .index("by_embedding_status", ["embedding_status"])
    .index("by_merchant_embedding_status", ["merchant_id", "embedding_status"])
    .index("by_shopify_id", ["shopify_product_id"])
    .index("by_merchant_shopify_id", ["merchant_id", "shopify_product_id"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 768,
      filterFields: ["status"],
    }),

  product_variants: defineTable({
    product_id: v.id("products"),
    merchant_id: v.id("merchants"),
    shopify_variant_id: v.string(),
    title: v.string(),
    price: v.float64(),
    inventory_quantity: v.number(),
    inventory_policy: v.optional(v.string()),
  })
    .index("by_product", ["product_id"])
    .index("by_shopify_variant", ["shopify_variant_id"])
    .index("by_merchant_shopify_variant", ["merchant_id", "shopify_variant_id"]),
});
