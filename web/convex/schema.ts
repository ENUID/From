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
    // Consent
    consentAnalytics: v.optional(v.boolean()),
    consentLocation: v.optional(v.boolean()),
    consentGivenAt: v.optional(v.number()),
    // Geo + device (collected after consent)
    country: v.optional(v.string()),
    countryCode: v.optional(v.string()),
    city: v.optional(v.string()),
    timezone: v.optional(v.string()),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    deviceType: v.optional(v.string()),   // "mobile" | "tablet" | "desktop"
    browser: v.optional(v.string()),
    os: v.optional(v.string()),
    language: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    lastSeenAt: v.optional(v.number()),
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

  // Event stream — one row per meaningful user action (search, save, flag, outfit_view…).
  // Queried by the style-signals cron and the admin dashboard.
  user_events: defineTable({
    userId: v.optional(v.id("users")),
    event: v.string(),              // "search" | "save" | "flag" | "outfit_view" | "page_view" …
    properties: v.optional(v.any()),
    country: v.optional(v.string()),
    city: v.optional(v.string()),
    deviceType: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_user", ["userId"])
    .index("by_event", ["event"])
    .index("by_created", ["createdAt"]),

  // Admin-managed allowlist: emails granted Community access without a Stripe sub.
  // Managed via the private /api/admin/community-access route (ADMIN_SECRET protected).
  community_allowlist: defineTable({
    email: v.string(),
    note: v.optional(v.string()),       // who/why — for the admin's own reference
    grantedAt: v.number(),
  }).index("by_email", ["email"]),

  // Learning loop: explicit relevance feedback. A shopper flagging a result as
  // a bad match is the highest-signal training data the search can get — these
  // accumulate for periodic review and rerank/threshold tuning.
  quality_signals: defineTable({
    userId: v.optional(v.id("users")),
    query: v.string(),
    productId: v.string(),
    productTitle: v.optional(v.string()),
    vendor: v.optional(v.string()),
    signal: v.union(v.literal("bad_match"), v.literal("good_match")),
    reason: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_signal", ["signal"])
    .index("by_query", ["query"]),

  // Persisted brand health from the daily probe. consecutiveDown drives
  // auto-pruning: a store down for several days running is skipped in search
  // until it recovers (a healthy probe resets the counter).
  brand_health: defineTable({
    domain: v.string(),
    healthy: v.boolean(),
    lastProductCount: v.number(),
    consecutiveDown: v.number(),
    lastProbedAt: v.number(),
  }).index("by_domain", ["domain"]),

  // Persistent search cache — lets the existing 15-minute result cache survive
  // serverless cold starts. Same freshness window as in-memory; entries past
  // TTL are ignored. Discovery only — checkout/detail always hit the live store.
  search_cache: defineTable({
    key: v.string(),         // hash of query + country + brands
    products: v.string(),    // JSON-encoded product snapshot (capped)
    createdAt: v.number(),
  }).index("by_key", ["key"]),

  // Vision-classified image ordering — caches the model-shot-first ordering for
  // a product's photo set so the costly vision call runs once per product, ever.
  // Orderings are stable, so there is no TTL; the key is a hash of the URL set.
  image_order: defineTable({
    key: v.string(),         // hash of the image URL set
    order: v.string(),       // JSON array of URLs, on-body shots first
    createdAt: v.number(),
  }).index("by_key", ["key"]),
});
