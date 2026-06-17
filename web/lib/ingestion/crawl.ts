/**
 * Crawl a single store's full product catalog via its UCP/MCP endpoint.
 *
 * Strategy: run search_catalog with no query (browses all) + per-category passes
 * to maximize coverage beyond the 30-product-per-call limit. Deduplicates by id.
 */

import { normalizeProduct, NormalizedProduct } from './normalize'

const MCP_TIMEOUT_MS = 10_000
const PER_CALL_LIMIT = 30

type McpPayload = {
  jsonrpc: '2.0'
  method: 'tools/call'
  id: number
  params: {
    name: 'search_catalog'
    arguments: { catalog: Record<string, unknown> }
  }
}

function buildPayload(query?: string, category?: string): McpPayload {
  const catalogArgs: Record<string, unknown> = {
    filters: { available: true },
    pagination: { limit: PER_CALL_LIMIT },
  }
  if (query) catalogArgs.query = query
  if (category) catalogArgs.filters = { ...catalogArgs.filters as object, category }
  return {
    jsonrpc: '2.0',
    method: 'tools/call',
    id: 1,
    params: { name: 'search_catalog', arguments: { catalog: catalogArgs } },
  }
}

function extractProducts(data: any): any[] {
  if (data?.result?.structuredContent?.products) return data.result.structuredContent.products
  const text = data?.result?.content?.[0]?.text
  if (typeof text === 'string') {
    try {
      const inner = JSON.parse(text)
      if (Array.isArray(inner?.products)) return inner.products
    } catch {}
  }
  if (Array.isArray(data?.result?.products)) return data.result.products
  return []
}

async function mcpCall(domain: string, payload: McpPayload): Promise<any[]> {
  try {
    const res = await fetch(`https://${domain}/api/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(MCP_TIMEOUT_MS),
    })
    if (!res.ok) return []
    return extractProducts(await res.json())
  } catch {
    return []
  }
}

export type CrawlResult = {
  domain: string
  products: NormalizedProduct[]
  rawCount: number
  errored: boolean
}

export async function crawlStore(
  domain: string,
  storeGender: string[],
  categories: string[],
): Promise<CrawlResult> {
  // 1. Browse-all pass (no query, no category filter)
  const browseAll = await mcpCall(domain, buildPayload())

  // 2. Per-category passes — hits different slices of the catalog
  const categoryPasses = await Promise.all(
    categories.slice(0, 6).map(cat => mcpCall(domain, buildPayload(undefined, cat)))
  )

  // 3. Merge and deduplicate by product id
  const seen = new Set<string>()
  const raw: any[] = []
  for (const p of [...browseAll, ...categoryPasses.flat()]) {
    const id = String(p.id ?? '')
    if (id && !seen.has(id)) {
      seen.add(id)
      raw.push(p)
    }
  }

  const errored = browseAll.length === 0 && categoryPasses.every(r => r.length === 0)

  const products = raw
    .map(p => normalizeProduct(p, domain, storeGender))
    .filter((p): p is NormalizedProduct => p !== null && Boolean(p.external_id) && Boolean(p.image_url))

  return { domain, products, rawCount: raw.length, errored }
}
