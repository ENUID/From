import { groqChat } from '../groq'
import type { UcpProduct } from './GlobalCatalogService'
import { matchStyles, vocabPromptBlock } from '../styleVocabulary'

// ── Feature flags ─────────────────────────────────────────────────────────────
// LLM rerank is ON by default — set RELEVANCE_RERANK=off to disable.
// Always graceful: 6s timeout, silent fallback to BM25 order, 15-min cache.
export function isRerankEnabled(): boolean {
  return (process.env.RELEVANCE_RERANK ?? 'on').toLowerCase() === 'on'
}
const RERANK_TOP_N   = Number(process.env.RELEVANCE_RERANK_TOP_N   ?? 40)
const DESC_CHARS     = Number(process.env.RELEVANCE_RERANK_DESC_CHARS ?? 220)
const TIMEOUT_MS     = Number(process.env.RELEVANCE_RERANK_TIMEOUT_MS ?? 6000)

// ── Simple cache ──────────────────────────────────────────────────────────────
type CacheEntry = { ts: number; ids: string[]; scores: Map<string, number> }
const cache = new Map<string, CacheEntry>()
const CACHE_TTL = 15 * 60 * 1000
const CACHE_MAX = 300

function evictCache() {
  if (cache.size < CACHE_MAX) return
  const cutoff = Date.now() - CACHE_TTL
  const keys = Array.from(cache.keys())
  for (const k of keys) {
    const v = cache.get(k)!
    if (v.ts < cutoff) cache.delete(k)
    if (cache.size < CACHE_MAX) break
  }
  // If still too large, drop oldest entries
  if (cache.size >= CACHE_MAX) {
    const entries = Array.from(cache.entries()).sort((a, b) => a[1].ts - b[1].ts)
    for (const [k] of entries.slice(0, 50)) cache.delete(k)
  }
}

function cheapHash(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return h.toString(36)
}

function cacheKey(query: string, products: UcpProduct[]): string {
  const ids = products.map(p => p.id).sort().join(',')
  return cheapHash(query.toLowerCase().trim() + '|' + ids)
}

// ── Stage 1: BM25-lite ────────────────────────────────────────────────────────
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(t => t.length > 1)
}

function productDoc(p: UcpProduct): { titleTokens: string[]; bodyTokens: string[] } {
  const titleTokens = tokenize(p.title || '')

  const desc = (p.description || '').slice(0, DESC_CHARS).replace(/<[^>]+>/g, ' ')
  const tags  = (p.tags || []).join(' ')
  const opts  = (p.options || []).flatMap(o => [o.name, ...o.values]).join(' ')
  const body  = [desc, tags, opts, p.vendor || ''].join(' ')

  return { titleTokens, bodyTokens: tokenize(body) }
}

export function bm25Scores(query: string, products: UcpProduct[]): Map<string, number> {
  const qTokens = tokenize(query)
  if (!qTokens.length || !products.length) return new Map()

  const k1 = 1.2, b = 0.75
  const docs = products.map(p => productDoc(p))

  // Title is a separate field with 2.5× boost — treat as separate field BM25 then sum
  const titleLengths = docs.map(d => d.titleTokens.length)
  const bodyLengths  = docs.map(d => d.bodyTokens.length)
  const avgTitle = titleLengths.reduce((s, v) => s + v, 0) / (products.length || 1)
  const avgBody  = bodyLengths.reduce((s, v) => s + v, 0)  / (products.length || 1)

  // IDF per query term over the candidate set (body)
  const idf = new Map<string, number>()
  for (const t of Array.from(new Set(qTokens))) {
    const df = docs.filter(d => d.bodyTokens.includes(t) || d.titleTokens.includes(t)).length
    idf.set(t, Math.log((products.length - df + 0.5) / (df + 0.5) + 1))
  }

  const raw = products.map((p, i) => {
    const d = docs[i]
    let score = 0
    for (const t of qTokens) {
      const idfVal = idf.get(t) ?? 0

      // Body BM25
      const tfBody = d.bodyTokens.filter(x => x === t).length
      const bm25Body = idfVal * (tfBody * (k1 + 1)) / (tfBody + k1 * (1 - b + b * bodyLengths[i] / (avgBody || 1)))

      // Title BM25 (2.5× boost)
      const tfTitle = d.titleTokens.filter(x => x === t).length
      const bm25Title = idfVal * (tfTitle * (k1 + 1)) / (tfTitle + k1 * (1 - b + b * titleLengths[i] / (avgTitle || 1)))

      score += bm25Body + 2.5 * bm25Title
    }
    return { id: p.id, score }
  })

  // Normalize to 0–1
  const max = Math.max(...raw.map(r => r.score), 1e-9)
  const result = new Map<string, number>()
  for (const { id, score } of raw) result.set(id, score / max)
  return result
}

