// Verifies the admin secret for Convex functions that manage OTHER users'
// data (the community allowlist) rather than the caller's own — the
// email-matching authProof pattern in authProof.ts doesn't apply here since
// there's no "own identity" to prove, only an admin privilege to check.
//
// These functions previously had NO argument-level check at all: the
// ADMIN_SECRET gate only existed in app/api/admin/community-access/route.ts,
// which Next.js enforces before calling Convex — but Convex itself is a
// public endpoint (NEXT_PUBLIC_CONVEX_URL ships in the client bundle), so
// anyone could call grantAllowlistAccess directly and grant themselves free
// premium/community access, completely bypassing that route and its secret.
//
// ADMIN_SECRET must be set in the Convex deployment's own environment with
// the same value as the Vercel env var of the same name (distinct env var
// spaces, same as CONVEX_AUTH_SECRET — see authProof.ts).

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export function verifyAdminSecret(provided: string | undefined): boolean {
  const secret = process.env.ADMIN_SECRET
  if (!secret || !provided) return false
  return timingSafeEqual(provided, secret)
}
