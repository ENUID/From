// Verifies the signed proof minted by lib/convexAuthProof.ts's signAuthProof
// (see that file for the full explanation of why this exists). Mirrors its
// HMAC-SHA256 signing exactly, using Web Crypto (crypto.subtle) rather than
// Node's `crypto` module — Convex's default query/mutation runtime is a V8
// isolate without Node built-ins; `"use node"` actions can't be used here
// since these run inline inside queries/mutations that also touch ctx.db.
//
// CONVEX_AUTH_SECRET must be set in the Convex deployment's own environment
// (via the Convex dashboard or `npx convex env set`) with the SAME value as
// the Vercel env var of the same name — this is a distinct env var space
// from Next.js/Vercel, Convex functions cannot read Vercel's env directly.

import { v } from "convex/values";

// Shared arg shape — every protected query/mutation takes `authProof: authProofValidator`
// (required, not optional: a missing proof is a TypeScript error at every
// call site, not a silent runtime gap — see the individual function files).
export const authProofValidator = v.object({
  email: v.string(),
  expiresAt: v.number(),
  signature: v.string(),
});

export type AuthProof = { email: string; expiresAt: number; signature: string }

async function hmacHex(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/**
 * Returns true only if `proof` is a validly-signed, unexpired proof for
 * exactly `expectedEmail` (case/whitespace-insensitive). Every protected
 * query/mutation must call this before touching any per-user data, and
 * treat a false result exactly like "not signed in" (empty/null return —
 * never throw with details that would confirm whether an email exists).
 */
export async function verifyAuthProof(
  proof: AuthProof | undefined,
  expectedEmail: string,
): Promise<boolean> {
  if (!proof) return false
  const secret = process.env.CONVEX_AUTH_SECRET
  if (!secret) return false
  if (!Number.isFinite(proof.expiresAt) || Date.now() > proof.expiresAt) return false
  const normalizedProofEmail = proof.email.toLowerCase().trim()
  const normalizedExpected = expectedEmail.toLowerCase().trim()
  if (normalizedProofEmail !== normalizedExpected) return false
  const expectedSig = await hmacHex(`${normalizedProofEmail}.${proof.expiresAt}`, secret)
  return timingSafeEqual(proof.signature, expectedSig)
}
