import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { groqChat } from '@/lib/groq'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'

export const runtime = 'nodejs'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ ok: false }, { status: 401 })
    }

    const { messages } = await req.json()
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ ok: false })
    }

    const recent = messages.slice(-10).map((m: any) => {
      const role = m.role === 'user' ? 'You' : 'Fabrics'
      return `${role}: ${String(m.content || '').slice(0, 300)}`
    }).join('\n')

    const compression = await groqChat(
      [{ role: 'user', content: `Compress this Fabrics (AI stylist) conversation into a 80-100 word memory summary. Capture: what the shopper is working on, their style preferences, sizes or budget mentioned, products they liked or disliked, and any relevant personal context. Write in second person ("The shopper prefers..."). Be specific and dense with useful signals.\n\n${recent}` }],
      undefined, undefined,
      { temperature: 0, max_tokens: 160 }
    )

    const summary: string = (compression?.content ?? '').trim()
    if (!summary || summary.length < 20) return NextResponse.json({ ok: false })

    await convex.mutation(api.stylistMemory.upsertStylistMemory, {
      userEmail: session.user.email,
      summary,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[stylist-memory]', err)
    return NextResponse.json({ ok: false })
  }
}
