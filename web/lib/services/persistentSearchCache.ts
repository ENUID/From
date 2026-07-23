/**
 * Persistent search cache — lets the in-memory 15-minute result pool survive
 * serverless cold starts. Same freshness window as memory (Convex enforces the
 * 15-min TTL on read), so nothing served is staler than the app already allows.
 * Discovery only: product detail and checkout always hit the live store.
 *
 * Best-effort by construction — every read/write is wrapped, time-boxed, and
 * failure-silent, so the cache can never slow or break a search.
 */
import { ConvexHttpClient } from 'convex/browser'
import { anyApi } from 'convex/server'
import type { UcpProduct } from './GlobalCatalogService'

const MAX_CACHED = 60
const READ_TIMEOUT_MS = 1500

// Default OFF: this cache serializes whole product-array JSON blobs to Convex
// on every search (read + write), which is the single largest Convex-bandwidth
// consumer in the app, and on the free tier that pushes toward a paid upgrade.
// It only ever cached FREE work (the live catalog fetch), and the in-memory
// pool in GlobalCatalogService still absorbs repeat searches within a warm
// instance, so turning off the Convex layer costs nothing but a re-fetch on a
// cold start. Set SEARCH_CACHE=on to re-enable once on a plan that can afford it.
function enabled(): boolean {
  return (process.env.SEARCH_CACHE ?? 'off').toLowerCase() === 'on'
}
function client(): ConvexHttpClient | null {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL
  return url ? new ConvexHttpClient(url) : null
}
function serverSecret(): string | undefined {
  return process.env.CONVEX_AUTH_SECRET
}

export async function readPersistentCache(key: string): Promise<{ products: UcpProduct[], age: number } | null> {
  if (!enabled()) return null
  const c = client()
  const secret = serverSecret()
  if (!c || !secret) return null
  try {
    const row = (await Promise.race([
      c.query(anyApi.searchCache.get, { key, serverSecret: secret }),
      new Promise(resolve => setTimeout(() => resolve(null), READ_TIMEOUT_MS)),
    ])) as { products?: string; createdAt?: number } | null
    if (!row?.products) return null
    const arr = JSON.parse(row.products)
    if (!Array.isArray(arr)) return null
    return { products: arr as UcpProduct[], age: Date.now() - (row.createdAt ?? 0) }
  } catch {
    return null
  }
}

export async function writePersistentCache(key: string, products: UcpProduct[]): Promise<void> {
  if (!enabled() || products.length === 0) return
  const c = client()
  const secret = serverSecret()
  if (!c || !secret) return
  try {
    const slim = products.slice(0, MAX_CACHED)
    await c.mutation(anyApi.searchCache.set, { key, products: JSON.stringify(slim), serverSecret: secret })
  } catch {
    /* ignore — cache writes are never critical */
  }
}
