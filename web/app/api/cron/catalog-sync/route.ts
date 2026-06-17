/**
 * GET /api/cron/catalog-sync
 *
 * Vercel Cron Job — syncs the product corpus from all curated stores.
 * Schedule: every 24 hours (see vercel.json).
 *
 * Vercel sends `Authorization: Bearer <CRON_SECRET>` automatically for cron routes.
 */

import { NextRequest, NextResponse } from 'next/server'
import { runSync } from '@/lib/ingestion/sync'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log('[cron/catalog-sync] starting full catalog sync')

  try {
    const report = await runSync()
    console.log('[cron/catalog-sync] done:', report)
    return NextResponse.json({ ok: true, ...report })
  } catch (err) {
    console.error('[cron/catalog-sync]', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
