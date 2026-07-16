import { NextRequest, NextResponse } from 'next/server'
import { orderImagesModelFirst } from '@/lib/services/imageClassifier'
import { makeIpRateLimiter } from '@/lib/rateLimit'

// Unauthenticated + a vision-LLM call per uncached image set — rate-limit
// per IP so it can't be scripted into a vision-quota drain.
const isRateLimited = makeIpRateLimiter(30, 60_000)

// Given a product's image URLs, return them reordered model-shot-first using
// vision classification (cached). Used by grid cards and the detail gallery so
// on-body photos lead and flat packshots trail — reliably, even for
// skin-coloured garments that fool pixel heuristics.
export const maxDuration = 30

export async function POST(req: NextRequest) {
  if (isRateLimited(req)) return NextResponse.json({ order: [] }, { status: 429 })
  // Parsed outside the main try so the failure fallback below can still
  // return the caller's own URLs — a transient classifier failure must
  // degrade to "unordered gallery", never to "no gallery". The previous
  // catch returned { order: [] }, which the frontend rendered as a product
  // with zero images.
  let urls: string[] = []
  try {
    const body = await req.json()
    urls = Array.isArray(body?.urls)
      ? body.urls.filter((u: unknown): u is string => typeof u === 'string')
      : []
  } catch {
    return NextResponse.json({ order: [] })
  }
  if (urls.length < 2) return NextResponse.json({ order: urls })
  try {
    const order = await orderImagesModelFirst(urls)
    return NextResponse.json({ order })
  } catch (e) {
    console.error('[image-order] classification failed, returning original order:', e)
    return NextResponse.json({ order: urls })
  }
}
