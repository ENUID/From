import { NextRequest, NextResponse } from 'next/server'
import { brandHealthReport } from '@/lib/services/brandHealth'

export const runtime = 'nodejs'

/**
 * Live brand-health report for the current serverless instance. Reflects every
 * fetch this instance has seen plus the latest brand-health cron probe. Secured
 * with CRON_SECRET (same admin token). Use ?status=down to filter.
 */
export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const report = brandHealthReport()
  const status = req.nextUrl.searchParams.get('status')
  if (status) {
    return NextResponse.json({
      ...report,
      brands: report.brands.filter(b => b.status === status),
    })
  }
  return NextResponse.json(report)
}
