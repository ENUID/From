import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { anyApi } from 'convex/server'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

function authorized(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return false
  const header = req.headers.get('x-admin-secret')
  return header === secret
}

// POST — grant access
// Body: { email: string, note?: string }
export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const list = await convex.query(anyApi.subscriptions.listAllowlist, {})
  return NextResponse.json({ ok: true, count: list.length, list })
}
