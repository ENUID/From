/**
 * Persistent rerank-judge cache — lets relevanceRerank.ts's in-memory LLM
 * relevance-score cache survive serverless cold starts. Same shape as
 * lib/services/persistentSearchCache.ts (best-effort, time-boxed,
 * failure-silent — a cache miss or error here just means the LLM judge runs
 * as it always did, never worse than before this existed).
 */
import { ConvexHttpClient } from 'convex/browser'
import { anyApi } from 'convex/server'

const READ_TIMEOUT_MS = 1500

// Default OFF: a Convex read on every rerank + a write on every miss, to cache
// only the FREE LLM judge across cold starts. On the Convex free tier those
// per-search ops add up toward a paid upgrade the shopper can't afford; the
// in-memory rerank cache still de-dupes within a warm instance, so disabling
// the Convex layer degrades nothing Fabrics decides. Set
// RERANK_PERSISTENT_CACHE=on to re-enable on a paid plan.
function enabled(): boolean {
  return (process.env.RERANK_PERSISTENT_CACHE ?? 'off').toLowerCase() === 'on'
}
function client(): ConvexHttpClient | null {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL
  return url ? new ConvexHttpClient(url) : null
}
function serverSecret(): string | undefined {
  return process.env.CONVEX_AUTH_SECRET
}

export async function readPersistentRerankCache(key: string): Promise<{ ids: string[]; scores: Map<string, number> } | null> {
  if (!enabled()) return null
  const c = client()
  const secret = serverSecret()
  if (!c || !secret) return null
  try {
    const row = (await Promise.race([
      c.query(anyApi.rerankCache.get, { key, serverSecret: secret }),
      new Promise(resolve => setTimeout(() => resolve(null), READ_TIMEOUT_MS)),
    ])) as { ids?: string; scores?: string } | null
    if (!row?.ids || !row?.scores) return null
    const ids = JSON.parse(row.ids)
    const scoresObj = JSON.parse(row.scores)
    if (!Array.isArray(ids) || typeof scoresObj !== 'object' || scoresObj === null) return null
    return { ids, scores: new Map(Object.entries(scoresObj).map(([k, v]) => [k, Number(v)])) }
  } catch {
    return null
  }
}

export async function writePersistentRerankCache(key: string, ids: string[], scores: Map<string, number>): Promise<void> {
  if (!enabled() || ids.length === 0) return
  const c = client()
  const secret = serverSecret()
  if (!c || !secret) return
  try {
    const scoresObj: Record<string, number> = {}
    for (const [id, score] of Array.from(scores)) scoresObj[id] = score
    await c.mutation(anyApi.rerankCache.set, {
      key, ids: JSON.stringify(ids), scores: JSON.stringify(scoresObj), serverSecret: secret,
    })
  } catch {
    /* ignore — cache writes are never critical */
  }
}
