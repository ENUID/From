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
  // Allow multi-year windows (up to ~10y) so the 3y/6y/9y toggles aren't
  // silently truncated. Scans stay bounded by the query-side caps regardless.
  const days = Number.isFinite(daysParam) && daysParam > 0 ? Math.min(daysParam, 3650) : 7
  const windowMs = days * DAY
  const buckets = days <= 1 ? 24 : days <= 30 ? Math.max(7, Math.min(30, Math.round(days))) : 24

  // Each query is isolated: a single missing/failing function (e.g. Convex
  // not yet redeployed with analytics.ts) degrades that one panel instead of
  // blanking the whole dashboard, and its error is reported in `diag`.
  const diag: Record<string, string> = {}
  const run = async (label: string, p: Promise<any>) => {
    try { return await p } catch (e: any) { diag[label] = e?.message ? String(e.message).slice(0, 200) : 'error'; return null }
  }

  let convex: ReturnType<typeof getConvex>
  try { convex = getConvex() } catch (e: any) {
    return NextResponse.json({ error: 'Convex not configured', detail: e?.message ?? String(e) }, { status: 500 })
  }

  const [overview, timeSeries, topSearches, topUsers, recent, aiUsage] = await Promise.all([
    run('overview', convex.query(anyApi.analytics.adminOverview, { adminSecret, windowMs })),
    run('timeSeries', convex.query(anyApi.analytics.adminTimeSeries, { adminSecret, windowMs, buckets })),
    run('topSearches', convex.query(anyApi.analytics.adminTopSearches, { adminSecret, windowMs, limit: 40 })),
    run('topUsers', convex.query(anyApi.analytics.adminTopUsers, { adminSecret, windowMs, limit: 30 })),
    run('recent', convex.query(anyApi.analytics.adminRecentSearches, { adminSecret, limit: 60 })),
    serverSecret
      ? run('aiUsage', convex.query(anyApi.users.getAiUsageSummary, { serverSecret, windowMs }))
      : Promise.resolve(null),
  ])

  // Distinguish the two "empty" causes so the UI can tell the operator exactly
  // what to fix rather than showing a blank board:
  //  • a function-not-found error → Convex hasn't been redeployed with the new
  //    analytics functions yet.
  //  • overview === null with no error → the Convex deployment's ADMIN_SECRET
  //    is unset or doesn't match Vercel's (verifyAdminSecret failed).
  const anyNotFound = Object.values(diag).some(m => /could not find|not found|no function/i.test(m))
  let hint: string | null = null
  if (anyNotFound) hint = 'convex_not_deployed'
  else if (overview === null) hint = 'convex_admin_secret_mismatch'
  else if (!serverSecret) hint = 'server_secret_missing'

  return NextResponse.json({ ok: true, days, overview, timeSeries, topSearches, topUsers, recent, aiUsage, diag, hint })
}
