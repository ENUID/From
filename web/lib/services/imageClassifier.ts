/**
 * Vision-based product image ordering.
 *
 * Heuristics (filename, aspect ratio, skin-tone pixels) can't reliably tell a
 * model shot from a flat lay when the garment itself is skin-coloured
 * (terracotta, beige, tan) — the clothing reads as "skin" too. The only robust
 * signal is the SHAPE of a person, so we ask the vision model to label each
 * photo as on-body vs product-only, then sort on-body first and flat last.
 *
 * Runs server-side (no browser CORS limits on reading images) and is cached
 * three ways — per-process memory, Convex persistence (shared across users,
 * survives cold starts), and the client — so the vision call happens at most
 * once per product, ever. Failure-silent: any error falls back to input order.
 */
import { createHash } from 'crypto'
import { ConvexHttpClient } from 'convex/browser'
import { anyApi } from 'convex/server'
import { BoundedCache } from '@/lib/boundedCache'
import { groqVisionChat, type VisionMessage } from '@/lib/groq'

const MAX_IMAGES = 5          // Groq vision caps images per request at 5
const READ_TIMEOUT_MS = 1500
const mem = new BoundedCache<string, string[]>(4000)

function enabled(): boolean {
  return (process.env.IMAGE_ORDER_VISION ?? 'on').toLowerCase() === 'on'
}
function client(): ConvexHttpClient | null {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL
  return url ? new ConvexHttpClient(url) : null
}
function keyFor(urls: string[]): string {
  return createHash('sha1').update(urls.join('\n')).digest('hex')
}

// Smaller images = faster, cheaper vision calls. Low detail is plenty to tell a
// person apart from a packshot. Non-Shopify hosts ignore the param harmlessly.
function visionThumb(src: string): string {
  try {
    const u = new URL(src.startsWith('//') ? `https:${src}` : src)
    if (u.hostname.includes('shopify')) {
      u.searchParams.set('width', '384')
      u.searchParams.delete('height')
    }
    return u.toString()
  } catch {
    return src
  }
}

// Merge a cached/classified ordering back over the caller's full list: keep the
// ordered items that still exist, then append anything the ordering didn't
// cover (extra images beyond the cap), preserving the caller's order.
function reattach(order: string[], full: string[]): string[] {
  const inOrder = order.filter(u => full.includes(u))
  const set = new Set(inOrder)
  const extras = full.filter(u => !set.has(u))
  return [...inOrder, ...extras]
}

async function readCache(key: string): Promise<string[] | null> {
  const c = client()
  if (!c) return null
  try {
    const row = (await Promise.race([
      c.query(anyApi.imageOrder.get, { key }),
      new Promise(resolve => setTimeout(() => resolve(null), READ_TIMEOUT_MS)),
    ])) as { order?: string } | null
    if (!row?.order) return null
    const arr = JSON.parse(row.order)
    return Array.isArray(arr) ? (arr as string[]) : null
  } catch {
    return null
  }
}

async function writeCache(key: string, order: string[]): Promise<void> {
  const c = client()
  if (!c) return
  try {
    await c.mutation(anyApi.imageOrder.set, { key, order: JSON.stringify(order) })
  } catch {
    /* cache writes are never critical */
  }
}

const SYSTEM =
  'You are a precise fashion product-image classifier. You only ever output JSON, no prose.'

function prompt(n: number): string {
  return (
    `These are ${n} photos of ONE clothing product, numbered 0 to ${n - 1} in order. ` +
    `For each photo decide if a real human PERSON is wearing or modeling the clothing ` +
    `(on-body, worn, lifestyle, or editorial shot). A flat lay, packshot on a surface, ` +
    `hanger shot, folded item, ghost-mannequin with no visible person, swatch, or pure ` +
    `product close-up is NOT a person. ` +
    `Respond with ONLY a JSON array of ${n} objects, one per photo in order: ` +
    `[{"i":0,"person":true},{"i":1,"person":false}, ...]. No other text.`
  )
}

// Parse per-image person labels. Tolerant of the model wrapping or truncating
// JSON: tries a full parse first, then falls back to per-object regex.
function parseLabels(text: string, n: number): (boolean | null)[] {
  const labels: (boolean | null)[] = new Array(n).fill(null)
  const apply = (i: number, person: boolean) => {
    if (Number.isInteger(i) && i >= 0 && i < n) labels[i] = person
  }
  const block = text.match(/\[[\s\S]*\]/)
  if (block) {
    try {
      const arr = JSON.parse(block[0])
      if (Array.isArray(arr)) {
        for (const o of arr) {
          if (o && typeof o.i === 'number') apply(o.i, o.person === true)
        }
        return labels
      }
    } catch {
      /* fall through to regex */
    }
  }
  const re = /"i"\s*:\s*(\d+)[^}]*?"person"\s*:\s*(true|false)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) apply(parseInt(m[1], 10), m[2] === 'true')
  return labels
}

async function classify(urls: string[]): Promise<string[]> {
  const parts: VisionMessage['content'] = [
    { type: 'text', text: prompt(urls.length) },
    ...urls.map(u => ({
      type: 'image_url' as const,
      image_url: { url: visionThumb(u), detail: 'low' as const },
    })),
  ]
  const msg = await groqVisionChat(
    [{ role: 'user', content: parts }],
    SYSTEM,
    { max_tokens: 300, temperature: 0 },
  )
  const labels = parseLabels(msg?.content ?? '', urls.length)
  // On-body shots first, unknowns in the middle, flat/product shots last —
  // stable within each group so the store's own sequencing is preserved.
  const rank = (i: number) => (labels[i] === true ? 0 : labels[i] === false ? 2 : 1)
  const idx = urls.map((_, i) => i).sort((a, b) => rank(a) - rank(b) || a - b)
  return idx.map(i => urls[i])
}

/** Order a product's images on-body-first. Returns input order on any failure. */
export async function orderImagesModelFirst(input: string[]): Promise<string[]> {
  const urls = Array.from(new Set(input.filter(u => typeof u === 'string' && /^https?:|^\/\//.test(u)))).slice(0, MAX_IMAGES)
  if (!enabled() || urls.length < 2) return input

  const key = keyFor(urls)
  const cached = mem.get(key)
  if (cached) return reattach(cached, input)

  const persisted = await readCache(key)
  if (persisted) {
    mem.set(key, persisted)
    return reattach(persisted, input)
  }

  try {
    const order = await classify(urls)
    mem.set(key, order)
    void writeCache(key, order)
    return reattach(order, input)
  } catch {
    return input
  }
}
