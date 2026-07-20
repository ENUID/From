/**
 * Shared analytics-report builder. Pulls the same adminSecret-gated aggregates
 * the dashboard shows, assembles them into one structured object, and renders a
 * fully-formatted Markdown report. Used by:
 *   • /api/admin/analytics/report  — the human download (Markdown / print-PDF)
 *   • the AI-analyst (analyze route + weekly cron) — the SAME report is what the
 *     model reads, so what you feed a model by hand and what the loop feeds
 *     itself are identical.
 * No new dependencies — reuses the existing Convex queries.
 */
import { ConvexHttpClient } from 'convex/browser'
import { anyApi } from 'convex/server'

const DAY = 24 * 60 * 60 * 1000

export interface ReportData {
  days: number
  generatedAt: number
  overview: any
  topSearches: any[]
  topUsers: any[]
  activity: any[]
  topProducts: { opened: any[]; saved: any[] } | null
  aiUsage: any
  insight: any
}

export async function gatherReport(
  convex: ConvexHttpClient,
  adminSecret: string,
  serverSecret: string | undefined,
  days: number,
): Promise<ReportData> {
  const windowMs = days * DAY
  const q = <T,>(p: Promise<T>, fallback: T): Promise<T> => p.catch(() => fallback)
  const [overview, topSearches, topUsers, activity, topProducts, aiUsage, insight] = await Promise.all([
    q(convex.query(anyApi.analytics.adminOverview, { adminSecret, windowMs }), null),
    q(convex.query(anyApi.analytics.adminTopSearches, { adminSecret, windowMs, limit: 60 }), [] as any[]),
    q(convex.query(anyApi.analytics.adminTopUsers, { adminSecret, windowMs, limit: 50 }), [] as any[]),
    q(convex.query(anyApi.analytics.adminActivityFeed, { adminSecret, limit: 250 }), [] as any[]),
    q(convex.query(anyApi.analytics.adminTopProducts, { adminSecret, windowMs, limit: 20 }), { opened: [], saved: [] }),
    serverSecret ? q(convex.query(anyApi.users.getAiUsageSummary, { serverSecret, windowMs }), null) : Promise.resolve(null),
    q(convex.query(anyApi.learningInsights.getLatest, { adminSecret }), null),
  ])
  return { days, generatedAt: Date.now(), overview, topSearches, topUsers, activity, topProducts, aiUsage, insight }
}

function n(x: any): string { return typeof x === 'number' ? x.toLocaleString() : '—' }
function windowLabel(days: number): string {
  if (days <= 1) return 'last 24 hours'
  if (days < 365) return `last ${days} days`
  const y = Math.round(days / 365)
  return `last ${y} year${y === 1 ? '' : 's'}`
}

