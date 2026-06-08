import { NextRequest, NextResponse } from 'next/server'

const SIZE_KWS = /\b(size|chest|waist|hip|inseam|sleeve|shoulder|length|neck|bust|height|weight|measurements?|XS|XL|XXL)\b/i

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

// In-process cache keyed by store origin
const cache = new Map<string, string | null>()

// ── Content extractors ──────────────────────────────────────────────────────

function extractTables(html: string): string | null {
  const found: string[] = []
  const re = /<table[\s\S]*?<\/table>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    if (SIZE_KWS.test(m[0])) found.push(m[0])
  }
  return found.length ? found.join('') : null
}

function extractSizeImages(html: string): string | null {
  const found: string[] = []
  const re = /<img[^>]+>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const tag = m[0]
    if (!/\bsrc=/i.test(tag)) continue
    const srcM = tag.match(/src=["']([^"']+)["']/i)
    if (!srcM || srcM[1].startsWith('data:')) continue
    // Must look like a size-related image
    if (!/size.?chart|size.?guide|sizing|measurement/i.test(tag)) continue
    found.push(tag
      .replace(/width=["'][^"']*["']/gi, '')
      .replace(/height=["'][^"']*["']/gi, '')
      .replace(/<img/, '<img style="max-width:100%;height:auto;display:block"'))
  }
  return found.length ? `<div>${found.join('')}</div>` : null
}

function extractPageImages(html: string): string | null {
  const found: string[] = []
  const re = /<img[^>]+>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const tag = m[0]
    const srcM = tag.match(/src=["']([^"']+)["']/i)
    if (!srcM) continue
    const src = srcM[1]
    if (src.startsWith('data:') || /\.(svg|ico|gif)(\?|$)/i.test(src)) continue
    if (/logo|spinner|icon|avatar|badge|social|header|nav|menu/i.test(src + tag)) continue
    const wM = tag.match(/width=["'](\d+)["']/i)
    if (wM && parseInt(wM[1]) < 200) continue
    found.push(tag
      .replace(/width=["'][^"']*["']/gi, '')
      .replace(/height=["'][^"']*["']/gi, '')
      .replace(/<img/, '<img style="max-width:100%;height:auto;display:block;margin:6px 0"'))
  }
  return found.length ? `<div>${found.join('')}</div>` : null
}

function tryExtract(html: string): string | null {
  return extractTables(html) ?? extractSizeImages(html) ?? extractPageImages(html)
}

// ── Fetch helpers ───────────────────────────────────────────────────────────

async function getJson(url: string, ms = 8000): Promise<any> {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms)
  try {
    const r = await fetch(url, { signal: c.signal, headers: { Accept: 'application/json', 'User-Agent': UA } })
    if (!r.ok) return null
    return await r.json()
  } catch { return null } finally { clearTimeout(t) }
}

async function getHtml(url: string, ms = 7000): Promise<string | null> {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms)
  try {
    const r = await fetch(url, {
      signal: c.signal,
      headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' },
    })
    if (!r.ok) return null
    return await r.text()
  } catch { return null } finally { clearTimeout(t) }
}

// ── Strategy 1: Shopify public pages JSON API ────────────────────────────────
// /pages.json returns all store pages with full body_html — no bot protection,
// no Cloudflare, works on every Shopify store (custom domain or myshopify.com).
async function tryShopifyPagesApi(origin: string): Promise<string | null> {
  const data = await getJson(`${origin}/pages.json?limit=250`)
  if (!data?.pages) return null

  const pages: { title: string; body_html: string }[] = data.pages ?? []

  // Sort: size-guide/size-chart page titles rank first
  const ranked = pages
    .filter(p => /size|fit|measurement|sizing/i.test(p.title) && p.body_html?.length > 20)
    .sort((a, b) => {
      const score = (t: string) =>
        /size.?(guide|chart)/i.test(t) ? 3 : /size/i.test(t) ? 2 : /fit|measurement/i.test(t) ? 1 : 0
      return score(b.title) - score(a.title)
    })

  for (const page of ranked) {
    const result = tryExtract(page.body_html)
    if (result) return result
  }
  return null
}

// ── Strategy 2: Shopify product JSON (uses description_html) ─────────────────
// If the store_url contains a product path, try fetching its JSON directly.
async function tryProductJson(storeUrl: string): Promise<string | null> {
  const m = storeUrl.match(/\/products\/([^/?#]+)/)
  if (!m) return null
  const { protocol, hostname } = new URL(storeUrl)
  const data = await getJson(`${protocol}//${hostname}/products/${m[1]}.json`)
  const html: string = data?.product?.body_html ?? ''
  if (!html) return null
  return extractTables(html) ?? extractSizeImages(html)
}

// ── Strategy 3: Direct HTML fetch with many URL patterns ────────────────────
const SLUG_PATTERNS = [
  'size-guide', 'size-chart', 'sizing', 'size', 'sizes',
  'fit-guide', 'fit', 'size-guides', 'size-charts',
  'measurement-guide', 'measurements', 'international-sizing',
  'size-information', 'size-info',
]

async function tryDirectFetch(origin: string): Promise<string | null> {
  for (const slug of SLUG_PATTERNS) {
    const html = await getHtml(`${origin}/pages/${slug}`)
    if (!html) continue
    const result = tryExtract(html)
    if (result) return result
  }
  return null
}

// ── Route handler ───────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('url')
  if (!raw) return NextResponse.json({ html: null })

  let origin: string
  try {
    const u = new URL(raw)
    if (!['http:', 'https:'].includes(u.protocol)) throw new Error()
    if (/^(localhost|127\.|10\.|192\.168\.|::1)/.test(u.hostname)) throw new Error()
    origin = `${u.protocol}//${u.hostname}`
  } catch {
    return NextResponse.json({ html: null })
  }

  // Check cache first
  if (cache.has(origin)) return NextResponse.json({ html: cache.get(origin) ?? null })

  // Run all three strategies — Shopify JSON first (most reliable), then fallbacks in parallel
  const shopifyResult = await tryShopifyPagesApi(origin)
  if (shopifyResult) {
    cache.set(origin, shopifyResult)
    return NextResponse.json({ html: shopifyResult })
  }

  // Fallbacks: product JSON and direct HTML fetch in parallel
  const [productResult, directResult] = await Promise.allSettled([
    tryProductJson(raw),
    tryDirectFetch(origin),
  ])

  const result =
    (productResult.status === 'fulfilled' && productResult.value) ||
    (directResult.status === 'fulfilled'  && directResult.value)  ||
    null

  cache.set(origin, result)
  return NextResponse.json({ html: result })
}
