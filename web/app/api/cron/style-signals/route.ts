import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { groqChat } from '@/lib/groq'
import { api } from '@/convex/_generated/api'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!process.env.CONVEX_AUTH_SECRET) {
    return NextResponse.json({ error: 'Not configured' }, { status: 503 })
  }

  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

  try {
    const cutoff = Date.now() - 48 * 60 * 60 * 1000
    const recentSearches = await convex.query(api.searchHistory.getRecentSearches, {
      cutoff,
      serverSecret: process.env.CONVEX_AUTH_SECRET,
    })

    if (!recentSearches || recentSearches.length === 0) {
      return NextResponse.json({ ok: true, message: 'No recent searches', concepts: [] })
    }

    const queries = recentSearches
      .map((s: { query: string }) => s.query)
      .filter((q: string) => q && q.trim().length > 2)
      .slice(0, 100)

    if (queries.length < 5) {
      return NextResponse.json({ ok: true, message: 'Not enough queries', concepts: [] })
    }

    const prompt = `Below are recent fashion search queries from shoppers. Identify the top 8–12 aesthetic concepts or style trends that appear most frequently (e.g. "quiet luxury", "gorpcore", "dark academia"). Return ONLY a JSON array of strings, no prose:
["concept1","concept2",...]

Queries:
${queries.map((q: string) => `- ${q}`).join('\n')}`

    let concepts: string[] = []
    try {
      const raw = await groqChat(
        [{ role: 'user', content: prompt }],
        'You are a fashion trend analyst. Return only valid JSON.',
        undefined,
        { temperature: 0, max_tokens: 300 },
      )
      const text = (raw as any)?.content ?? (raw as any)?.choices?.[0]?.message?.content ?? ''
      const match = text.match(/\[[\s\S]*\]/)
      if (match) concepts = JSON.parse(match[0])
    } catch (e) {
      // Non-blocking, but never silent: an empty concepts array must be
      // distinguishable in logs from "the model genuinely found no trends".
      console.error('[style-signals] trend extraction failed:', e)
    }

    console.log('[style-signals] emerging concepts:', concepts)

    return NextResponse.json({ ok: true, queriesAnalyzed: queries.length, concepts })
  } catch (err: any) {
    console.error('[style-signals] error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
