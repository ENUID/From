/**
 * Text embedding for product corpus.
 *
 * Primary: OpenAI text-embedding-3-small (1536 dims, $0.02/1M tokens)
 * Fallback: Jina AI jina-embeddings-v2-base-en (768 dims — requires schema change)
 *
 * Set OPENAI_API_KEY in env to enable embeddings.
 * Embeddings are optional; the system falls back to pure FTS without them.
 */

const EMBED_MODEL = 'text-embedding-3-small'
const EMBED_DIMS = 1536
const BATCH_SIZE = 100   // OpenAI supports up to 2048 inputs per call
const MAX_CHARS = 512    // cap per product text to keep token count low

export type EmbedResult = {
  index: number
  embedding: number[]
}

function buildProductText(title: string, vendor: string, description: string, tags: string[]): string {
  const parts = [
    title,
    vendor,
    tags.slice(0, 12).join(', '),
    description.slice(0, MAX_CHARS),
  ].filter(Boolean)
  return parts.join(' | ').slice(0, 800)
}

export async function embedBatch(texts: string[]): Promise<EmbedResult[]> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return []   // embeddings disabled — FTS-only mode

  const results: EmbedResult[] = []

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const chunk = texts.slice(i, i + BATCH_SIZE)
    try {
      const res = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model: EMBED_MODEL, input: chunk }),
        signal: AbortSignal.timeout(30_000),
      })
      if (!res.ok) {
        console.error('[embed] OpenAI error', res.status, await res.text())
        continue
      }
      const data = await res.json() as { data: Array<{ index: number; embedding: number[] }> }
      for (const item of data.data) {
        results.push({ index: i + item.index, embedding: item.embedding })
      }
    } catch (err) {
      console.error('[embed] batch failed at offset', i, (err as Error).message)
    }
  }

  return results
}

export async function embedProducts(
  products: Array<{ title: string; vendor: string; description: string; tags: string[] }>
): Promise<Array<number[] | null>> {
  const texts = products.map(p =>
    buildProductText(p.title, p.vendor, p.description, p.tags)
  )
  const results = await embedBatch(texts)

  const output: Array<number[] | null> = new Array(products.length).fill(null)
  for (const r of results) {
    output[r.index] = r.embedding
  }
  return output
}

export { EMBED_DIMS, buildProductText }
