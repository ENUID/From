import crypto from 'crypto'

// ── Convex auth bridge ────────────────────────────────────────────────────
// Convex has no built-in binding to this app's NextAuth session — every
// Convex query/mutation that touches per-user data used to trust a plain
// client-supplied `userEmail` string with zero verification, which is a
// real IDOR: anyone who knows (or guesses) a user's email could read or
// write their saved products, taste profile, subscription, and Fabrics
// conversation history directly against the public Convex deployment URL,
// no login required.
//
// This closes that gap with a short-lived signed "proof" instead of a full
// OIDC/JWKS integration (which would need a second, separately-hosted key
// endpoint and asymmetric crypto neither side currently has machinery for):
// a Next.js server route that has ALREADY verified the NextAuth session
// signs `{email, expiresAt}` with a secret only our own backend and our
// Convex deployment know (CONVEX_AUTH_SECRET, set in BOTH Vercel and the
// Convex dashboard — never the client). Every protected Convex function
// requires this proof and independently re-verifies the signature — see
// convex/lib/authProof.ts, which mirrors this exact signing logic using Web
// Crypto (Convex's default runtime has no Node `crypto` module).
//
// The proof is NOT a general-purpose session token — it only ever proves
// "the Next.js backend, which already checked the real NextAuth session,
// vouches this request is for this email, as of this timestamp." It expires
// in 10 minutes so a leaked proof has a small, bounded window of use.

export type AuthProof = { email: string; expiresAt: number; signature: string }

const PROOF_TTL_MS = 10 * 60 * 1000

function hmacHex(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex')
}

/**
 * Mints a signed proof for an email ALREADY verified by the caller (e.g.
 * via getServerSession) — this function does no verification itself, it
 * only signs. Never call with an email you haven't already confirmed the
 * current request is authorized to act as.
 */
export function signAuthProof(email: string): AuthProof | null {
  const secret = process.env.CONVEX_AUTH_SECRET
  if (!secret) return null
  const normalized = email.toLowerCase().trim()
  const expiresAt = Date.now() + PROOF_TTL_MS
  const signature = hmacHex(`${normalized}.${expiresAt}`, secret)
  return { email: normalized, expiresAt, signature }
}
