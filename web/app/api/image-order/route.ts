import { NextRequest, NextResponse } from 'next/server'
import { orderImagesModelFirst } from '@/lib/services/imageClassifier'

// Given a product's image URLs, return them reordered model-shot-first using
// vision classification (cached). Used by grid cards and the detail gallery so
// on-body photos lead and flat packshots trail — reliably, even for
// skin-coloured garments that fool pixel heuristics.
export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const urls: string[] = Array.isArray(body?.urls)
      ? body.urls.filter((u: unknown): u is string => typeof u === 'string')
      : []
    if (urls.length < 2) return NextResponse.json({ order: urls })
    const order = await orderImagesModelFirst(urls)
    return NextResponse.json({ order })
  } catch {
    return NextResponse.json({ order: [] })
  }
}
