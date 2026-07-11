import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ConvexHttpClient } from 'convex/browser'
import { anyApi } from 'convex/server'
import { signAuthProof } from '@/lib/convexAuthProof'

// Returns whether the signed-in user has Community (Fabrics) access via the
// admin allowlist. Checks TWO sources so it works even if the database is
// unreachable or its allowlist functions aren't deployed:
//   1. COMMUNITY_EMAILS env var — comma-separated, instant, zero-dependency.
//   2. The Convex community_allowlist table — dynamic, managed from /admin/community.
// Either one granting access is enough.
export async function GET() {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email?.toLowerCase().trim()
  if (!email) return NextResponse.json({ allowed: false })

  // Source 1 — env var (bulletproof, no network)
  const envList = (process.env.COMMUNITY_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  if (envList.includes(email)) {
    return NextResponse.json({ allowed: true, via: 'env' })
  }

  // Source 2 — Convex table (best-effort; never blocks the env path)
  try {
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
    const authProof = signAuthProof(email)
    if (convexUrl && authProof) {
      const convex = new ConvexHttpClient(convexUrl)
      const onList = await convex.query(anyApi.subscriptions.isOnAllowlist, { email, authProof })
      if (onList === true) return NextResponse.json({ allowed: true, via: 'convex' })
    }
  } catch {
    // Convex unreachable or function missing — fall through to env-only result.
  }

  return NextResponse.json({ allowed: false })
}
