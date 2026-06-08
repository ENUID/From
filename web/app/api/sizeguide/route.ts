import { NextRequest, NextResponse } from 'next/server'

const SIZE_KWS = /\b(size|chest|waist|hip|inseam|sleeve|shoulder|length|neck|bust|height|weight|measurements?|XS|XL|XXL)\b/i

// 1. HTML tables containing size keywords (most accurate)
function extractTables(html: string): string | null {
  const found: string[] = []
  const re = /<table[\s\S]*?<\/table>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    if (SIZE_KWS.test(m[0])) found.push(m[0])
  }
  return found.length ? found.join('') : null
}

// 2. Images that look like size charts (src or alt mentions size/chart/guide/measurement)
function extractSizeImages(html: string): string | null {
  const found: string[] = []
  const re = /<img[^>]+>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const tag = m[0]
    if (/\bsrc=/i.test(tag) && /size.?chart|size.?guide|sizing|measurement/i.test(tag)) {
      // Make sure it's a real image src, not a placeholder
      const srcMatch = tag.match(/src=["']([^"']+)["']/i)
      if (srcMatch && !srcMatch[1].startsWith('data:')) {
        found.push(
          tag
            .replace(/width=["'][^"']*["']/gi, '')
            .replace(/height=["'][^"']*["']/gi, '')
            .replace(/<img/, '<img style="max-width:100%;height:auto;display:block"')
        )
      }
    }
  }
  return found.length ? `<div>${found.join('')}</div>` : null
}

// 3. On a dedicated size guide page, grab ALL significant images (they are the guide)
function extractPageImages(html: string): string | null {
  const found: string[] = []
  const re = /<img[^>]+>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const tag = m[0]
    const srcMatch = tag.match(/src=["']([^"']+)["']/i)
    if (!srcMatch) continue
    const src = srcMatch[1]
    // Skip tiny icons, SVGs, and data URIs
    if (src.startsWith('data:') || /\.(svg|ico)(\?|$)/i.test(src)) continue
    // Skip images that are clearly UI (logos, spinners, etc.)
    if (/logo|spinner|icon|avatar|banner|hero/i.test(src + tag)) continue
    // Check width/height hints — we want substantial images
    const wMatch = tag.match(/width=["'](\d+)["']/i)
    const w = wMatch ? parseInt(wMatch[1]) : 999
    if (w < 100) continue
    found.push(
      tag
        .replace(/width=["'][^"']*["']/gi, '')
        .replace(/height=["'][^"']*["']/gi, '')
        .replace(/<img/, '<img style="max-width:100%;height:auto;display:block;margin:8px 0"')
    )
  }
  return found.length ? `<div>${found.join('')}</div>` : null
}

function guessUrls(base: string): string[] {
  try {
    const { protocol, hostname } = new URL(base)
    const o = `${protocol}//${hostname}`
    return [
      `${o}/pages/size-guide`,
      `${o}/pages/sizing`,
      `${o}/pages/size-chart`,
      `${o}/pages/size`,
      `${o}/pages/fit-guide`,
    ]
  } catch {
    return []
  }
}

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      // Cache in Next.js data cache for 1 hour
      cache: 'force-cache',
      next: { revalidate: 3600 },
    } as RequestInit)
  } finally {
    clearTimeout(id)
  }
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('url')
  if (!raw) return NextResponse.json({ html: null })

  let parsed: URL
  try {
    parsed = new URL(raw)
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error()
    if (/^(localhost|127\.|10\.|192\.168\.|::1)/.test(parsed.hostname)) throw new Error()
  } catch {
    return NextResponse.json({ html: null })
  }

  const candidates = guessUrls(raw)
  if (!candidates.length) return NextResponse.json({ html: null })

  for (const url of candidates) {
    try {
      const res = await fetchWithTimeout(url, 7000)
      if (!res.ok) continue
      const html = await res.text()

      // Try in order of preference: structured table → labelled image → any page image
      const tables = extractTables(html)
      if (tables) return NextResponse.json({ html: tables })

      const labelledImgs = extractSizeImages(html)
      if (labelledImgs) return NextResponse.json({ html: labelledImgs })

      const pageImgs = extractPageImages(html)
      if (pageImgs) return NextResponse.json({ html: pageImgs })

    } catch {
      continue
    }
  }

  return NextResponse.json({ html: null })
}
