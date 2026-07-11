import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { signAuthProof } from '@/lib/convexAuthProof'

// Mints a short-lived signed proof (see lib/convexAuthProof.ts) for whoever
// the REAL NextAuth session belongs to — this route is the only place that
// email comes from a verified source rather than a client-supplied string.
// The client (useConvexAuthProof) fetches this once on sign-in and refreshes
// it before it expires, then passes the proof to every Convex query/mutation
// that touches per-user data.
export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ authProof: null })
  }
  const authProof = signAuthProof(session.user.email)
  if (!authProof) {
    // CONVEX_AUTH_SECRET isn't set — fail closed (no proof), not open.
    console.error('[convex-token] CONVEX_AUTH_SECRET is not configured')
    return NextResponse.json({ authProof: null })
  }
  return NextResponse.json({ authProof })
}
