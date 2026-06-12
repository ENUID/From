/**
 * Brand health tracker — answers "which brands actually return products?"
 *
 * Records the outcome of every per-store catalog fetch in memory. A store that
 * repeatedly errors (no UCP endpoint, 4xx/5xx, timeout) is flagged "likely
 * dead" and deprioritized in category searches so the fetch budget goes to
 * stores that actually respond — faster, better results.
 *
 * In-memory, per warm serverless instance. The brand-health cron probes the
 * full roster and persists a snapshot for the admin report; this tracker gives
 * the live, hot-path signal. Errors are the dead signal — an empty result for
 * one specific query does NOT mark a brand dead (it may simply lack that item).
 */

import { isPrunedDead } from './deadBrands'

export type BrandOutcome = { productCount: number; errored: boolean }

type BrandStat = {
  domain: string
  oks: number              // fetches that returned ≥1 product
  empties: number          // fetches that returned 0 products (no error)
  errors: number           // non-200 / timeout / thrown
  consecutiveErrors: number
  lastProducts: number
  lastTriedAt: number
  lastOkAt: number
}

const stats = new Map<string, BrandStat>()

// 3 consecutive hard errors → treat as down. Re-checked after the cooloff so a
// recovered store rejoins automatically (we never permanently blacklist here).
const DEAD_AFTER_CONSEC_ERRORS = 3
const RECHECK_AFTER_MS = 30 * 60 * 1000

function ensure(domain: string): BrandStat {
  const d = domain.toLowerCase().trim()
  let s = stats.get(d)
  if (!s) {
    s = { domain: d, oks: 0, empties: 0, errors: 0, consecutiveErrors: 0, lastProducts: 0, lastTriedAt: 0, lastOkAt: 0 }
    stats.set(d, s)
  }
  return s
}

export function recordBrandOutcome(domain: string, outcome: BrandOutcome): void {
  const s = ensure(domain)
  s.lastTriedAt = Date.now()
  if (outcome.errored) {
    s.errors++
    s.consecutiveErrors++
  } else {
    s.lastProducts = outcome.productCount
    s.consecutiveErrors = 0
    if (outcome.productCount > 0) {
      s.oks++
      s.lastOkAt = Date.now()
    } else {
      s.empties++
    }
  }
}

/** A store that has hard-errored repeatedly and hasn't recovered recently. */
export function isLikelyDead(domain: string): boolean {
  const s = stats.get(domain.toLowerCase().trim())
  if (!s) return false
  if (s.consecutiveErrors < DEAD_AFTER_CONSEC_ERRORS) return false
  // Give it another shot once the cooloff passes.
  return Date.now() - s.lastTriedAt < RECHECK_AFTER_MS
}

/** Partition a list of domains into healthy-first, likely-dead-last (stable).
 *  Consults both the live in-instance signal and the persisted auto-prune set. */
export function deprioritizeDead(domains: string[]): string[] {
  const live: string[] = []
  const dead: string[] = []
  for (const d of domains) ((isLikelyDead(d) || isPrunedDead(d)) ? dead : live).push(d)
  return [...live, ...dead]
}

export type BrandHealthRow = {
  domain: string
  status: 'healthy' | 'empty-only' | 'down' | 'unknown'
  oks: number
  empties: number
  errors: number
  lastProducts: number
  lastTriedAt: number
  lastOkAt: number
}

function statusOf(s: BrandStat): BrandHealthRow['status'] {
  if (s.consecutiveErrors >= DEAD_AFTER_CONSEC_ERRORS) return 'down'
  if (s.oks > 0) return 'healthy'
  if (s.empties > 0 && s.oks === 0) return 'empty-only'
  return 'unknown'
}

export function brandHealthReport(): { generatedAt: number; total: number; byStatus: Record<string, number>; brands: BrandHealthRow[] } {
  const brands: BrandHealthRow[] = Array.from(stats.values()).map(s => ({
    domain: s.domain,
    status: statusOf(s),
    oks: s.oks,
    empties: s.empties,
    errors: s.errors,
    lastProducts: s.lastProducts,
    lastTriedAt: s.lastTriedAt,
    lastOkAt: s.lastOkAt,
  }))
  const byStatus: Record<string, number> = {}
  for (const b of brands) byStatus[b.status] = (byStatus[b.status] ?? 0) + 1
  brands.sort((a, b) => a.status.localeCompare(b.status) || b.oks - a.oks)
  return { generatedAt: Date.now(), total: brands.length, byStatus, brands }
}
