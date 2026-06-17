/**
 * POST /api/brands/profile — brand edits its own public profile.
 * Brand-session protected. Fields shown on the brand's FROM profile page.
 *
 * Body: { tagline?, bio?, logo_url?, hero_url?, instagram?, website? }
 */

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db/client'
import { getBrandSession } from '@/lib/brands/session'

export const runtime = 'nodejs'

function clean(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim().slice(0, max)
  return s || null
}

function cleanUrl(v: unknown): string | null {
  const s = clean(v, 500)
  if (!s) return null
  return /^https?:\/\//i.test(s) ? s : `https://${s}`
}

export async function POST(req: NextRequest) {
  const domain = await getBrandSession()
  if (!domain) return NextResponse.json({ error: 'Not connected' }, { status: 401 })
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'DB not configured' }, { status: 503 })

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch {}

  const tagline   = clean(body.tagline, 120)
  const bio       = clean(body.bio, 800)
  const logo_url  = cleanUrl(body.logo_url)
  const hero_url  = cleanUrl(body.hero_url)
  const instagram = clean(body.instagram, 60)?.replace(/^@/, '') ?? null
  const website   = cleanUrl(body.website)

  try {
    const db = sql()
    await db`
      UPDATE brand_accounts SET
        tagline = ${tagline}, bio = ${bio}, logo_url = ${logo_url},
        hero_url = ${hero_url}, instagram = ${instagram}, website = ${website},
        updated_at = now()
      WHERE store_domain = ${domain}
    `
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
