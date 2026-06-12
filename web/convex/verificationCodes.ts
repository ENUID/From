import { mutation } from "./_generated/server";
import { v } from "convex/values";

const CODE_TTL_MS = 15 * 60 * 1000 // 15 minutes
const RATE_LIMIT_MS = 60 * 1000     // 1 code per minute per email

export const createCode = mutation({
  args: { email: v.string(), code: v.string() },
  handler: async (ctx, args) => {
    const email = args.email.toLowerCase().trim()
    const now = Date.now()

    // Rate-limit: one code per minute per email
    const existing = await ctx.db
      .query("verification_codes")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first()

    if (existing && existing.expiresAt > now && (now - (existing.expiresAt - CODE_TTL_MS)) < RATE_LIMIT_MS) {
      throw new Error("Please wait a moment before requesting another code")
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        code: args.code,
        expiresAt: now + CODE_TTL_MS,
        used: false,
        attempts: 0,
      })
    } else {
      await ctx.db.insert("verification_codes", {
        email,
        code: args.code,
        expiresAt: now + CODE_TTL_MS,
        used: false,
      })
    }
  },
})

export const deleteCode = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const email = args.email.toLowerCase().trim()
    const existing = await ctx.db
      .query("verification_codes")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first()
    if (existing) await ctx.db.delete(existing._id)
  },
})

export const verifyAndConsumeCode = mutation({
  args: { email: v.string(), code: v.string() },
  handler: async (ctx, args) => {
    const email = args.email.toLowerCase().trim()
    const now = Date.now()

    const record = await ctx.db
      .query("verification_codes")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first()

    if (!record) return false
    if (record.used) return false
    if (record.expiresAt < now) return false
    if ((record.attempts ?? 0) >= 5) return false

    if (record.code !== args.code.trim()) {
      await ctx.db.patch(record._id, { attempts: (record.attempts ?? 0) + 1 })
      return false
    }

    await ctx.db.patch(record._id, { used: true })
    return true
  },
})