// ── Stage 2: LLM batch relevance scorer ──────────────────────────────────────
function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function compactProduct(p: UcpProduct, idx: number): string {
  const title    = p.title || 'Untitled'
  const vendor   = p.vendor && p.vendor !== 'Independent Seller' ? ` | ${p.vendor}` : ''
  const tags     = p.tags?.length ? ` | tags: ${p.tags.slice(0, 8).join(',')}` : ''
  const opts     = p.options?.length
    ? ' | opts: ' + p.options.map(o => `${o.name}[${o.values.slice(0, 4).join(',')}]`).join(' ')
    : ''
  const desc     = p.description
    ? ' | ' + stripHtml(p.description).slice(0, DESC_CHARS)
    : ''
  return `[${idx}] ${title}${vendor}${tags}${opts}${desc}`
}

type LLMScore = { score: number; reason: string }

async function llmRelevanceScores(
  query: string,
  products: UcpProduct[],
  tasteProfile?: string,
): Promise<Map<string, LLMScore> | null> {
  if (!products.length) return null

  const productLines = products.map((p, i) => compactProduct(p, i)).join('\n')
  const profileLine = tasteProfile ? `\nShopper profile: ${tasteProfile}\n` : ''

  const matched = matchStyles(query)
  const vocabBlock = vocabPromptBlock(matched)

  const system = `You are the relevance brain behind FROM, a curated fashion search. You think like a seasoned boutique buyer deciding what to put in front of this exact shopper — judging genuine fit for their INTENT, never keyword overlap.
${vocabBlock}
Score each numbered candidate 0-100 on how well it satisfies what the shopper actually wants. Weigh, in order:
1. GARMENT — is it the item they asked for? Wrong category (candle, bag when they want a shirt) → 0-5.
2. GENDER — wrong gender for an explicitly gendered request → 0-10.
3. MATERIAL & COLOUR — the fabric and palette they named, or that the style implies (quiet luxury → fine natural fibres, neutral tones).
4. STYLE & OCCASION — does the vibe, silhouette, and formality match the moment they're dressing for?
5. QUALITY SIGNAL — when intent is open, favour considered design and honest materials over generic filler.
A precise, slightly rarer match that truly fits beats a generic item that merely contains the words.${profileLine}
Output ONLY a JSON array, one object per product, no prose, no markdown:
[{"i":0,"s":87,"r":"linen camp shirt, beach wedding"},...]
- "i" = product index exactly as given
- "s" = relevance 0-100
- "r" = max 8-word reason
Return an entry for EVERY index. No trailing text.`

  const userMsg = `Query: "${query}"\n\nProducts:\n${productLines}`

  let raw: string | null = null
  try {
    const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), TIMEOUT_MS))
    const call = groqChat(
      [{ role: 'user', content: userMsg }],
      system,
      undefined,
      { temperature: 0, max_tokens: 1400 },
    ).then((r: any) => {
      // groqChat returns the raw API response object — extract text
      if (typeof r === 'string') return r
      const content = r?.choices?.[0]?.message?.content
      return typeof content === 'string' ? content : null
    }).catch(() => null)
    raw = await Promise.race([call, timeout])
  } catch {
    return null
  }

  if (!raw) return null

  // Two-tier JSON parser: full array first, then per-object regex fallback
  const out = new Map<string, LLMScore>()
  try {
    const match = raw.match(/\[[\s\S]*\]/)
    if (match) {
      const arr = JSON.parse(match[0]) as any[]
      for (const item of arr) {
        const i = Number(item?.i)
        const s = Number(item?.s)
        if (!isNaN(i) && i >= 0 && i < products.length && !isNaN(s)) {
          out.set(products[i].id, { score: Math.min(100, Math.max(0, s)), reason: item?.r ?? '' })
        }
      }
    }
  } catch {
    // Fallback: per-object regex
    const objRe = /\{\s*"i"\s*:\s*(\d+)\s*,\s*"s"\s*:\s*(\d+)[^}]*\}/g
    let m: RegExpExecArray | null
    while ((m = objRe.exec(raw)) !== null) {
      const i = parseInt(m[1]), s = parseInt(m[2])
      if (i >= 0 && i < products.length) {
        out.set(products[i].id, { score: Math.min(100, Math.max(0, s)), reason: '' })
      }
    }
  }

  // Require at least 50% coverage — else treat as failure
  if (out.size < products.length * 0.5) return null
  return out
}

