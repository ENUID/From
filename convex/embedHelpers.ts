import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";

type ProductDoc = Doc<"products">;

function isLegacyPending(product: ProductDoc) {
  return (!product.embedding || product.embedding.length === 0) && !product.embedding_status;
}

function isQueuedStatus(status?: string) {
  return status === "pending" || status === "failed";
}

async function listCandidateProducts(ctx: any, merchantId: string | null): Promise<ProductDoc[]> {
  if (merchantId) {
    return await ctx.db
      .query("products")
      .withIndex("by_merchant", (q: any) => q.eq("merchant_id", merchantId as Id<"merchants">))
      .collect();
  }
  return await ctx.db.query("products").collect();
}

async function listCandidateProductsByMerchantIds(
  ctx: any,
  merchantIds: string[] | null
): Promise<ProductDoc[]> {
  if (!merchantIds?.length) {
    return await ctx.db.query("products").collect();
  }

  if (merchantIds.length === 1) {
    return await listCandidateProducts(ctx, merchantIds[0]);
  }

  const groups = await Promise.all(
    merchantIds.map((merchantId) => listCandidateProducts(ctx, merchantId))
  );
  return groups.flat();
}

async function listProductsByEmbeddingStatus(
  ctx: any,
  merchantId: string | null,
  status: "pending" | "failed" | "processing"
): Promise<ProductDoc[]> {
  if (merchantId) {
    return await ctx.db
      .query("products")
      .withIndex("by_merchant_embedding_status", (q: any) =>
        q.eq("merchant_id", merchantId as Id<"merchants">).eq("embedding_status", status)
      )
      .collect();
  }

  return await ctx.db
    .query("products")
    .withIndex("by_embedding_status", (q: any) => q.eq("embedding_status", status))
    .collect();
}

async function listQueuedProducts(ctx: any, merchantId: string | null, limit?: number): Promise<ProductDoc[]> {
  const batchSize = Math.max(1, Math.min(limit ?? 100, 100));
  const pending = await listProductsByEmbeddingStatus(ctx, merchantId, "pending");
  const failed = pending.length >= batchSize
    ? []
    : await listProductsByEmbeddingStatus(ctx, merchantId, "failed");
  const queued = [...pending, ...failed];

  if (queued.length >= batchSize) {
    return queued.slice(0, batchSize);
  }

  const remaining = batchSize - queued.length;
  if (remaining <= 0) return queued;

  const legacy = (await listCandidateProducts(ctx, merchantId))
    .filter((product: ProductDoc) => isLegacyPending(product))
    .slice(0, remaining);

  return [...queued, ...legacy];
}

export const getPendingProducts = query({
  args: { merchantId: v.union(v.string(), v.null()) },
  handler: async (ctx, { merchantId }) => {
    return await listQueuedProducts(ctx, merchantId, 100);
  },
});

export const claimPendingProducts = mutation({
  args: {
    merchantId: v.union(v.string(), v.null()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { merchantId, limit }) => {
    const batchSize = Math.max(1, Math.min(limit ?? 20, 100));
    const all = await listQueuedProducts(ctx, merchantId, batchSize);
    const claimed: ProductDoc[] = [];

    for (const product of all) {
      if (!(isQueuedStatus(product.embedding_status) || isLegacyPending(product))) continue;
      await ctx.db.patch(product._id, {
        embedding_status: "processing",
        embedding_error: undefined,
      });
      claimed.push({
        ...product,
        embedding_status: "processing",
        embedding_error: undefined,
      });
      if (claimed.length >= batchSize) break;
    }

    return claimed;
  },
});

export const saveEmbedding = mutation({
  args: {
    id: v.id("products"),
    embedding: v.array(v.float64()),
    model: v.optional(v.string()),
  },
  handler: async (ctx, { id, embedding, model }) => {
    await ctx.db.patch(id, {
      embedding,
      embedding_status: "embedded",
      embedding_model: model,
      embedding_updated_at: Date.now(),
      embedding_error: undefined,
    });
  },
});

export const markEmbeddingFailed = mutation({
  args: {
    id: v.id("products"),
    error: v.string(),
  },
  handler: async (ctx, { id, error }) => {
    await ctx.db.patch(id, {
      embedding_status: "failed",
      embedding_error: error.slice(0, 500),
    });
  },
});

export const queueProductsForEmbedding = mutation({
  args: {
    merchantId: v.union(v.string(), v.null()),
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, { merchantId, force }) => {
    const all = force
      ? await listCandidateProducts(ctx, merchantId)
      : await listQueuedProducts(ctx, merchantId, 100);
    let queued = 0;

    for (const product of all) {
      const shouldQueue = force || !product.embedding || product.embedding.length === 0 || product.embedding_status === "failed";
      if (!shouldQueue) continue;
      await ctx.db.patch(product._id, {
        embedding: force ? undefined : product.embedding,
        embedding_status: "pending",
        embedding_model: force ? undefined : product.embedding_model,
        embedding_updated_at: force ? undefined : product.embedding_updated_at,
        embedding_error: undefined,
      });
      queued += 1;
    }

    return { queued };
  },
});

export const backfillEmbeddingMetadata = mutation({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("products").collect();
    let embedded = 0;
    let pending = 0;

    for (const product of all) {
      if (product.embedding_status) continue;

      if (product.embedding?.length) {
        await ctx.db.patch(product._id, { embedding_status: "embedded" });
        embedded += 1;
      } else {
        await ctx.db.patch(product._id, { embedding_status: "pending" });
        pending += 1;
      }
    }

    return { embedded, pending };
  },
});

export const getEmbedStatus = query({
  args: {
    merchantIds: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { merchantIds }) => {
    const scopedMerchantIds = merchantIds?.length ? merchantIds : null;
    const scopedProducts = await listCandidateProductsByMerchantIds(ctx, scopedMerchantIds);

    const processing = scopedMerchantIds
      ? scopedProducts.filter((product) => product.embedding_status === "processing").length
      : (await listProductsByEmbeddingStatus(ctx, null, "processing")).length;
    const failed = scopedMerchantIds
      ? scopedProducts.filter((product) => product.embedding_status === "failed").length
      : (await listProductsByEmbeddingStatus(ctx, null, "failed")).length;
    const embedded = scopedProducts.filter((product) =>
      product.embedding_status === "embedded" || (product.embedding?.length && !product.embedding_status)
    ).length;
    const total = scopedProducts.length;
    const pending = total - embedded;
    return { total, embedded, pending, processing, failed };
  },
});

export const clearEmbeddings = mutation({
  args: { merchantId: v.union(v.string(), v.null()) },
  handler: async (ctx, { merchantId }) => {
    const all = await listCandidateProducts(ctx, merchantId);
    for (const product of all) {
      await ctx.db.patch(product._id, {
        embedding: undefined,
        embedding_status: "pending",
        embedding_model: undefined,
        embedding_updated_at: undefined,
        embedding_error: undefined,
      });
    }
    return { cleared: all.length };
  },
});
