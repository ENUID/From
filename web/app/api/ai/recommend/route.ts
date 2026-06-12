import { NextRequest, NextResponse } from 'next/server'
import { generateRobustAIResponse } from '@/lib/groq'

const WINDOW_MS = 60_000
const MAX_REQUESTS = 10
const rateBuckets = new Map<string, { count: number; resetAt: number }>()

function isRateLimited(req: NextRequest): boolean {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const now = Date.now()
  const bucket = rateBuckets.get(ip)
  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }
  if (bucket.count >= MAX_REQUESTS) return true
  bucket.count++
  return false
}

export async function POST(req: NextRequest) {
  if (isRateLimited(req)) {
    return NextResponse.json({ recommendations: [] }, { status: 429 })
  }
  try {
    const { history } = await req.json()
    if (!Array.isArray(history) || history.length === 0) {
      return NextResponse.json({ recommendations: [] })
    }

    const recentQueries = history
      .slice(0, 5)
      .map((h: any) => String(h?.query ?? '').slice(0, 200))
      .filter(Boolean)
      .join(', ')

    if (!recentQueries) return NextResponse.json({ recommendations: [] })

    const systemPrompt = `You are a personalized shopping recommendation engine. The user recently searched for: ${recentQueries}.
Based on these interests, generate 4 concise, high-intent shopping search queries that they might want to explore next.
Make them diverse but related to their general style or needs shown in the history.
Return ONLY a valid JSON array of strings, nothing else. Example: ["Organic cotton t-shirts", "Vintage leather belts", "Minimalist home decor", "Summer linen pants"]`

    const aiResponse = await generateRobustAIResponse(
      [{ role: 'user', content: 'Generate recommendations' }],
      systemPrompt,
      []
    )

    let recommendations = []
    try {
      const text = (aiResponse.content || '').trim()
      const jsonStart = text.indexOf('[')
      const jsonEnd = text.lastIndexOf(']') + 1
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        recommendations = JSON.parse(text.slice(jsonStart, jsonEnd))
      }
    } catch (e) {
      console.error('Failed to parse recommendations JSON:', e)
    }

    return NextResponse.json({ recommendations })
  } catch (error) {
    console.error('Recommendation API Error:', error)
    return NextResponse.json({ recommendations: [] })
  }
}
