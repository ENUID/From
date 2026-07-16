/**
 * Current trending style concepts — the read side of the style-signals cron
 * (web/app/api/cron/style-signals distills them from real search volume into
 * the trend_concepts table every ~2 days). Loaded once per cold start and
 * refreshed periodically, exposing a synchronous lookup for the hot search
 * path — same cheap-read shape as lib/services/relevanceAdjustments.ts and
 * deadBrands.ts.
 *
 * Fully non-blocking: a failed/empty load means no trend context is added
 * and the judge behaves exactly as before this feature existed.
 */
import { ConvexHttpClient } from 'convex/browser'
import { anyApi } from 'convex/server'

const REFRESH_MS = 30 * 60 * 1000
let concepts: string[] = []
let lastLoad = 0
let loading = false

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
      .query(anyApi.trendConcepts.getTrendConcepts, { serverSecret })
      .then((rows: unknown) => {
        if (!Array.isArray(rows)) return
        concepts = (rows as { concept?: unknown }[])
          .map(r => (typeof r?.concept === 'string' ? r.concept : ''))
          .filter(Boolean)
          .slice(0, 12)
      })
      .catch(() => { /* keep the current list */ })
      .finally(() => { loading = false })
  } catch {
    loading = false
  }
}

/**
 * One short context line for the LLM relevance judge, or '' when no trends
 * are known. Context only — phrased so the judge treats it as a tiebreaker
 * nudge, never a filter that could override what the shopper actually asked
 * for.
 */
export function trendContextLine(): string {
  refresh() // opportunistic, throttled, non-blocking
  if (concepts.length === 0) return ''
  return `Currently trending with shoppers (context only, never override the query's own intent): ${concepts.slice(0, 8).join(', ')}.`
}
