import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import { decomposeQuery } from '@/lib/queryParser'

export const runtime = 'nodejs'
export const maxDuration = 60

// The self-learning loop's aggregation stage. Turns raw behaviour into ranking
// signal, per (concept, product/vendor), written to relevance_adjustments and
// read on every live search via lib/services/relevanceAdjustments.ts's cheap
// in-memory cache. Bidirectional:
//   • explicit bad-match flags        → demote (strong)
//   • shown often, never engaged       → demote (mild)
//   • saves + product opens (per rate) → promote (gentle)
// Pure aggregation — no LLM call, safe to run daily against the shared
// free-tier budget. Recomputes from the full trailing window every run
// (authoritative replace in Convex), so signals that age out are lifted, not
// frozen forever. The loop self-activates as traffic grows: with little data,
// the impression/CTR gates simply don't fire and search behaves as before.

const WINDOW_MS = 30 * 24 * 60 * 60 * 1000 // 30-day trailing window
const VENDOR_MIN_BAD = 3
const VENDOR_MIN_FLAGGERS = 2
const GOOD_WEIGHT = 0.5

// ── Engagement (bidirectional) learning constants ──
// A save is a much louder positive than an open; an open louder than a bare
// impression. Promotions are deliberately gentle (a nudge, never a takeover of
// the ranking); demotions from real flags stay strong. This is what turns the
// loop from "suppress bad matches" into "learn what shoppers actually want".
const SAVE_W = 3          // weight of a save in the engagement numerator
const VIEW_W = 1          // weight of a product open
const MIN_IMPR_FOR_CTR = 5   // need this many impressions before trusting a rate
const HIGH_IMPR_IGNORE = 25  // shown at least this often with zero engagement → mild demote
const PROMO_CAP = 0.15    // max promotion (raises a normalized 0–1 BM25 score)
const IGNORE_CAP = 0.08   // max shown-but-ignored demotion
const WRITE_EPS = 0.02    // don't persist noise-level scores

type Agg = { badCount: number; goodCount: number; flaggers: Set<string>; impressions: number; views: number }

// The concept a flag/save is filed under MUST match the concept the reranker
// looks it up by (relevanceRerank keys off the SEARCH query's first garment).
// The product's own garment is the reliable bridge: a trouser resurfaces in
// trouser-concept searches regardless of what else the original (possibly
// multi-garment) query said. Keying off the raw query's first garment instead
// mis-filed a flagged trouser from a "shirts and trousers" search under "shirt"
// (vocab order), so the demotion never applied. Prefer the product's garment;
// fall back to the query only when the title names no known garment.
function conceptKeyFor(query: string, productTitle?: string): string {
  if (productTitle) {
    const fromTitle = decomposeQuery(productTitle).garmentKeys[0]
    if (fromTitle) return fromTitle
  }
  return decomposeQuery(query).garmentKeys[0] || 'general'
}