// ── Orchestrator ──────────────────────────────────────────────────────────────
export async function rerankByRelevance(
  query: string,
  products: UcpProduct[],
  tasteProfile?: string,
): Promise<UcpProduct[]> {
  if (products.length <= 1) return products

  // Stage 1: BM25 — always runs, free, provides baseline and pre-filter
  const bm25 = bm25Scores(query, products)
  const byBm25 = [...products].sort((a, b) => (bm25.get(b.id) ?? 0) - (bm25.get(a.id) ?? 0))
  const topN  = byBm25.slice(0, RERANK_TOP_N)
  const rest  = byBm25.slice(RERANK_TOP_N)

  if (!isRerankEnabled()) {
    // BM25-only path: better than vendor-hash, zero cost
    return [...topN, ...rest]
  }

  // Cache check
  const key = cacheKey(query, topN)
  const cached = cache.get(key)
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    const idxMap = new Map(products.map((p, i) => [p.id, i]))
    const reordered = [...cached.ids]
      .map(id => products.find(p => p.id === id))
      .filter(Boolean) as UcpProduct[]
    // Attach cached scores
    for (const p of reordered) {
      const s = cached.scores.get(p.id)
      if (s !== undefined) (p as any).relevance_score = Math.round(s * 100)
    }
    const seenIds = new Set(cached.ids)
    const remaining = products.filter(p => !seenIds.has(p.id))
    void idxMap
    return [...reordered, ...remaining]
  }

  // Stage 2: LLM batch score
  const llm = await llmRelevanceScores(query, topN, tasteProfile)

  if (!llm) {
    // Fallback to BM25 order
    return [...topN, ...rest]
  }

  // Blend scores: 0.7 * llm + 0.3 * bm25
  const blended = topN.map(p => {
    const lScore  = (llm.get(p.id)?.score ?? 50) / 100  // 0–1
    const bScore  = bm25.get(p.id) ?? 0                 // 0–1
    const final   = 0.7 * lScore + 0.3 * bScore
    const reason  = llm.get(p.id)?.reason ?? ''
    return { p, final, reason }
  })

  blended.sort((a, b) => b.final - a.final)

  // Attach scores for debug/UI
  for (const { p, final, reason } of blended) {
    ;(p as any).relevance_score  = Math.round(final * 100)
    ;(p as any).relevance_reason = reason
  }

  const reranked = blended.map(x => x.p)

  // Populate cache
  evictCache()
  const scoreMap = new Map<string, number>()
  for (const { p, final } of blended) scoreMap.set(p.id, final)
  cache.set(key, { ts: Date.now(), ids: reranked.map(p => p.id), scores: scoreMap })

  return [...reranked, ...rest]
}
