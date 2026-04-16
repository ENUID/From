import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

function buildEmbeddingSource(args: {
  title: string;
  description?: string;
  vendor?: string;
  handle: string;
  product_type?: string;
  tags: string[];
}) {
  return [
    args.title.trim(),
    (args.description ?? "").trim(),
    (args.vendor ?? "").trim(),
    args.handle.trim(),
    (args.product_type ?? "").trim(),
    [...args.tags].sort().join("|"),
  ].join("\n");
}

function hashEmbeddingSource(input: string) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a:${(hash >>> 0).toString(16)}`;
}

function normalizeStoreDomain(domain?: string) {
  return (domain ?? "").trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function serializeMerchantForClient(merchant: {
  _id: Id<"merchants">;
  shop_name: string;
  shop_domain: string;
  public_store_domain?: string;
  currency?: string;
  is_active: boolean;
}) {
  return {
    _id: merchant._id,
    shop_name: merchant.shop_name,
    shop_domain: merchant.shop_domain,
    public_store_domain: merchant.public_store_domain,
    currency: merchant.currency,
    is_active: merchant.is_active,
  };
}

export const listByUser = query({
  args: { owner_user_id: v.string() },
  handler: async (ctx, { owner_user_id }) => {
    const merchants = await ctx.db
      .query("merchants")
      .withIndex("by_owner", q => q.eq("owner_user_id", owner_user_id))
      .filter(q => q.eq(q.field("is_active"), true))
      .collect()

    return merchants.map((merchant) => serializeMerchantForClient(merchant))
  },
})

export const getStoreForOwner = query({
  args: {
    owner_user_id: v.string(),
    merchant_id: v.id("merchants"),
  },
  handler: async (ctx, { owner_user_id, merchant_id }) => {
    const merchant = await ctx.db.get(merchant_id)
    if (!merchant) return null
    if (merchant.owner_user_id !== owner_user_id) return null
    if (!merchant.is_active) return null
    return merchant
  },
})

export const getStoreForSync = query({
  args: {
    owner_user_id: v.string(),
    merchant_id: v.id("merchants"),
  },
  handler: async (ctx, { owner_user_id, merchant_id }) => {
    const merchant = await ctx.db.get(merchant_id)
    if (!merchant) return null
    if (merchant.owner_user_id !== owner_user_id && merchant.owner_user_id !== "undefined" && merchant.owner_user_id) {
      return null
    }
    return merchant
  },
})

export const saveStore = mutation({
  args: {
    owner_user_id: v.string(),
    shop_domain: v.string(),
    public_store_domain: v.optional(v.string()),
    shop_name: v.string(),
    access_token: v.string(),
    token_expires_at: v.optional(v.number()),
    refresh_token: v.optional(v.string()),
    refresh_token_expires_at: v.optional(v.number()),
    currency: v.optional(v.string()),
    is_active: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("merchants")
      .withIndex("by_domain", q => q.eq("shop_domain", args.shop_domain))
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, {
        access_token: args.access_token,
        token_expires_at: args.token_expires_at,
        refresh_token: args.refresh_token,
        refresh_token_expires_at: args.refresh_token_expires_at,
        shop_name: args.shop_name,
        public_store_domain: normalizeStoreDomain(args.public_store_domain) || undefined,
        owner_user_id: args.owner_user_id,
        currency: args.currency,
        is_active: true,
      })
      return existing._id
    }

    return await ctx.db.insert("merchants", {
      ...args,
      public_store_domain: normalizeStoreDomain(args.public_store_domain) || undefined,
    })
  },
})

export const updateToken = mutation({
  args: {
    merchant_id: v.string(),
    access_token: v.string(),
    token_expires_at: v.optional(v.number()),
    refresh_token: v.optional(v.string()),
    refresh_token_expires_at: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const id = args.merchant_id as Id<"merchants">
    await ctx.db.patch(id, {
      access_token: args.access_token,
      token_expires_at: args.token_expires_at,
      refresh_token: args.refresh_token,
      refresh_token_expires_at: args.refresh_token_expires_at,
    })
  },
})

export const deactivateStore = mutation({
  args: { merchant_id: v.id("merchants") },
  handler: async (ctx, { merchant_id }) => {
    await ctx.db.patch(merchant_id, { is_active: false })
  },
})

export const list = query({
  args: {},
  handler: async (ctx) => {
    const merchants = await ctx.db.query("merchants").collect()
    return merchants.map((merchant) => serializeMerchantForClient(merchant))
  },
})

export const upsert = mutation({
  args: {
    shop_name: v.string(),
    shop_domain: v.string(),
    public_store_domain: v.optional(v.string()),
    currency: v.optional(v.string()),
    is_active: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("merchants")
      .withIndex("by_domain", q => q.eq("shop_domain", args.shop_domain))
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args,
        public_store_domain: normalizeStoreDomain(args.public_store_domain) || undefined,
      })
      return existing._id
    }

    return await ctx.db.insert("merchants", {
      ...args,
      public_store_domain: normalizeStoreDomain(args.public_store_domain) || undefined,
      owner_user_id: "system",
      access_token: "",
    })
  },
})

export const updateStoreProfile = mutation({
  args: {
    merchant_id: v.string(),
    owner_user_id: v.optional(v.string()),
    shop_name: v.optional(v.string()),
    public_store_domain: v.optional(v.string()),
    currency: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const id = args.merchant_id as Id<"merchants">
    const patch: {
      owner_user_id?: string
      shop_name?: string
      public_store_domain?: string
      currency?: string
    } = {}

    if (typeof args.owner_user_id === "string") patch.owner_user_id = args.owner_user_id

    if (typeof args.shop_name === "string") patch.shop_name = args.shop_name
    if (typeof args.public_store_domain === "string") {
      patch.public_store_domain = normalizeStoreDomain(args.public_store_domain) || undefined
    }
    if (typeof args.currency === "string") patch.currency = args.currency

    await ctx.db.patch(id, patch)
  },
})

export const recordSyncResult = mutation({
  args: {
    merchant_id: v.id("merchants"),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { merchant_id, error }) => {
    await ctx.db.patch(merchant_id, {
      last_sync_at: Date.now(),
      last_sync_error: error || undefined,
    })
  },
})

export const backfillPublicStoreDomains = mutation({
  args: {},
  handler: async (ctx) => {
    const merchants = await ctx.db.query("merchants").collect()
    let updated = 0
    for (const merchant of merchants) {
      if (merchant.public_store_domain) continue
      await ctx.db.patch(merchant._id, {
        public_store_domain: normalizeStoreDomain(merchant.shop_domain) || undefined,
      })
      updated++
    }
    return { updated }
  },
})

export const upsertProduct = mutation({
  args: {
    merchant_id: v.string(),
    shopify_product_id: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    vendor: v.optional(v.string()),
    handle: v.string(),
    product_type: v.optional(v.string()),
    tags: v.array(v.string()),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const merchantId = args.merchant_id as Id<"merchants">
    const nextContentHash = hashEmbeddingSource(buildEmbeddingSource(args))

    const existing = await ctx.db
      .query("products")
      .withIndex("by_merchant_shopify_id", q =>
        q.eq("merchant_id", merchantId).eq("shopify_product_id", args.shopify_product_id)
      )
      .first()

    if (existing) {
      const previousHash = existing.embedding_content_hash ?? hashEmbeddingSource(buildEmbeddingSource({
        title: existing.title,
        description: existing.description,
        vendor: existing.vendor,
        handle: existing.handle,
        product_type: existing.product_type,
        tags: existing.tags ?? [],
      }))
      const embeddingChanged = previousHash !== nextContentHash

      await ctx.db.patch(existing._id, {
        title: args.title,
        description: args.description,
        vendor: args.vendor,
        handle: args.handle,
        product_type: args.product_type,
        tags: args.tags,
        status: args.status,
        embedding: embeddingChanged ? undefined : existing.embedding,
        embedding_status: embeddingChanged
          ? "pending"
          : existing.embedding_status ?? (existing.embedding?.length ? "embedded" : "pending"),
        embedding_model: embeddingChanged ? undefined : existing.embedding_model,
        embedding_updated_at: embeddingChanged ? undefined : existing.embedding_updated_at,
        embedding_content_hash: nextContentHash,
        embedding_error: undefined,
      })
      return existing._id as string
    }

    const newId = await ctx.db.insert("products", {
      merchant_id: merchantId,
      shopify_product_id: args.shopify_product_id,
      title: args.title,
      description: args.description ?? "",
      vendor: args.vendor ?? "",
      handle: args.handle,
      product_type: args.product_type ?? "",
      tags: args.tags,
      status: args.status,
      embedding_status: "pending",
      embedding_content_hash: nextContentHash,
    })
    return newId as string
  },
})

export const deactivateMissingProducts = mutation({
  args: {
    merchant_id: v.string(),
    active_shopify_product_ids: v.array(v.string()),
  },
  handler: async (ctx, { merchant_id, active_shopify_product_ids }) => {
    const merchantId = merchant_id as Id<"merchants">
    const products = await ctx.db
      .query("products")
      .withIndex("by_merchant", q => q.eq("merchant_id", merchantId))
      .collect()

    const activeIds = new Set(active_shopify_product_ids)
    let deactivated = 0

    for (const product of products) {
      const shopifyId = product.shopify_product_id ?? ""
      if (!shopifyId) continue
      if (activeIds.has(shopifyId)) continue
      if (product.status === "inactive") continue
      await ctx.db.patch(product._id, { status: "inactive" })
      deactivated++
    }

    return { deactivated }
  },
})

export const backfillEmbeddingContentHashes = mutation({
  args: {},
  handler: async (ctx) => {
    const products = await ctx.db.query("products").collect()
    let updated = 0

    for (const product of products) {
      const nextContentHash = hashEmbeddingSource(buildEmbeddingSource({
        title: product.title,
        description: product.description,
        vendor: product.vendor,
        handle: product.handle,
        product_type: product.product_type,
        tags: product.tags ?? [],
      }))

      if (product.embedding_content_hash === nextContentHash) continue

      await ctx.db.patch(product._id, {
        embedding_content_hash: nextContentHash,
      })
      updated++
    }

    return { total: products.length, updated }
  },
})

export const upsertVariant = mutation({
  args: {
    product_id: v.string(),
    merchant_id: v.string(),
    shopify_variant_id: v.string(),
    title: v.string(),
    price: v.float64(),
    inventory_quantity: v.number(),
    inventory_policy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const productId = args.product_id as Id<"products">
    const merchantId = args.merchant_id as Id<"merchants">

    const existing = await ctx.db
      .query("product_variants")
      .withIndex("by_merchant_shopify_variant", q =>
        q.eq("merchant_id", merchantId).eq("shopify_variant_id", args.shopify_variant_id)
      )
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, {
        price: args.price,
        inventory_quantity: args.inventory_quantity,
        inventory_policy: args.inventory_policy,
        title: args.title,
      })
      return existing._id as string
    }

    const newId = await ctx.db.insert("product_variants", {
      product_id: productId,
      merchant_id: merchantId,
      shopify_variant_id: args.shopify_variant_id,
      title: args.title,
      price: args.price,
      inventory_quantity: args.inventory_quantity,
      inventory_policy: args.inventory_policy ?? "deny",
    })
    return newId as string
  },
})

export const getProductCount = query({
  args: { merchant_id: v.string() },
  handler: async (ctx, { merchant_id }) => {
    const products = await ctx.db
      .query("products")
      .withIndex("by_merchant_status", q =>
        q.eq("merchant_id", merchant_id as Id<"merchants">).eq("status", "active")
      )
      .collect()
    return products.length
  },
})

export const listProducts = query({
  args: { merchant_id: v.string() },
  handler: async (ctx, { merchant_id }) => {
    const merchantId = merchant_id as Id<"merchants">
    const merchant = await ctx.db.get(merchantId)
    const products = await ctx.db
      .query("products")
      .withIndex("by_merchant_status", q => q.eq("merchant_id", merchantId).eq("status", "active"))
      .collect()

    const shopDomain = normalizeStoreDomain(merchant?.public_store_domain ?? merchant?.shop_domain)
    const enriched = await Promise.all(products.map(async (product) => {
      const variants = await ctx.db
        .query("product_variants")
        .withIndex("by_product", q => q.eq("product_id", product._id))
        .collect()

      const minPrice = variants.length ? Math.min(...variants.map(v => v.price)) : 0
      const inStock = variants.some(v => v.inventory_quantity > 0 || v.inventory_policy === "continue")

      return {
        id: product._id,
        title: product.title,
        vendor: product.vendor ?? "",
        handle: product.handle,
        product_type: product.product_type ?? "",
        tags: product.tags ?? [],
        description: product.description ?? "",
        price: minPrice,
        in_stock: inStock,
        store_url: shopDomain ? `https://${shopDomain}/products/${product.handle}` : "#",
        variants: variants.map((variant) => ({
          shopify_variant_id: variant.shopify_variant_id,
          title: variant.title,
          price: variant.price,
          inventory_quantity: variant.inventory_quantity,
        })),
      }
    }))

    return enriched.sort((a, b) => a.title.localeCompare(b.title))
  },
})