export function reportToMarkdown(r: ReportData): string {
  const ov = r.overview
  const dt = new Date(r.generatedAt)
  const L: string[] = []
  L.push(`# Discern — Analytics & Learning Report`)
  L.push(`*Generated ${dt.toISOString().replace('T', ' ').slice(0, 16)} UTC · window: ${windowLabel(r.days)}*`)
  L.push('')
  L.push(`This report describes how shoppers are using Discern and how the Fabrics AI stylist is performing. It is meant to be read by a human OR fed to an AI model with the instruction: "Analyse this and propose concrete, specific improvements to search relevance, garment/vocabulary coverage, and the shopping experience."`)
  L.push('')

  // 1. Summary
  L.push(`## 1. Summary`)
  if (ov) {
    L.push(`- **Searches:** ${n(ov.searches.total)} (${n(ov.searches.signedIn)} signed-in, ${n(ov.searches.anonymous)} anonymous)`)
    L.push(`- **Distinct signed-in searchers:** ${n(ov.searches.distinctSearchers)}`)
    L.push(`- **Users:** ${n(ov.users.total)} total · ${n(ov.users.new)} new · ${n(ov.users.active)} active this window`)
    L.push(`- **AI calls:** ${n(ov.ai.requests)}${r.aiUsage ? ` · ~${n(r.aiUsage.totalEstPromptTokens)} est. prompt tokens` : ''}`)
  } else {
    L.push(`_No overview available (check ADMIN_SECRET in Convex)._`)
  }
  L.push('')

  // 2. Engagement funnel
  if (ov?.funnel) {
    const f = ov.funnel, ra = ov.rates || {}
    L.push(`## 2. Engagement funnel`)
    L.push(`How products performed after being shown. Open/save/flag rates are the exact behaviour the self-learning ranking loop trains on.`)
    L.push('')
    L.push(`| Stage | Count | Rate (of shown) |`)
    L.push(`|---|---:|---:|`)
    L.push(`| Shown (impressions) | ${n(f.impressions)} | — |`)
    L.push(`| Opened | ${n(f.views)} | ${ra.viewRate != null ? ra.viewRate + '%' : '—'} |`)
    L.push(`| Saved | ${n(f.saves)} | ${ra.saveRate != null ? ra.saveRate + '%' : '—'} |`)
    L.push(`| Flagged as bad match | ${n(f.flags)} | ${ra.flagRate != null ? ra.flagRate + '%' : '—'} |`)
    L.push('')
  }

  // 3. Top searches
  if (r.topSearches?.length) {
    L.push(`## 3. Top searches`)
    L.push(`| Query | Count | People | Avg results |`)
    L.push(`|---|---:|---:|---:|`)
    for (const s of r.topSearches.slice(0, 40)) {
      L.push(`| ${mdCell(s.query)} | ${n(s.count)} | ${n(s.searchers)} | ${s.avgResults ?? '—'} |`)
    }
    L.push('')
  }

  // 4. Zero-result searches
  const zero = (r.topSearches || []).filter((s: any) => s.avgResults != null && s.avgResults < 1)
  if (zero.length) {
    L.push(`## 4. Searches returning nothing (highest-priority fixes)`)
    L.push(`These queries produced no results — the clearest signal of missing catalog coverage or vocabulary the AI doesn't understand yet.`)
    L.push('')
    for (const s of zero.slice(0, 40)) L.push(`- **${mdCell(s.query)}** — searched ${n(s.count)}×`)
    L.push('')
  }

  // 5/6. Top products
  if (r.topProducts) {
    if (r.topProducts.opened?.length) {
      L.push(`## 5. Most-opened products`)
      for (const p of r.topProducts.opened) L.push(`- ${mdCell(p.title)}${p.vendor ? ` — ${mdCell(p.vendor)}` : ''} (${n(p.count)} opens)`)
      L.push('')
    }
    if (r.topProducts.saved?.length) {
      L.push(`## 6. Most-saved products`)
      for (const p of r.topProducts.saved) L.push(`- ${mdCell(p.title)}${p.vendor ? ` — ${mdCell(p.vendor)}` : ''} (${n(p.count)} saves)`)
      L.push('')
    }
  }

  // 7. Active shoppers
  if (r.topUsers?.length) {
    L.push(`## 7. Most-active shoppers`)
    L.push(`| Email | Searches | Saves | Country | Device |`)
    L.push(`|---|---:|---:|---|---|`)
    for (const u of r.topUsers.slice(0, 40)) {
      L.push(`| ${mdCell(u.email)} | ${n(u.searches)} | ${n(u.saves)} | ${u.country || '—'} | ${u.deviceType || '—'} |`)
    }
    L.push('')
  }

  // 8. AI usage
  if (r.aiUsage) {
    L.push(`## 8. AI usage by provider`)
    L.push(`Total ${n(r.aiUsage.totalRequests)} calls · ~${n(r.aiUsage.totalEstPromptTokens)} est. prompt tokens.`)
    L.push('')
    const provs = Object.entries(r.aiUsage.byProvider || {}) as [string, any][]
    for (const [prov, v] of provs.sort((a, b) => b[1].requests - a[1].requests)) {
      L.push(`- **${prov}** — ${n(v.requests)} calls, ~${n(v.estPromptTokens)} tok${v.failures ? `, ${n(v.failures)} failures` : ''}`)
    }
    L.push('')
  }

  // 9. Activity log
  if (r.activity?.length) {
    L.push(`## 9. Activity log (every action, exact text)`)
    L.push(`Newest first. This is the raw behaviour — what each person actually searched, opened, saved, or flagged.`)
    L.push('')
    for (const a of r.activity.slice(0, 200)) {
      const when = new Date(a.at).toISOString().replace('T', ' ').slice(0, 16)
      const who = a.email || 'anonymous'
      const label = ({ search: 'Searched', open: 'Opened', save: 'Saved', flag: 'Flagged' } as any)[a.kind] || a.kind
      const text = a.kind === 'search' ? `"${a.text}"` : a.text
      L.push(`- \`${when}\` **${label}** ${mdCell(text)}${a.meta ? ` — ${mdCell(a.meta)}` : ''} — ${mdCell(who)}`)
    }
    L.push('')
  }

  // 10. AI recommendations
  if (r.insight?.content) {
    L.push(`## 10. Latest AI recommendations`)
    L.push(`*Generated ${new Date(r.insight.createdAt).toISOString().slice(0, 10)}${r.insight.model ? ` by ${r.insight.model}` : ''}.*`)
    L.push('')
    L.push(r.insight.content)
    L.push('')
  }

  L.push(`---`)
  L.push(`_Token counts are estimates. Anonymous actions appear in totals but can't be attributed to a person. Data source: Convex._`)
  return L.join('\n')
}

// Escape pipe/newline so a value never breaks a Markdown table row.
function mdCell(s: any): string {
  return String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ').slice(0, 200)
}
