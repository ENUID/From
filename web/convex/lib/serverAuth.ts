// Verifies that a Convex call genuinely originated from our own trusted
// Next.js server, as opposed to a browser calling Convex directly with
// NEXT_PUBLIC_CONVEX_URL (which is public by necessity — anyone can read it
// out of the client bundle and call any exported query/mutation directly).
//
// This is distinct from authProof.ts (proves "this request is really from
// user X") and adminAuth.ts (proves "the caller holds the admin operator
// secret"): serverAuth is for internal, identity-agnostic plumbing — the
// email-OTP login flow itself (which runs before any session/authProof can
// exist), and hot internal caches/aggregates that have no per-user identity
// to check but also must not be writable or readable by an arbitrary caller.
//
// Reuses CONVEX_AUTH_SECRET (the same value already required for authProof)
// rather than introducing a third secret to configure.

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export function verifyServerSecret(provided: string | undefined): boolean {
  const secret = process.env.CONVEX_AUTH_SECRET
  if (!secret || !provided) return false
  return timingSafeEqual(provided, secret)
}