// The agg keys are `${conceptKey} ${targetId}` where targetId (a vendor name or
// product id) can itself contain spaces ("Rare Rabbit"). concept keys never do,
// so split on the FIRST space only — a plain split(' ') truncated multi-word
// vendors to their first word, and the read side then never matched the full
// vendor name, so vendor-level demotion silently did nothing.
function splitAggKey(key: string): [string, string] {
  const i = key.indexOf(' ')
  return i < 0 ? [key, ''] : [key.slice(0, i), key.slice(i + 1)]
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
    const [badRows, goodRows, engagement] = await Promise.all([
      convex.query(api.qualitySignals.getSignalsForAggregation, { since, serverSecret }),
      convex.query(api.shop.getSavedProductsForAggregation, { since, serverSecret }),
      convex.query(api.qualitySignals.getEngagementForAggregation, { since, serverSecret }),
    ])

    const impressionEvents = engagement?.impressions ?? []
    const viewEvents = engagement?.views ?? []
    const anySignal = (badRows?.length ?? 0) + (goodRows?.length ?? 0) + impressionEvents.length + viewEvents.length
    if (anySignal === 0) {
      return NextResponse.json({ ok: true, message: 'No signals in window', written: 0 })
    }

    const productAgg = new Map<string, Agg>() // key: conceptKey + ' ' + productId
    const vendorAgg = new Map<string, Agg>()   // key: conceptKey + ' ' + vendor

    const at = (map: Map<string, Agg>, key: string): Agg => {
      let a = map.get(key)
      if (!a) { a = { badCount: 0, goodCount: 0, flaggers: new Set(), impressions: 0, views: 0 }; map.set(key, a) }
      return a
    }
    const bump = (map: Map<string, Agg>, key: string, field: 'badCount' | 'goodCount', flagger?: string) => {
      const a = at(map, key)
      a[field]++
      if (flagger) a.flaggers.add(flagger)
    }

    for (const r of badRows || []) {
      if (!r.query || !r.productId) continue
      const concept = conceptKeyFor(r.query, r.productTitle)
      const flagger = r.userId ? String(r.userId) : undefined
      bump(productAgg, `${concept} ${r.productId}`, 'badCount', flagger)
      if (r.vendor) bump(vendorAgg, `${concept} ${r.vendor.toLowerCase().trim()}`, 'badCount', flagger)
    }
    for (const r of goodRows || []) {
      if (!r.query || !r.productId) continue
      const concept = conceptKeyFor(r.query, r.title)
      bump(productAgg, `${concept} ${r.productId}`, 'goodCount')
      if (r.vendor) bump(vendorAgg, `${concept} ${r.vendor.toLowerCase().trim()}`, 'goodCount')
    }
    // IMPRESSIONS — one event carries the whole shown set. Key each product by
    // its OWN garment (same bridge as flags/saves), not the search query, so a
    // trouser shown in a mixed "shirt and trousers" search files under trouser.
    for (const ev of impressionEvents) {
      const q = typeof ev?.query === 'string' ? ev.query : ''
      const arr = Array.isArray(ev?.products) ? ev.products : []
      for (const p of arr) {
        if (!p?.id) continue
        const concept = conceptKeyFor(q, p.title)
        at(productAgg, `${concept} ${p.id}`).impressions++
      }
    }
    // PRODUCT VIEWS — a single opened product per event.
    for (const ev of viewEvents) {
      if (!ev?.productId) continue
      const concept = conceptKeyFor('', ev.title)
      at(productAgg, `${concept} ${ev.productId}`).views++
    }

    const adjustments: Array<{
      scope: 'product' | 'vendor'; conceptKey: string; targetId: string
      score: number; badCount: number; goodCount: number; distinctFlaggers: number
    }> = []

    for (const [key, agg] of Array.from(productAgg)) {
      // Bidirectional score: POSITIVE demotes, NEGATIVE promotes.
      //  • flags → strong demotion (unchanged from before)
      //  • high save/open engagement for the concept → gentle promotion
      //  • shown a lot with zero engagement → mild demotion
      const flagDemote = Math.max(0, agg.badCount - GOOD_WEIGHT * agg.goodCount)
      let promote = 0
      let ignore = 0
      if (agg.badCount === 0) {
        const posEng = agg.goodCount * SAVE_W + agg.views * VIEW_W
        if (posEng > 0 && agg.impressions >= MIN_IMPR_FOR_CTR) {
          const ctr = posEng / agg.impressions // engagement rate, roughly a CTR
          promote = Math.min(PROMO_CAP, 0.5 * ctr)
        } else if (posEng > 0) {
          // Engaged but not shown often enough to trust a rate — tiny nudge.
          promote = Math.min(0.08, 0.03 * posEng)
        } else if (agg.impressions >= HIGH_IMPR_IGNORE) {
          // Repeatedly shown, never engaged → it's probably a weak match here.
          ignore = Math.min(IGNORE_CAP, 0.003 * agg.impressions)
        }
      }
      let score = flagDemote + ignore - promote
      if (score < -PROMO_CAP) score = -PROMO_CAP
      // Keep any real flag on the record (preserves prior behaviour), otherwise
      // only persist scores above the noise floor.
      if (agg.badCount < 1 && Math.abs(score) < WRITE_EPS) continue
      const [conceptKey, targetId] = splitAggKey(key)
      adjustments.push({ scope: 'product', conceptKey, targetId, score, badCount: agg.badCount, goodCount: agg.goodCount, distinctFlaggers: agg.flaggers.size })
    }
    for (const [key, agg] of Array.from(vendorAgg)) {
      // Whole-vendor demotion is a much bigger blast radius than one product
      // — requires real corroboration (several distinct shoppers), not one
      // person's bad day with a single item.
      if (agg.badCount < VENDOR_MIN_BAD || agg.flaggers.size < VENDOR_MIN_FLAGGERS) continue
      const [conceptKey, targetId] = splitAggKey(key)
      const score = Math.max(0, agg.badCount - GOOD_WEIGHT * agg.goodCount)
      if (score <= 0) continue
      adjustments.push({ scope: 'vendor', conceptKey, targetId, score, badCount: agg.badCount, goodCount: agg.goodCount, distinctFlaggers: agg.flaggers.size })
    }

    if (adjustments.length === 0) {
      return NextResponse.json({ ok: true, message: 'No adjustments cleared threshold', written: 0 })
    }

    const result = await convex.mutation(api.qualitySignals.writeRelevanceAdjustments, { serverSecret, adjustments })
    const promotions = adjustments.filter(a => a.score < 0).length
    const demotions = adjustments.filter(a => a.score > 0).length
    return NextResponse.json({
      ok: true,
      badSignals: badRows?.length ?? 0,
      goodSignals: goodRows?.length ?? 0,
      impressionEvents: impressionEvents.length,
      viewEvents: viewEvents.length,
      written: result?.count ?? adjustments.length,
      promotions,
      demotions,
    })
  } catch (err: any) {
    console.error('[quality-feedback] error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
