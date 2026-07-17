import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { verifyServerSecret } from "./lib/serverAuth";

const CODE_TTL_MS = 15 * 60 * 1000 // 15 minutes
const RATE_LIMIT_MS = 60 * 1000     // 1 code per minute per email

// These three mutations are the entire trust foundation of email-OTP login —
// whoever can call createCode can set the OTP for ANY email address to a
// value of their own choosing, then sign in as that person. They must only
// ever be reachable from our own server (app/api/auth/send-code/route.ts and
// lib/auth.ts), never directly from a browser, hence the serverSecret gate
// rather than authProof (no session/identity exists yet at this point in the
// login flow — that's the whole point of this endpoint).
export const createCode = mutation({
  args: { email: v.string(), code: v.string(), serverSecret: v.string() },
  handler: async (ctx, args) => {
    // Return a status instead of throwing (Convex redacts thrown Error messages
    // in production, making them unreadable client-side). Do NOT include secret
    // metadata (configured-state / lengths) — CONVEX_AUTH_SECRET is the master
    // HMAC + server-auth key, so leaking even its length to an unauthenticated
    // caller is a real disclosure.
    if (!verifyServerSecret(args.serverSecret)) {
      return { ok: false as const, reason: 'unauthorized' as const }
    }
    const email = args.email.toLowerCase().trim()
    const now = Date.now()

    // Rate-limit: one code per minute per email
    const existing = await ctx.db
      .query("verification_codes")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first()

    // Rate-limited: return a status instead of throwing — Convex redacts
    // thrown Error messages in production, making them unreadable client-side.
    if (existing && existing.expiresAt > now && (now - (existing.expiresAt - CODE_TTL_MS)) < RATE_LIMIT_MS) {
      const retryAfterMs = RATE_LIMIT_MS - (now - (existing.expiresAt - CODE_TTL_MS))
      return { ok: false as const, reason: "rate_limited" as const, retryAfterSec: Math.ceil(retryAfterMs / 1000) }
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
    return { ok: true as const }
  },
})

export const deleteCode = mutation({
  args: { email: v.string(), serverSecret: v.string() },
  handler: async (ctx, args) => {
    if (!verifyServerSecret(args.serverSecret)) throw new Error("Unauthorized")
    const email = args.email.toLowerCase().trim()
    const existing = await ctx.db
      .query("verification_codes")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first()
    if (existing) await ctx.db.delete(existing._id)
  },
})

export const verifyAndConsumeCode = mutation({
  args: { email: v.string(), code: v.string(), serverSecret: v.string() },
  handler: async (ctx, args) => {
    if (!verifyServerSecret(args.serverSecret)) return false
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
