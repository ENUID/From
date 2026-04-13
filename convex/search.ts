import { action, httpAction, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc } from "./_generated/dataModel";
import { v } from "convex/values";

type ProductDoc = Doc<"products">;
type SearchResult = {
  _id: ProductDoc["_id"];
  _score: number;
};

export const keywordSearch: any = query({
  args: {
    query: v.string(),
    budgetMax: v.union(v.float64(), v.null()),
    limit: v.number(),
  },
  handler: async (ctx, { query: searchQuery, budgetMax, limit }) => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) return [];

    const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
    const products = await ctx.db
      .query("products")
      .withIndex("by_status", (indexQuery) => indexQuery.eq("status", "active"))
      .collect();
    const scored: SearchResult[] = [];

    for (const product of products) {
      const haystack = [
        product.title,
        product.description ?? "",
        product.vendor ?? "",
        product.product_type ?? "",
        ...(product.tags ?? []),
      ].join(" ").toLowerCase();

      let score = 0;
      for (const token of tokens) {
        if (haystack.includes(token)) score += 1;
      }
      if (score === 0) continue;

      scored.push({ _id: product._id, _score: score });
    }

    scored.sort((left, right) => right._score - left._score);
    if (!scored.length) return [];

    return await ctx.runQuery(internal.searchHelpers.enrichResults, {
      ids: scored.map((result) => result._id),
      scores: Object.fromEntries(scored.map((result) => [result._id, result._score])),
      budgetMax,
      limit,
    });
  },
});

export const semanticSearch: any = action({
  args: {
    vector: v.array(v.float64()),
    budgetMax: v.optional(v.union(v.float64(), v.null())),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { vector, budgetMax, limit = 4 }) => {
    if (!vector.length) return [];

    try {
      const results = await ctx.vectorSearch("products", "by_embedding", {
        vector,
        limit: limit * 3,
        filter: (filterQuery) => filterQuery.eq("status", "active"),
      });

      if (!results.length) return [];

      return await ctx.runQuery(internal.searchHelpers.enrichResults, {
        ids: results.map((result) => result._id),
        scores: Object.fromEntries(results.map((result) => [result._id, result._score])),
        budgetMax: budgetMax ?? null,
        limit,
      });
    } catch (error) {
      console.error("semanticSearch error:", error);
      return [];
    }
  },
});

export const checkout = httpAction(async (_ctx, req) => {
  const { merchant_id, variant_id, email } = await req.json() as {
    merchant_id: string;
    variant_id: string;
    email?: string;
  };

  const agentApiUrl = process.env.AGENT_API_URL;
  const agentSecret = process.env.AGENT_API_SECRET;

  if (!agentApiUrl || !agentSecret) {
    return new Response(JSON.stringify({ checkout_url: "#" }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  try {
    const body: { line_items: Array<{ variant_id: string; quantity: number }>; customer_email?: string } = {
      line_items: [{ variant_id, quantity: 1 }],
    };
    if (email) body.customer_email = email;

    const res = await fetch(`${agentApiUrl}/api/agent/${merchant_id}/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-agent-secret": agentSecret },
      body: JSON.stringify(body),
    });
    const data = await res.json() as { checkout_url?: string };
    return new Response(JSON.stringify({ checkout_url: data.checkout_url ?? "#" }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch {
    return new Response(JSON.stringify({ checkout_url: "#" }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
