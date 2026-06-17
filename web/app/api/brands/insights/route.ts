/**
 * GET /api/brands/insights — demand insights for a connected brand.
 *
 * Shows what shoppers are actually searching FROM for (last 14 days), so a brand
 * can see real demand — including gaps they don't yet stock. Brand-session
 * protected.
 */

import { NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { anyApi } from 'convex/server'
import { getBrandSession } from '@/lib/brands/session'

export const runtime = 'nodejs'
export const maxDuration = 30

const STOP = new Set([
  'a', 'an', 'the', 'for', 'and', 'or', 'with', 'to', 'in', 'of', 'on', 'my',
  'me', 'i', 'something', 'some', 'that', 'this', 'looking', 'need', 'want',
  'find', 'show', 'like', 'good', 'best', 'nice',
])

export async function GET() {
  const domain = await getBrandSession()
  if (!domain) return NextResponse.json({ error: 'Not connected' }, { status: 401 })

  if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
    return NextResponse.json({ topSearches: [], terms: [], total: 0, message: 'Analytics source not configured' })
  }

  try {
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL)
    const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000
    const rows = (await convex.query(anyApi.searchHistory.getRecentSearches, { cutoff })) as
      | { query: string; resultCount: number }[]
      | null

    if (!rows || rows.length === 0) {
      return NextResponse.json({ topSearches: [], terms: [], total: 0, message: 'No shopper searches yet' })
    }

    // Top full queries by frequency.
    const queryCounts = new Map<string, number>()
    const termCounts = new Map<string, number>()
    let thinResults = 0

    for (const r of rows) {
      const q = (r.query ?? '').trim().toLowerCase()
      if (!q) continue
      queryCounts.set(q, (queryCounts.get(q) ?? 0) + 1)
      if ((r.resultCount ?? 0) < 4) thinResults++   // demand the corpus barely satisfies
      for (const w of q.split(/[^a-z0-9]+/)) {
        if (w.length < 3 || STOP.has(w)) continue
        termCounts.set(w, (termCounts.get(w) ?? 0) + 1)
      }
    }

    const topSearches = Array.from(queryCounts.entries())
      .sort((a, b) => b[1] - a[1]).slice(0, 25)
      .map(([query, count]) => ({ query, count }))
    const terms = Array.from(termCounts.entries())
      .sort((a, b) => b[1] - a[1]).slice(0, 30)
      .map(([term, count]) => ({ term, count }))

    return NextResponse.json({
      total: rows.length,
      windowDays: 14,
      thinResults,   // searches that returned <4 products — unmet demand to stock into
      topSearches,
      terms,
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
