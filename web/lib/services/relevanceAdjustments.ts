/**
 * Persisted relevance-demotion set — the read side of the quality_signals
 * feedback loop. web/app/api/cron/quality-feedback aggregates explicit
 * bad-match flags and implicit good-match saves daily into
 * relevance_adjustments; this module loads that (small) table once per cold
 * start and refreshes it periodically, exposing a synchronous lookup for the
 * hot search path — same shape as lib/services/deadBrands.ts.
 *
 * Fully non-blocking: the load is fire-and-forget. A failed/empty load just
 * means zero adjustments apply — search behaves exactly as before this
 * feature existed, never worse.
 */
import { ConvexHttpClient } from 'convex/browser'
import { anyApi } from 'convex/server'

type AdjustmentRow = { scope: 'product' | 'vendor'; conceptKey: string; targetId: string; score: number }

const REFRESH_MS = 20 * 60 * 1000
let byKey = new Map<string, number>()
let lastLoad = 0
let loading = false

function key(scope: string, conceptKey: string, targetId: string): string {
  return `${scope} ${conceptKey} ${targetId}`
}

function refresh(): void {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL
  const serverSecret = process.env.CONVEX_AUTH_SECRET
  if (!url || !serverSecret) return
  if (loading || Date.now() - lastLoad < REFRESH_MS) return
  loading = true
  lastLoad = Date.now()
  try {
    const convex = new ConvexHttpClient(url)
    convex
      .query(anyApi.qualitySignals.getActiveAdjustments, { serverSecret })
      .then((rows: unknown) => {
        if (!Array.isArray(rows)) return
        const next = new Map<string, number>()
        for (const r of rows as AdjustmentRow[]) {
          if (!r?.conceptKey || !r?.targetId || !r?.scope) continue
          next.set(key(r.scope, r.conceptKey, r.targetId), r.score)
        }
        byKey = next
      })
      .catch(() => { /* leave the map as-is */ })
      .finally(() => { loading = false })
  } catch {
    loading = false
  }
}

/**
 * Combined product + vendor relevance adjustment for a given concept key (the
 * garment key from lib/queryParser's decomposeQuery, or "general"). Returns 0
 * when nothing applies — the overwhelmingly common case. The value is signed
 * and subtracted from the normalized BM25 score by the caller: POSITIVE
 * demotes (flagged / shown-but-ignored), NEGATIVE promotes (high save/open
 * engagement learned for this concept).
 */
export function getRelevanceAdjustment(conceptKey: string, productId: string, vendor?: string): number {
  refresh() // opportunistic, throttled, non-blocking
  const productScore = byKey.get(key('product', conceptKey, productId)) ?? 0
  const vendorScore = vendor ? (byKey.get(key('vendor', conceptKey, vendor.toLowerCase().trim())) ?? 0) : 0
  return productScore + vendorScore
}
