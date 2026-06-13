import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { anyApi } from 'convex/server'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

function authorized(req: NextRequest): { ok: boolean; reason?: string } {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return { ok: false, reason: 'not_configured' }
  const header = req.headers.get('x-admin-secret')
  return { ok: header === secret, reason: header !== secret ? 'wrong_secret' : undefined }
}

// POST — grant access
// Body: { email: string, note?: string }
export async function POST(req: NextRequest) {
  const auth = authorized(req)
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized', reason: auth.reason }, { status: 401 })
  const { email, note } = await req.json().catch(() => ({}))
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'email required' }, { status: 400 })
  }
  const id = await convex.mutation(anyApi.subscriptions.grantAllowlistAccess, {
    email: email.toLowerCase().trim(),
    note: typeof note === 'string' ? note : undefined,
  })
  return NextResponse.json({ ok: true, id, email: email.toLowerCase().trim() })
}

// DELETE — revoke access
// Body: { email: string }
export async function DELETE(req: NextRequest) {
  const auth = authorized(req)
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized', reason: auth.reason }, { status: 401 })
  const { email } = await req.json().catch(() => ({}))
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'email required' }, { status: 400 })
  }
  const id = await convex.mutation(anyApi.subscriptions.revokeAllowlistAccess, {
    email: email.toLowerCase().trim(),
  })
  return NextResponse.json({ ok: true, removed: !!id })
}

// GET — list everyone on the allowlist
export async function GET(req: NextRequest) {
  const auth = authorized(req)
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized', reason: auth.reason }, { status: 401 })
  try {
    const list = await convex.query(anyApi.subscriptions.listAllowlist, {})
    return NextResponse.json({ ok: true, count: list.length, list })
  } catch (e: any) {
    return NextResponse.json({ error: 'Convex error', detail: e?.message ?? String(e) }, { status: 500 })
  }
}
