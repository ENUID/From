/**
 * The AI analyst — the self-improving loop's reasoning step. Takes the compact
 * analytics report and asks a free-tier LLM (Cerebras first, then Groq) to
 * produce concrete, evidence-cited improvements. Off the hot path (admin action
 * / weekly cron only), so it never competes with live shopping requests for the
 * shared free budget. Degrades to null if every provider fails — the caller
 * treats that as "no new insight this run", never an error.
 */
import { cerebrasChat, CEREBRAS_MODEL, CEREBRAS_CONFIGURED } from '@/lib/cerebras'
import { groqChat, stripThinkTags } from '@/lib/groq'

const SYSTEM = `You are a senior product and search-relevance analyst for Discern, an AI-native fashion shopping app whose stylist is called Fabrics. You turn raw usage data into specific, implementable improvements. You are precise, evidence-driven, and never generic. You cite the exact queries/products/numbers from the data. You never invent data that isn't present.`

const INSTRUCTION = `Below is a usage & performance report for Discern. Analyse it and produce a focused set of improvements the team can act on this week. Use this exact Markdown structure:

## Top 3 priorities
Ranked. Each: the action, why (cite the number/query from the data), and expected impact.

## Vocabulary & understanding gaps
From the zero-result and low-result searches — words/garments/styles Fabrics likely fails to understand or the catalog doesn't cover. Suggest concrete synonyms or garment mappings to add.

## Ranking & relevance
From flags and low open/save rates — patterns of bad matches, and what to demote/promote or change in the reranker.

## Catalog & merchandising
Gaps between demand (top searches) and what earns engagement (opens/saves).

## Experience notes
Anything about behaviour worth acting on.

Keep it tight and specific — bullets over prose, real examples from the data, no filler, no restating the report back. If the data is too sparse to support a section, say so briefly rather than inventing.

---

`

function parse(raw: any): string {
  const txt = String(raw?.content ?? raw?.choices?.[0]?.message?.content ?? '')
  return stripThinkTags(txt).trim()
}

export async function analyzeReport(reportMarkdown: string): Promise<{ content: string; model: string } | null> {
  const user = INSTRUCTION + reportMarkdown.slice(0, 14000)

  if (CEREBRAS_CONFIGURED) {
    try {
      const raw = await cerebrasChat([{ role: 'user', content: user }], SYSTEM, { temperature: 0.3, max_tokens: 1400 })
      const t = parse(raw)
      if (t.length > 40) return { content: t, model: `cerebras/${CEREBRAS_MODEL}` }
    } catch { /* fall through */ }
  }

  try {
    const raw = await groqChat([{ role: 'user', content: user }], SYSTEM, undefined, { temperature: 0.3, max_tokens: 1400 })
    const t = parse(raw)
    if (t.length > 40) return { content: t, model: 'groq' }
  } catch { /* fall through */ }

  return null
}
