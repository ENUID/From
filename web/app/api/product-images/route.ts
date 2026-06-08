import { NextRequest, NextResponse } from 'next/server'

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

// Cache by product URL so repeated sheet opens are instant
const cache = new Map<string, string[]>()

function toGalleryUrl(src: string): string {
  if (!src) return src
  try {
    const u = new URL(src.startsWith('//') ? `https:${src}` : src)
    if (u.hostname.includes('cdn.shopify.com')) {
      u.searchParams.set('width', '2048')
      u.searchParams.delete('height')
    }
    return u.toString()
  } catch {
    return src
  }
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('url')
  if (!raw) return NextResponse.json({ images: [] })

  try { new URL(raw) } catch { return NextResponse.json({ images: [] }) }

  if (cache.has(raw)) return NextResponse.json({ images: cache.get(raw) })

  // Extract the product handle from the URL
  const handleMatch = raw.match(/\/products\/([^/?#]+)/)
  if (!handleMatch) return NextResponse.json({ images: [] })

  const { protocol, hostname } = new URL(raw)
  const jsonUrl = `${protocol}//${hostname}/products/${handleMatch[1]}.json`

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 7000)
    const res = await fetch(jsonUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': UA, Accept: 'application/json' },
    })
    clearTimeout(timer)
    if (!res.ok) {
      cache.set(raw, [])
      return NextResponse.json({ images: [] })
    }

    const data = await res.json()
    const product = data?.product

    // Collect all images: product.images covers the full gallery including
    // images attached to specific variants.
    const seen = new Set<string>()
    const images: string[] = []

    const push = (src?: string) => {
      if (!src) return
      const url = toGalleryUrl(src)
      if (!seen.has(url)) { seen.add(url); images.push(url) }
    }

    // Primary gallery (ordered by position)
    for (const img of (product?.images ?? [])) push(img.src)

    // Variant images — may include colour-specific shots not in main gallery
    for (const v of (product?.variants ?? [])) push(v.featured_image?.src)

    cache.set(raw, images)
    return NextResponse.json({ images })
  } catch {
    cache.set(raw, [])
    return NextResponse.json({ images: [] })
  }
}
