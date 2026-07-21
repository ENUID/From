import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { anyApi } from 'convex/server'
import { gatherReport, reportToMarkdown } from '@/lib/services/analyticsReport'
import { analyzeReport } from '@/lib/services/learningAnalyst'

export const runtime = 'nodejs'
export const maxDuration = 60

// Weekly self-improvement pass: the app analyses its own usage and writes a
// fresh set of AI recommendations to learning_insights. Off the hot path,
// one LLM call per week — negligible against the shared free budget.
export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!process.env.ADMIN_SECRET || !process.env.CONVEX_AUTH_SECRET) {
    return NextResponse.json({ error: 'Not configured (ADMIN_SECRET / CONVEX_AUTH_SECRET)' }, { status: 503 })
  }

  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)
  const days = 30
  try {
    const data = await gatherReport(convex, process.env.ADMIN_SECRET, process.env.CONVEX_AUTH_SECRET, days)
    // Skip a run with essentially no data — nothing to learn from yet.
    const searches = data.overview?.searches?.total ?? 0
    if (searches < 5) {
      return NextResponse.json({ ok: true, message: 'Not enough activity to analyse', searches })
    }
    const compact = reportToMarkdown(data, { includeActivity: false })
    const result = await analyzeReport(compact)
    if (!result) return NextResponse.json({ ok: false, message: 'AI providers unavailable' })

    await convex.mutation(anyApi.learningInsights.writeInsight, {
      serverSecret: process.env.CONVEX_AUTH_SECRET,
      windowDays: days,
      content: result.content,
      model: result.model,
    })
    return NextResponse.json({ ok: true, model: result.model, chars: result.content.length })
  } catch (err: any) {
    console.error('[learning-analyst] error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
