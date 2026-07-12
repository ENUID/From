import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { authProofValidator, verifyAuthProof } from "./lib/authProof";

async function getUserByEmail(ctx: any, email: string) {
  return ctx.db
    .query("users")
    .withIndex("by_email", (q: any) => q.eq("email", email.toLowerCase().trim()))
    .first();
}

// Get the user row, creating a minimal one if it doesn't exist yet. This makes
// profile saves resilient: if ensureUser failed during sign-in (e.g. Convex was
// briefly unreachable), the save still succeeds instead of throwing "User not
// found" and silently losing the data.
async function getOrCreateUser(ctx: any, email: string) {
  const normalized = email.toLowerCase().trim();
  const existing = await getUserByEmail(ctx, normalized);
  if (existing) return existing;
  const id = await ctx.db.insert("users", {
    email: normalized,
    role: "buyer",
    createdAt: Date.now(),
  });
  return ctx.db.get(id);
}

export const getTasteProfile = query({
  args: { userEmail: v.string(), authProof: authProofValidator },
  handler: async (ctx, args) => {
    if (!(await verifyAuthProof(args.authProof, args.userEmail))) return null;
    const user = await getUserByEmail(ctx, args.userEmail);
    if (!user) return null;
    return ctx.db
      .query("taste_profile")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .first();
  },
});

export const upsertTasteProfile = mutation({
  args: {
    userEmail: v.string(),
    styles: v.optional(v.array(v.string())),
    budgetMin: v.optional(v.number()),
    budgetMax: v.optional(v.number()),
    sizes: v.optional(v.any()),
    notes: v.optional(v.string()),
    authProof: authProofValidator,
  },
  handler: async (ctx, args) => {
    if (!(await verifyAuthProof(args.authProof, args.userEmail))) throw new Error("Unauthorized");
    const user = await getOrCreateUser(ctx, args.userEmail);
    if (!user) throw new Error("User not found");
    const existing = await ctx.db
      .query("taste_profile")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .first();
    const data: any = { updatedAt: Date.now() };
    if (args.styles !== undefined) data.styles = args.styles;
    if (args.budgetMin !== undefined) data.budgetMin = args.budgetMin;
    if (args.budgetMax !== undefined) data.budgetMax = args.budgetMax;
    if (args.sizes !== undefined) data.sizes = args.sizes;
    if (args.notes !== undefined) data.notes = args.notes;
    if (existing) {
      await ctx.db.patch(existing._id, data);
      return existing._id;
    }
    return ctx.db.insert("taste_profile", { userId: user._id, ...data });
  },
});

// A wardrobe key that treats near-identical items (case/whitespace aside) as
// the same piece — two scans of the same navy blazer shouldn't produce two
// rows just because a re-scan phrased "navy" as "Navy" or "smart casual" as
// "Smart Casual".
function wardrobeItemKey(item: { type: string; color: string; style: string }): string {
  return `${item.type} ${item.color} ${item.style}`.toLowerCase().trim()
}

export const upsertWardrobeAnalysis = mutation({
  args: {
    userEmail: v.string(),
    wardrobe: v.object({
      items: v.array(v.object({
        type: v.string(),
        color: v.string(),
        style: v.string(),
        occasions: v.array(v.string()),
      })),
      summary: v.string(),
      gaps: v.array(v.string()),
      analyzedAt: v.number(),
    }),
    authProof: authProofValidator,
  },
  handler: async (ctx, args) => {
    if (!(await verifyAuthProof(args.authProof, args.userEmail))) throw new Error("Unauthorized");
    const user = await getUserByEmail(ctx, args.userEmail);
    if (!user) throw new Error("User not found");
    const existing = await ctx.db
      .query("taste_profile")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .first();

    // Merge, don't overwrite — a shopper scanning a second batch of photos
    // (a different drawer, a different day) should ADD to what Fabrics
    // knows about their wardrobe, not erase the first scan. Only the
    // summary (always a fresh, current-state description) and analyzedAt
    // are replaced wholesale; items/gaps accumulate with de-duplication.
    const existingWardrobe = (existing as any)?.wardrobe as typeof args.wardrobe | undefined;
    const mergedItems = existingWardrobe?.items ? [...existingWardrobe.items] : [];
    const seenItemKeys = new Set(mergedItems.map(wardrobeItemKey));
    for (const item of args.wardrobe.items) {
      const key = wardrobeItemKey(item);
      if (!seenItemKeys.has(key)) { seenItemKeys.add(key); mergedItems.push(item); }
    }
    const mergedGaps = Array.from(new Set([
      ...(existingWardrobe?.gaps ?? []),
      ...args.wardrobe.gaps,
    ].map(g => g.trim()).filter(Boolean)));

    const wardrobe = {
      items: mergedItems.slice(0, 60), // generous cap — a real wardrobe, not an unbounded log
      summary: args.wardrobe.summary,
      gaps: mergedGaps.slice(0, 12),
      analyzedAt: args.wardrobe.analyzedAt,
    };

    if (existing) {
      await ctx.db.patch(existing._id, { wardrobe, updatedAt: Date.now() });
      return existing._id;
    }
    return ctx.db.insert("taste_profile", { userId: user._id, wardrobe, updatedAt: Date.now() });
  },
});
