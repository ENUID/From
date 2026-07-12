import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import { decomposeQuery } from '@/lib/queryParser'

export const runtime = 'nodejs'
export const maxDuration = 60

// Closes the quality_signals feedback loop: aggregates explicit bad-match
// flags and implicit good-match saves into per-(concept, product/vendor)
// scores, written to relevance_adjustments and read on every live search via
// lib/services/relevanceAdjustments.ts's cheap in-memory cache. Pure
// aggregation — no LLM call, safe to run daily against the shared free-tier
// budget. Recomputes from the full trailing window every run (idempotent
// upsert in Convex), not additive.

const WINDOW_MS = 30 * 24 * 60 * 60 * 1000 // 30-day trailing window
const VENDOR_MIN_BAD = 3
const VENDOR_MIN_FLAGGERS = 2
const GOOD_WEIGHT = 0.5

type Agg = { badCount: number; goodCount: number; flaggers: Set<string> }

function conceptKeyFor(query: string): string {
  const { garmentKeys } = decomposeQuery(query)
  return garmentKeys[0] || 'general'
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!process.env.CONVEX_AUTH_SECRET) {
    return NextResponse.json({ error: 'Not configured' }, { status: 503 })
  }
  const serverSecret = process.env.CONVEX_AUTH_SECRET
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

  try {
    const since = Date.now() - WINDOW_MS
    const [badRows, goodRows] = await Promise.all([
      convex.query(api.qualitySignals.getSignalsForAggregation, { since, serverSecret }),
      convex.query(api.shop.getSavedProductsForAggregation, { since, serverSecret }),
    ])

    if ((!badRows || badRows.length === 0) && (!goodRows || goodRows.length === 0)) {
      return NextResponse.json({ ok: true, message: 'No signals in window', written: 0 })
    }

    const productAgg = new Map<string, Agg>() // key: conceptKey + ' ' + productId
    const vendorAgg = new Map<string, Agg>()   // key: conceptKey + ' ' + vendor

    const bump = (map: Map<string, Agg>, key: string, field: 'badCount' | 'goodCount', flagger?: string) => {
      let a = map.get(key)
      if (!a) { a = { badCount: 0, goodCount: 0, flaggers: new Set() }; map.set(key, a) }
      a[field]++
      if (flagger) a.flaggers.add(flagger)
    }

    for (const r of badRows || []) {
      if (!r.query || !r.productId) continue
      const concept = conceptKeyFor(r.query)
      const flagger = r.userId ? String(r.userId) : undefined
      bump(productAgg, `${concept} ${r.productId}`, 'badCount', flagger)
      if (r.vendor) bump(vendorAgg, `${concept} ${r.vendor.toLowerCase().trim()}`, 'badCount', flagger)
    }
    for (const r of goodRows || []) {
      if (!r.query || !r.productId) continue
      const concept = conceptKeyFor(r.query)
      bump(productAgg, `${concept} ${r.productId}`, 'goodCount')
      if (r.vendor) bump(vendorAgg, `${concept} ${r.vendor.toLowerCase().trim()}`, 'goodCount')
    }

    const adjustments: Array<{
      scope: 'product' | 'vendor'; conceptKey: string; targetId: string
      score: number; badCount: number; goodCount: number; distinctFlaggers: number
    }> = []

    for (const [key, agg] of Array.from(productAgg)) {
      if (agg.badCount < 1) continue // a product needs at least one real flag to be adjustment-eligible
      const [conceptKey, targetId] = key.split(' ')
      const score = Math.max(0, agg.badCount - GOOD_WEIGHT * agg.goodCount)
      adjustments.push({ scope: 'product', conceptKey, targetId, score, badCount: agg.badCount, goodCount: agg.goodCount, distinctFlaggers: agg.flaggers.size })
    }
    for (const [key, agg] of Array.from(vendorAgg)) {
      // Whole-vendor demotion is a much bigger blast radius than one product
      // — requires real corroboration (several distinct shoppers), not one
      // person's bad day with a single item.
      if (agg.badCount < VENDOR_MIN_BAD || agg.flaggers.size < VENDOR_MIN_FLAGGERS) continue
      const [conceptKey, targetId] = key.split(' ')
      const score = Math.max(0, agg.badCount - GOOD_WEIGHT * agg.goodCount)
      if (score <= 0) continue
      adjustments.push({ scope: 'vendor', conceptKey, targetId, score, badCount: agg.badCount, goodCount: agg.goodCount, distinctFlaggers: agg.flaggers.size })
    }

    if (adjustments.length === 0) {
      return NextResponse.json({ ok: true, message: 'No adjustments cleared threshold', written: 0 })
    }

    const result = await convex.mutation(api.qualitySignals.writeRelevanceAdjustments, { serverSecret, adjustments })
    return NextResponse.json({ ok: true, badSignals: badRows?.length ?? 0, goodSignals: goodRows?.length ?? 0, written: result?.count ?? adjustments.length })
  } catch (err: any) {
    console.error('[quality-feedback] error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
