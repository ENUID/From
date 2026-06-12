import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { anyApi } from 'convex/server'
import { UCP_REGISTRY } from '@/lib/stores'
import { recordBrandOutcome, brandHealthReport } from '@/lib/services/brandHealth'

export const runtime = 'nodejs'
export const maxDuration = 300

const PROBE_QUERY = 'shirt'        // generic term every fashion catalog should answer
const PROBE_TIMEOUT_MS = 8000
const BATCH = 40

/**
 * Probes every brand's UCP endpoint and records whether it responds with
 * products. Produces the authoritative "which brands actually work" snapshot.
 * Secured with CRON_SECRET; also callable manually with the same bearer token.
 */
export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const domains = UCP_REGISTRY.map(s => s.domain.toLowerCase().trim())
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL
  const convex = convexUrl ? new ConvexHttpClient(convexUrl) : null

  async function probe(domain: string): Promise<{ healthy: boolean; products: number }> {
    const payload = {
      jsonrpc: '2.0', method: 'tools/call', id: 1,
      params: { name: 'search_catalog', arguments: { catalog: { query: PROBE_QUERY, filters: { available: true }, pagination: { limit: 5 } } } },
    }
    try {
      const res = await fetch(`https://${domain}/api/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      })
      if (!res.ok) { recordBrandOutcome(domain, { productCount: 0, errored: true }); return { healthy: false, products: 0 } }
      const data = await res.json()
      const products =
        data?.result?.structuredContent?.products ??
        (() => { try { return JSON.parse(data?.result?.content?.[0]?.text ?? '{}')?.products ?? [] } catch { return [] } })() ??
        data?.result?.products ?? []
      const count = Array.isArray(products) ? products.length : 0
      recordBrandOutcome(domain, { productCount: count, errored: false })
      return { healthy: true, products: count }
    } catch {
      recordBrandOutcome(domain, { productCount: 0, errored: true })
      return { healthy: false, products: 0 }
    }
  }

  for (let i = 0; i < domains.length; i += BATCH) {
    const batch = domains.slice(i, i + BATCH)
    const outcomes = await Promise.all(batch.map(probe))
    // Persist each probe so the auto-prune list survives cold starts.
    if (convex) {
      await Promise.all(
        batch.map((domain, j) =>
          convex.mutation(anyApi.brandHealth.recordProbe, {
            domain, healthy: outcomes[j].healthy, productCount: outcomes[j].products,
          }).catch(() => null),
        ),
      )
    }
  }

  const report = brandHealthReport()
  console.log(`[brand-health] probed ${report.total} brands:`, JSON.stringify(report.byStatus))
  return NextResponse.json({ ok: true, ...report })
}
