/**
 * Persisted dead-brand set — survives serverless cold starts.
 *
 * The daily brand-health cron records each probe in Convex; brands down for
 * several consecutive days are returned by getPrunedDomains. This module loads
 * that list once per cold start and refreshes it periodically, exposing a
 * synchronous check for the hot search path.
 *
 * Fully non-blocking: the load is fire-and-forget. The very first search after
 * a cold start sees an empty set (no pruning yet); it populates moments later.
 * A failed load just leaves the set empty — search behaves as before.
 */
import { ConvexHttpClient } from 'convex/browser'
import { anyApi } from 'convex/server'

const REFRESH_MS = 30 * 60 * 1000
let pruned = new Set<string>()
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
      .query(anyApi.brandHealth.getPrunedDomains, { minDown: 3, serverSecret })
      .then((domains: unknown) => {
        if (Array.isArray(domains)) {
          pruned = new Set(domains.map((d) => String(d).toLowerCase().trim()))
        }
      })
      .catch(() => { /* leave the set as-is */ })
      .finally(() => { loading = false })
  } catch {
    loading = false
  }
}

/** True if this domain is on the persisted auto-prune list. */
export function isPrunedDead(domain: string): boolean {
  refresh() // opportunistic, throttled, non-blocking
  return pruned.has(domain.toLowerCase().trim())
}
