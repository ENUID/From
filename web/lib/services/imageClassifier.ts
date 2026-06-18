/**
 * Vision-based product image curation + ordering.
 *
 * Heuristics (filename, aspect ratio, skin-tone pixels) can't reliably tell a
 * model shot from a flat lay when the garment itself is skin-coloured
 * (terracotta, beige, tan) — the clothing reads as "skin" too. The only robust
 * signal is the SHAPE of a person, so the vision model labels each photo:
 * on-body vs product-only, its camera angle, and a quality score.
 *
 * From that we CURATE the gallery down to the best 5–6: the strongest model
 * shots across distinct angles (front → full → side → back → detail) followed by
 * one clean product shot, dropping redundant / awkward-angle / low-quality
 * extras. Model shots lead, the product shot trails.
 *
 * Groq caps a vision request at 5 images, so larger galleries are classified in
 * parallel batches of 5 (the "second call") and merged before curating.
 *
 * Runs server-side (no browser CORS limits on reading images) and is cached
 * three ways — per-process memory, Convex persistence (shared across users,
 * survives cold starts), and the client — so the vision calls happen at most
 * once per product, ever. Failure-silent: any error falls back to input order.
 */
import { createHash } from 'crypto'
import { ConvexHttpClient } from 'convex/browser'
import { anyApi } from 'convex/server'
import { BoundedCache } from '@/lib/boundedCache'
import { groqVisionChat, type VisionMessage } from '@/lib/groq'

const BATCH = 5               // Groq vision caps images per request at 5
const MAX_IMAGES = 12         // classify at most this many (≤3 batched calls)
const FINAL_CAP = 6           // curated gallery size
const MAX_MODELS = 5          // at most this many on-body shots in the result
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

// Smaller images = faster, cheaper vision calls. Low detail is plenty to read a
// pose and angle. Non-Shopify hosts ignore the param harmlessly.
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

// ── Vision classification ─────────────────────────────────────────────────────

type Meta = { url: string; person: boolean | null; view: string; quality: number }

const VIEWS = ['front', 'full', 'side', 'back', 'detail', 'flatlay', 'other'] as const

const SYSTEM =
  'You are a precise fashion product-image classifier. You only ever output JSON, no prose.'

function prompt(n: number): string {
  return (
    `These are ${n} photos of ONE clothing product, numbered 0 to ${n - 1} in order. ` +
    `For EACH photo return an object with:\n` +
    `- "i": its index\n` +
    `- "person": true if a real human is wearing/modeling the garment (on-body, worn, ` +
    `lifestyle, editorial); false if it is product-only (flat lay, packshot, hanger, ` +
    `folded, ghost-mannequin, swatch, pure close-up)\n` +
    `- "view": the camera angle — one of "front","full","side","back","detail","flatlay","other"\n` +
    `- "quality": 0-100, how good this photo is as a shop hero (clear, well-lit, ` +
    `flattering, sharp; penalise blurry, dark, awkward, cropped, or duplicate angles)\n` +
    `Respond with ONLY a JSON array of ${n} such objects in order. No other text.`
  )
}

function normView(v: unknown): string {
  const s = String(v ?? '').toLowerCase().trim()
  return (VIEWS as readonly string[]).includes(s) ? s : 'other'
}
function normQuality(q: unknown): number {
  const n = typeof q === 'number' ? q : parseFloat(String(q))
  if (!Number.isFinite(n)) return 50
  return Math.max(0, Math.min(100, n))
}

// Parse the model's JSON (tolerant of wrapping / truncation) into per-index meta.
function parseMetas(text: string, n: number): Array<Omit<Meta, 'url'>> {
  const out: Array<Omit<Meta, 'url'>> = Array.from({ length: n }, () => ({
    person: null, view: 'other', quality: 50,
  }))
  const apply = (i: number, person: boolean | null, view: string, quality: number) => {
    if (Number.isInteger(i) && i >= 0 && i < n) out[i] = { person, view, quality }
  }
  const block = text.match(/\[[\s\S]*\]/)
  if (block) {
    try {
      const arr = JSON.parse(block[0])
      if (Array.isArray(arr)) {
        for (const o of arr) {
          if (o && typeof o.i === 'number') {
            apply(o.i, o.person === true ? true : o.person === false ? false : null,
              normView(o.view), normQuality(o.quality))
          }
        }
        return out
      }
    } catch {
      /* fall through to regex */
    }
  }
  // Fallback: pull person flags only, keep neutral view/quality.
  const re = /"i"\s*:\s*(\d+)[^}]*?"person"\s*:\s*(true|false)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const i = parseInt(m[1], 10)
    if (Number.isInteger(i) && i >= 0 && i < n) out[i].person = m[2] === 'true'
  }
  return out
}

async function classifyBatch(urls: string[]): Promise<Meta[]> {
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
    { max_tokens: 600, temperature: 0 },
  )
  const metas = parseMetas(msg?.content ?? '', urls.length)
  return urls.map((url, i) => ({ url, ...metas[i] }))
}

// ── Curation ──────────────────────────────────────────────────────────────────

const VIEW_RANK: Record<string, number> = {
  front: 0, full: 1, side: 2, back: 3, detail: 4, other: 5, flatlay: 6,
}

// Pick the best 5–6: strong model shots across distinct angles (front → back),
// then one clean product shot. Drops redundant / low-quality / extra frames.
function curate(metas: Meta[]): string[] {
  const models = metas.filter(m => m.person === true)
  const others = metas.filter(m => m.person !== true) // false or unknown

  // Model shots: order by angle, best quality first; cap to 2 per angle so we
  // get variety (front, full, back…) rather than five near-identical frames.
  models.sort((a, b) =>
    (VIEW_RANK[a.view] ?? 9) - (VIEW_RANK[b.view] ?? 9) || b.quality - a.quality)
  const perView: Record<string, number> = {}
  const chosenModels: Meta[] = []
  for (const m of models) {
    const seen = perView[m.view] ?? 0
    if (seen >= 2) continue
    perView[m.view] = seen + 1
    chosenModels.push(m)
    if (chosenModels.length >= MAX_MODELS) break
  }

  // One product shot: the single best-quality non-model frame.
  others.sort((a, b) => b.quality - a.quality)
  const chosenProduct = others.slice(0, 1)

  let result = [...chosenModels, ...chosenProduct]
  // No model shots at all → show the best handful of product frames instead.
  if (result.length === 0) result = others.slice(0, FINAL_CAP)
  return result.slice(0, FINAL_CAP).map(m => m.url)
}

/** Curate + order a product's images on-body-first. Returns input on any failure. */
export async function orderImagesModelFirst(input: string[]): Promise<string[]> {
  const urls = Array.from(
    new Set(input.filter(u => typeof u === 'string' && /^https?:|^\/\//.test(u))),
  ).slice(0, MAX_IMAGES)
  if (!enabled() || urls.length < 2) return input

  const key = keyFor(urls)
  const cached = mem.get(key)
  if (cached) return cached

  const persisted = await readCache(key)
  if (persisted) {
    mem.set(key, persisted)
    return persisted
  }

  try {
    // Classify in parallel batches of 5 (Groq's per-request image cap), merge,
    // then curate down to the best 5–6.
    const batches: string[][] = []
    for (let i = 0; i < urls.length; i += BATCH) batches.push(urls.slice(i, i + BATCH))
    const metas = (await Promise.all(batches.map(classifyBatch))).flat()
    const result = curate(metas)
    if (result.length === 0) return input
    mem.set(key, result)
    void writeCache(key, result)
    return result
  } catch {
    return input
  }
}
