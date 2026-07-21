import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { anyApi } from 'convex/server'
import { gatherReport, reportToMarkdown } from '@/lib/services/analyticsReport'
import { analyzeReport } from '@/lib/services/learningAnalyst'

export const runtime = 'nodejs'
export const maxDuration = 60

function getConvex(): ConvexHttpClient {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!url) throw new Error('NEXT_PUBLIC_CONVEX_URL is not set')
  return new ConvexHttpClient(url.trim().replace(/\/+$/, ''))
}

// On-demand: the dashboard's "Generate insights now" button. Gathers the
// compact report, runs the AI analyst, persists the result, returns it.
export async function POST(req: NextRequest) {
  if (req.headers.get('x-admin-secret') !== process.env.ADMIN_SECRET || !process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json().catch(() => ({}))
  const daysRaw = Number(body?.days)
  const days = Number.isFinite(daysRaw) && daysRaw > 0 ? Math.min(daysRaw, 3650) : 30

  let convex: ConvexHttpClient
  try { convex = getConvex() } catch (e: any) {
    return NextResponse.json({ error: 'Convex not configured', detail: e?.message }, { status: 500 })
  }

  const data = await gatherReport(convex, process.env.ADMIN_SECRET!, process.env.CONVEX_AUTH_SECRET, days)
  const compact = reportToMarkdown(data, { includeActivity: false })
  const result = await analyzeReport(compact)
  if (!result) {
    return NextResponse.json({ error: 'AI analysis unavailable (all providers failed or unconfigured)' }, { status: 502 })
  }

  // Persist (best-effort — the recommendation is still returned even if the
  // write fails, e.g. CONVEX_AUTH_SECRET not set).
  if (process.env.CONVEX_AUTH_SECRET) {
    try {
      await convex.mutation(anyApi.learningInsights.writeInsight, {
        serverSecret: process.env.CONVEX_AUTH_SECRET,
        windowDays: days,
        content: result.content,
        model: result.model,
      })
    } catch { /* non-fatal */ }
  }

  return NextResponse.json({ ok: true, insight: { content: result.content, model: result.model, createdAt: Date.now(), windowDays: days } })
}
