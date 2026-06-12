import { NextRequest, NextResponse } from 'next/server'
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

  async function probe(domain: string): Promise<void> {
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
      if (!res.ok) { recordBrandOutcome(domain, { productCount: 0, errored: true }); return }
      const data = await res.json()
      const products =
        data?.result?.structuredContent?.products ??
        (() => { try { return JSON.parse(data?.result?.content?.[0]?.text ?? '{}')?.products ?? [] } catch { return [] } })() ??
        data?.result?.products ?? []
      recordBrandOutcome(domain, { productCount: Array.isArray(products) ? products.length : 0, errored: false })
    } catch {
      recordBrandOutcome(domain, { productCount: 0, errored: true })
    }
  }

  for (let i = 0; i < domains.length; i += BATCH) {
    await Promise.all(domains.slice(i, i + BATCH).map(probe))
  }

  const report = brandHealthReport()
  console.log(`[brand-health] probed ${report.total} brands:`, JSON.stringify(report.byStatus))
  return NextResponse.json({ ok: true, ...report })
}
