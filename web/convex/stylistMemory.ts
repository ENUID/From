import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { authProofValidator, verifyAuthProof } from "./lib/authProof";

async function getUserByEmail(ctx: any, email: string) {
  return ctx.db
    .query("users")
    .withIndex("by_email", (q: any) => q.eq("email", email.toLowerCase().trim()))
    .first();
}

export const getStylistMemory = query({
  args: { userEmail: v.string(), authProof: authProofValidator },
  handler: async (ctx, args) => {
    if (!(await verifyAuthProof(args.authProof, args.userEmail))) return null;
    const user = await getUserByEmail(ctx, args.userEmail);
    if (!user) return null;
    return ctx.db
      .query("stylist_memory")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .first();
  },
});

// Called only from app/api/ai/stylist-memory/route.ts, which already
// verifies the NextAuth session server-side before minting the proof it
// passes here — see signAuthProof usage there.
export const upsertStylistMemory = mutation({
  args: { userEmail: v.string(), summary: v.string(), authProof: authProofValidator },
  handler: async (ctx, args) => {
    if (!(await verifyAuthProof(args.authProof, args.userEmail))) throw new Error("Unauthorized");
    const user = await getUserByEmail(ctx, args.userEmail);
    if (!user) throw new Error("User not found");
    const existing = await ctx.db
      .query("stylist_memory")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { summary: args.summary, updatedAt: Date.now() });
      return existing._id;
    }
    return ctx.db.insert("stylist_memory", {
      userId: user._id,
      summary: args.summary,
      updatedAt: Date.now(),
    });
  },
});
