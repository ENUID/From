import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { anyApi } from 'convex/server'

// Lazily construct the Convex client at request time — never at module load,
// so a missing NEXT_PUBLIC_CONVEX_URL doesn't fail `next build`.
function getConvex(): ConvexHttpClient {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!url) throw new Error('NEXT_PUBLIC_CONVEX_URL is not set')
  return new ConvexHttpClient(url.trim().replace(/\/+$/, ''))
}

function authorized(req: NextRequest): { ok: boolean; reason?: string } {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return { ok: false, reason: 'not_configured' }
  const header = req.headers.get('x-admin-secret')
  return { ok: header === secret, reason: header !== secret ? 'wrong_secret' : undefined }
}

const DAY = 24 * 60 * 60 * 1000

// GET ?check=1     → auth-only ping (never touches Convex, can't hang)
// GET ?days=7      → full analytics payload over the trailing window
export async function GET(req: NextRequest) {
  const auth = authorized(req)
  if (!auth.ok) {
    return NextResponse.json({ error: 'Unauthorized', reason: auth.reason }, { status: 401 })
  }
  if (req.nextUrl.searchParams.get('check') === '1') {
    return NextResponse.json({ ok: true, authed: true })
  }

  const adminSecret = process.env.ADMIN_SECRET!
  const serverSecret = process.env.CONVEX_AUTH_SECRET
  const daysParam = Number(req.nextUrl.searchParams.get('days'))
  const days = Number.isFinite(daysParam) && daysParam > 0 ? Math.min(daysParam, 365) : 7
  const windowMs = days * DAY

  try {
    const convex = getConvex()
    const [overview, topSearches, topUsers, recent, aiUsage] = await Promise.all([
      convex.query(anyApi.analytics.adminOverview, { adminSecret, windowMs }),
      convex.query(anyApi.analytics.adminTopSearches, { adminSecret, windowMs, limit: 40 }),
      convex.query(anyApi.analytics.adminTopUsers, { adminSecret, windowMs, limit: 30 }),
      convex.query(anyApi.analytics.adminRecentSearches, { adminSecret, limit: 60 }),
      // AI usage is serverSecret-gated (reused as-is). Skip gracefully if the
      // secret isn't configured rather than failing the whole dashboard.
      serverSecret
        ? convex.query(anyApi.users.getAiUsageSummary, { serverSecret, windowMs }).catch(() => null)
        : Promise.resolve(null),
    ])
    return NextResponse.json({ ok: true, days, overview, topSearches, topUsers, recent, aiUsage })
  } catch (e: any) {
    return NextResponse.json({ error: 'Convex error', detail: e?.message ?? String(e) }, { status: 500 })
  }
}
