import { NextRequest, NextResponse } from 'next/server'

const SIZE_TABLE_KWS = /\b(size|chest|waist|hip|inseam|sleeve|shoulder|length|neck|bust|height|weight|measurements?)\b/i

function extractSizeTables(html: string): string | null {
  const tables: string[] = []
  const re = /<table[\s\S]*?<\/table>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    if (SIZE_TABLE_KWS.test(m[0])) tables.push(m[0])
  }
  return tables.length > 0 ? tables.join('') : null
}

// Try several common Shopify size-guide URL patterns in order
function guessUrls(base: string): string[] {
  try {
    const { protocol, hostname } = new URL(base)
    const origin = `${protocol}//${hostname}`
    return [
      `${origin}/pages/size-guide`,
      `${origin}/pages/sizing`,
      `${origin}/pages/size-chart`,
      `${origin}/pages/size`,
    ]
  } catch {
    return []
  }
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('url')
  if (!raw) return NextResponse.json({ html: null })

  // Only allow http(s) URLs to real hostnames — no localhost, no internal IPs
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
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; From-app/1.0)',
          'Accept': 'text/html',
        },
        // Next.js cache: revalidate once per hour per URL
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(6000),
      })
      if (!res.ok) continue
      const html = await res.text()
      const tables = extractSizeTables(html)
      if (tables) return NextResponse.json({ html: tables })
    } catch {
      continue
    }
  }

  return NextResponse.json({ html: null })
}
