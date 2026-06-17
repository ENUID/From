/**
 * POST /api/v2/sync
 *
 * Manually trigger a catalog sync for specific stores (or all curated stores).
 * Protected by CRON_SECRET header.
 *
 * Body: { domains?: string[], dryRun?: boolean }
 */

import { NextRequest, NextResponse } from 'next/server'
import { runSync } from '@/lib/ingestion/sync'

export const runtime = 'nodejs'
export const maxDuration = 300   // 5 minutes for full crawl

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') ?? req.headers.get('authorization')?.replace('Bearer ', '')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { domains?: string[]; dryRun?: boolean } = {}
  try { body = await req.json() } catch {}

  console.log('[v2/sync] starting sync', body.domains ?? 'all', body.dryRun ? '(dry run)' : '')

  try {
    const report = await runSync(body.domains, body.dryRun ?? false)
    return NextResponse.json(report)
  } catch (err) {
    console.error('[v2/sync]', err)
    return NextResponse.json({ error: 'Sync failed', detail: (err as Error).message }, { status: 500 })
  }
}
