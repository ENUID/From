'use client'

import { useState, useEffect, useCallback } from 'react'

// Shares the community-admin login token so one ADMIN_SECRET unlocks both pages.
const STORAGE_KEY = 'discern_admin_secret'

// ── Light palette (validated, dataviz reference instance) ──
const C = {
  plane: '#f5f5f3', card: '#ffffff', ink: '#1d1d1f', ink2: '#6e6e73', muted: '#a1a1a6',
  border: 'rgba(0,0,0,0.08)', grid: 'rgba(0,0,0,0.06)', hairline: 'rgba(0,0,0,0.05)',
  blue: '#2a78d6', blueArea: 'rgba(42,120,214,0.10)', green: '#0a7d33', good: '#0ca30c', red: '#d03b3b',
  shadow: '0 1px 2px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.05)',
}
const KIND: Record<string, { label: string; color: string }> = {
  search: { label: 'Searched', color: C.blue },
  open: { label: 'Opened', color: C.green },
  save: { label: 'Saved', color: C.good },
  flag: { label: 'Flagged', color: C.red },
}

interface Overview {
  windowMs: number
  searches: { total: number; signedIn: number; anonymous: number; distinctSearchers: number; capped: boolean }
  ai: { requests: number; capped: boolean }
  users: { total: number; new: number; active: number; capped: boolean }
  funnel: { impressions: number; views: number; saves: number; flags: number }
  rates: { viewRate: number | null; saveRate: number | null; flagRate: number | null }
  byCountry: { label: string; count: number }[]
  byDevice: { label: string; count: number }[]
}
interface SeriesPoint { t0: number; searches: number; views: number }
interface TimeSeries { since: number; now: number; bucketMs: number; points: SeriesPoint[] }
interface TopSearch { query: string; count: number; searchers: number; avgResults: number | null; zeroResults: number; lastAt: number }
interface TopUser { email: string; name: string | null; searches: number; saves: number; lastSeenAt: number | null; country: string | null; deviceType: string | null }
interface Activity { kind: string; text: string; meta: string | null; at: number; country: string | null; email: string | null }
interface ProdRow { title: string; vendor: string | null; count: number }
interface AiUsage { totalRequests: number; totalEstPromptTokens: number; totalEstCompletionTokensCap: number; byProvider: Record<string, { requests: number; estPromptTokens: number; failures: number }>; byPath: Record<string, number> }
interface Insight { content: string; model?: string; createdAt: number; windowDays?: number }
interface Payload {
  ok: boolean; days: number
  overview: Overview | null; timeSeries: TimeSeries | null
  topSearches: TopSearch[] | null; topUsers: TopUser[] | null
  activity: Activity[] | null; topProducts: { opened: ProdRow[]; saved: ProdRow[] } | null
  insight: Insight | null; aiUsage: AiUsage | null; diag?: Record<string, string>; hint?: string | null
}

// Light Markdown → React (headings, bullets, bold) for the AI recommendations.
function MiniMarkdown({ text }: { text: string }) {
  const lines = text.split('\n')
  const nodes: React.ReactNode[] = []
  let list: React.ReactNode[] = []
  const flush = () => { if (list.length) { nodes.push(<ul key={'u' + nodes.length} style={{ margin: '4px 0 10px', paddingLeft: 18 }}>{list}</ul>); list = [] } }
  const bold = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => p.startsWith('**') && p.endsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>)
  lines.forEach((ln, i) => {
    if (/^#{1,3}\s/.test(ln)) { flush(); nodes.push(<div key={i} style={{ fontWeight: 650, fontSize: 13.5, color: '#1d1d1f', margin: '14px 0 6px' }}>{ln.replace(/^#{1,3}\s/, '')}</div>) }
    else if (/^[-*]\s/.test(ln)) { list.push(<li key={i} style={{ fontSize: 13, color: '#3a3a3c', margin: '3px 0', lineHeight: 1.5 }}>{bold(ln.replace(/^[-*]\s/, ''))}</li>) }
    else if (ln.trim() === '') { flush() }
    else { flush(); nodes.push(<div key={i} style={{ fontSize: 13, color: '#3a3a3c', margin: '4px 0', lineHeight: 1.5 }}>{bold(ln)}</div>) }
  })
  flush()
  return <>{nodes}</>
}

async function fetchT(url: string, init: RequestInit = {}, ms = 20000): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try { return await fetch(url, { ...init, signal: ctrl.signal }) } finally { clearTimeout(t) }
}
function ago(ts: number | null): string {
  if (!ts) return '—'
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60); if (m < 60) return `${m}m`
  const h = Math.floor(m / 60); if (h < 24) return `${h}h`
  const d = Math.floor(h / 24); if (d < 30) return `${d}d`
  return new Date(ts).toLocaleDateString()
}
function num(n: number): string { return n.toLocaleString() }
function ktok(n: number): string { return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n) }
function pct(n: number | null): string { return n == null ? '—' : `${n}%` }

const WINDOWS = [
  { label: '24h', days: 1 }, { label: '7d', days: 7 }, { label: '30d', days: 30 },
  { label: '3y', days: 1095 }, { label: '6y', days: 2190 }, { label: '9y', days: 3285 },
]

// ── Interactive line chart (light, validated palette) ──
function LineChart({ points, days }: { points: SeriesPoint[]; days: number }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 760, H = 210, padL = 34, padB = 24, padT = 12, padR = 10
  const n = points.length
  const maxV = Math.max(1, ...points.map(p => Math.max(p.searches, p.views)))
  const stepX = n <= 1 ? 0 : (W - padL - padR) / (n - 1)
  const x = (i: number) => padL + i * stepX
  const y = (v: number) => padT + (1 - v / maxV) * (H - padT - padB)
  const line = (key: 'searches' | 'views') => points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ')
  const area = `${points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.searches).toFixed(1)}`).join(' ')} L${x(n - 1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`
  const fmtT = (t: number) => days <= 1 ? new Date(t).toLocaleTimeString([], { hour: '2-digit' }) : new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric' })
  const total = points.reduce((s, p) => s + p.searches, 0)

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (n <= 1) return
    const rect = e.currentTarget.getBoundingClientRect()
    const vbx = ((e.clientX - rect.left) / rect.width) * W
    const i = Math.round((vbx - padL) / (stepX || 1))
    setHover(Math.max(0, Math.min(n - 1, i)))
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 8, fontSize: 12, color: C.ink2 }}>
        <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: C.blue, marginRight: 6 }} />Searches</span>
        <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: C.green, marginRight: 6 }} />Product opens</span>
      </div>
      {total === 0 ? (
        <div style={{ color: C.muted, fontSize: 13, padding: '32px 0', textAlign: 'center' }}>No activity in this window yet</div>
      ) : (
        <div style={{ position: 'relative' }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} preserveAspectRatio="none">
            {[0, 0.5, 1].map((f, i) => {
              const gy = padT + f * (H - padT - padB)
              return <g key={i}>
                <line x1={padL} y1={gy} x2={W - padR} y2={gy} stroke={C.grid} strokeWidth="1" />
                <text x={0} y={gy + 3} fill={C.muted} fontSize="9">{Math.round(maxV * (1 - f))}</text>
              </g>
            })}
            <path d={area} fill={C.blueArea} stroke="none" />
            <path d={line('views')} fill="none" stroke={C.green} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
            <path d={line('searches')} fill="none" stroke={C.blue} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
            {hover != null && (
              <g>
                <line x1={x(hover)} y1={padT} x2={x(hover)} y2={H - padB} stroke={C.border} strokeWidth="1" />
                <circle cx={x(hover)} cy={y(points[hover].searches)} r="3.5" fill={C.blue} stroke="#fff" strokeWidth="1.5" />
                <circle cx={x(hover)} cy={y(points[hover].views)} r="3.5" fill={C.green} stroke="#fff" strokeWidth="1.5" />
              </g>
            )}
            {[0, Math.floor((n - 1) / 2), n - 1].filter((v, i, a) => a.indexOf(v) === i && v >= 0).map(i => (
              <text key={i} x={x(i)} y={H - 7} fill={C.muted} fontSize="9" textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>{fmtT(points[i].t0)}</text>
            ))}
          </svg>
          {hover != null && (
            <div style={{ position: 'absolute', top: 0, left: `${(x(hover) / W) * 100}%`, transform: `translateX(${hover > n / 2 ? '-105%' : '5%'})`, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, boxShadow: C.shadow, padding: '7px 10px', fontSize: 12, pointerEvents: 'none', whiteSpace: 'nowrap' }}>
              <div style={{ color: C.ink2, fontSize: 11, marginBottom: 3 }}>{fmtT(points[hover].t0)}</div>
              <div style={{ color: C.blue, fontWeight: 600 }}>{num(points[hover].searches)} searches</div>
              <div style={{ color: C.green, fontWeight: 600 }}>{num(points[hover].views)} opens</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function BarRow({ label, value, max, sub, accent }: { label: string; value: number; max: number; sub?: string; accent: string }) {
  const w = max > 0 ? Math.max(2, (value / max) * 100) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0' }} title={`${label}: ${value}`}>
      <div style={{ width: 94, color: C.ink2, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1, background: '#f0f0ee', borderRadius: 5, height: 14, overflow: 'hidden' }}>
        <div style={{ width: `${w}%`, height: '100%', background: accent, borderRadius: 5, transition: 'width .3s' }} />
      </div>
      <div style={{ width: 78, textAlign: 'right', color: C.ink, fontSize: 12, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{num(value)}{sub ? <span style={{ color: C.muted }}> {sub}</span> : null}</div>
    </div>
  )
}

export default function AdminAnalyticsPage() {
  const [view, setView] = useState<'loading' | 'login' | 'admin'>('loading')
  const [secret, setSecret] = useState('')
  const [loginErr, setLoginErr] = useState('')
  const [working, setWorking] = useState(false)
  const [days, setDays] = useState(7)
  const [data, setData] = useState<Payload | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedFilter, setFeedFilter] = useState<'all' | 'search' | 'open' | 'save' | 'flag'>('all')

  const checkAuth = useCallback(async (s: string) => {
    try { const r = await fetchT('/api/admin/analytics?check=1', { headers: { 'x-admin-secret': s } }); return r.ok } catch { return false }
  }, [])
  const load = useCallback(async (s: string, d: number) => {
    setBusy(true); setErr('')
    try {
      const r = await fetchT(`/api/admin/analytics?days=${d}`, { headers: { 'x-admin-secret': s } })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErr(j.detail ?? j.error ?? `Couldn't load (${r.status})`); setBusy(false); return }
      setData(j)
    } catch (e: any) {
      setErr(e?.name === 'AbortError' ? 'Timed out — database may be unreachable' : 'Network error: ' + (e?.message ?? 'unknown'))
    }
    setBusy(false)
  }, [])

  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    if (!stored) { setView('login'); return }
    checkAuth(stored).then(ok => { if (ok) { setView('admin'); load(stored, days) } else { sessionStorage.removeItem(STORAGE_KEY); setView('login') } })
  }, [checkAuth, load]) // eslint-disable-line react-hooks/exhaustive-deps

  async function login() {
    const s = secret.trim(); if (!s || working) return
    setWorking(true); setLoginErr('')
    try {
      const r = await fetchT('/api/admin/analytics?check=1', { headers: { 'x-admin-secret': s } })
      if (r.ok) { sessionStorage.setItem(STORAGE_KEY, s); setView('admin'); load(s, days) }
      else if (r.status === 401) { const d = await r.json().catch(() => ({})); setLoginErr(d.reason === 'not_configured' ? 'ADMIN_SECRET not set in Vercel env' : 'Wrong password') }
      else setLoginErr(`Error ${r.status}`)
    } catch (e: any) { setLoginErr(e?.name === 'AbortError' ? 'Timed out' : 'Network error') }
    setWorking(false)
  }
  function setWindow(d: number) { setDays(d); const s = sessionStorage.getItem(STORAGE_KEY); if (s) load(s, d) }
  function refresh() { const s = sessionStorage.getItem(STORAGE_KEY); if (s) load(s, days) }

  // Download a fully-formatted report. Markdown is the best format to feed to an
  // AI ("analyse this and propose improvements"); PDF opens a print-styled view
  // that auto-triggers Save-as-PDF. Secret goes in the header, never the URL.
  const [exporting, setExporting] = useState<'md' | 'pdf' | null>(null)
  async function exportReport(kind: 'md' | 'pdf') {
    const s = sessionStorage.getItem(STORAGE_KEY); if (!s || exporting) return
    setExporting(kind)
    try {
      const r = await fetchT(`/api/admin/analytics/report?days=${days}&format=${kind}`, { headers: { 'x-admin-secret': s } }, 30000)
      if (!r.ok) { setErr(`Export failed (${r.status})`); setExporting(null); return }
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      if (kind === 'md') {
        const a = document.createElement('a')
        a.href = url; a.download = `discern-analytics-${new Date().toISOString().slice(0, 10)}.md`
        document.body.appendChild(a); a.click(); a.remove()
        setTimeout(() => URL.revokeObjectURL(url), 8000)
      } else {
        window.open(url, '_blank') // print-styled HTML auto-opens the print → Save-as-PDF dialog
        setTimeout(() => URL.revokeObjectURL(url), 60000)
      }
    } catch { setErr('Export failed — network error') }
    setExporting(null)
  }

  // On-demand AI analysis: the app reads its own data and writes concrete
  // improvement recommendations. Same engine the weekly cron runs.
  const [analyzing, setAnalyzing] = useState(false)
  const [insight, setInsight] = useState<Insight | null>(null)
  async function generateInsight() {
    const s = sessionStorage.getItem(STORAGE_KEY); if (!s || analyzing) return
    setAnalyzing(true); setErr('')
    try {
      const r = await fetchT('/api/admin/analytics/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-secret': s }, body: JSON.stringify({ days }) }, 60000)
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErr(j.error ?? `Analysis failed (${r.status})`); setAnalyzing(false); return }
      if (j.insight) setInsight(j.insight)
    } catch (e: any) { setErr(e?.name === 'AbortError' ? 'Analysis timed out' : 'Analysis failed') }
    setAnalyzing(false)
  }

  const font = 'system-ui, -apple-system, "Segoe UI", sans-serif'

  if (view === 'loading') return <div style={{ minHeight: '100svh', background: C.plane, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: font }}><div style={{ color: C.muted }}>Loading…</div></div>

  if (view === 'login') {
    return (
      <div style={{ minHeight: '100svh', background: C.plane, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: font }}>
        <div style={{ background: C.card, borderRadius: 16, padding: '32px 26px', width: '100%', maxWidth: 340, boxShadow: C.shadow, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 18, fontWeight: 650, color: C.ink }}>Discern Analytics</div>
          <div style={{ color: C.ink2, fontSize: 13, marginBottom: 22, marginTop: 2 }}>Usage dashboard</div>
          <input type="password" placeholder="Admin secret" value={secret} autoFocus onChange={e => setSecret(e.target.value)} onKeyDown={e => e.key === 'Enter' && login()}
            style={{ width: '100%', padding: '11px 13px', borderRadius: 10, border: `1px solid ${C.border}`, background: '#fafafa', color: C.ink, fontSize: 15, boxSizing: 'border-box', outline: 'none' }} />
          {loginErr && <div style={{ color: C.red, fontSize: 13, marginTop: 10 }}>{loginErr}</div>}
          <button onClick={login} disabled={working} style={{ width: '100%', marginTop: 16, padding: 12, borderRadius: 10, border: 'none', background: secret.trim() && !working ? C.ink : '#e5e5e3', color: secret.trim() && !working ? '#fff' : C.muted, fontSize: 15, fontWeight: 600, cursor: secret.trim() && !working ? 'pointer' : 'default' }}>
            {working ? 'Checking…' : 'Enter'}
          </button>
        </div>
      </div>
    )
  }

  const ov = data?.overview, ai = data?.aiUsage
  const hint = data?.hint
  const hintMsg: Record<string, { title: string; body: string }> = {
    convex_not_deployed: { title: 'Convex needs a redeploy', body: 'The analytics functions aren\'t live on Convex yet. They deploy on the next production Vercel build (which runs convex deploy). If it persists, run npx convex deploy once.' },
    convex_admin_secret_mismatch: { title: 'Set ADMIN_SECRET in Convex', body: 'Login worked (Vercel has ADMIN_SECRET) but Convex rejected it. Add ADMIN_SECRET in dashboard.convex.dev → Settings → Environment Variables (Production) with the same value as Vercel, then refresh.' },
    server_secret_missing: { title: 'CONVEX_AUTH_SECRET not set', body: 'AI-usage figures need CONVEX_AUTH_SECRET in Vercel. Everything else still works.' },
  }
  const funnel = ov?.funnel
  const funnelMax = funnel ? Math.max(funnel.impressions, funnel.views, funnel.saves, funnel.flags, 1) : 1
  const zeroQueries = (data?.topSearches ?? []).filter(s => s.avgResults != null && s.avgResults < 1)
  const shownInsight: Insight | null = insight ?? data?.insight ?? null
  const feed = (data?.activity ?? []).filter(a => feedFilter === 'all' || a.kind === feedFilter)

  const panel: React.CSSProperties = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18, marginBottom: 14, boxShadow: C.shadow }
  const hStyle: React.CSSProperties = { color: C.ink2, fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 14 }
  const th: React.CSSProperties = { color: C.muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'left', padding: '6px 8px', fontWeight: 600 }
  const td: React.CSSProperties = { color: C.ink, fontSize: 13, padding: '9px 8px', borderTop: `1px solid ${C.hairline}`, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }

  const stat = (label: string, value: string, sub?: string) => (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 13, padding: '15px 17px', flex: '1 1 155px', minWidth: 155, boxShadow: C.shadow }}>
      <div style={{ color: C.ink2, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{label}</div>
      <div style={{ color: C.ink, fontSize: 27, fontWeight: 700, marginTop: 6, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div style={{ color: C.muted, fontSize: 12, marginTop: 6 }}>{sub}</div>}
    </div>
  )
  const prodList = (rows: ProdRow[], accent: string, emptyMsg: string) => (
    rows.length > 0 ? rows.map((p, i) => (
      <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '6px 0', borderTop: i > 0 ? `1px solid ${C.hairline}` : 'none' }}>
        <div style={{ width: 16, color: C.muted, fontSize: 12, flexShrink: 0 }}>{i + 1}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: C.ink, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title || '—'}</div>
          {p.vendor && <div style={{ color: C.muted, fontSize: 11 }}>{p.vendor}</div>}
        </div>
        <div style={{ color: accent, fontSize: 13, fontWeight: 600, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{num(p.count)}</div>
      </div>
    )) : <div style={{ color: C.muted, fontSize: 13, padding: '10px 0' }}>{emptyMsg}</div>
  )

  return (
    <div style={{ minHeight: '100svh', background: C.plane, padding: '22px 16px', fontFamily: font, color: C.ink }}>
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ fontSize: 21, fontWeight: 700, letterSpacing: '-0.01em' }}>Analytics</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden', boxShadow: C.shadow }}>
              {WINDOWS.map(w => (
                <button key={w.days} onClick={() => setWindow(w.days)} style={{ padding: '7px 12px', border: 'none', background: days === w.days ? C.ink : 'transparent', color: days === w.days ? '#fff' : C.ink2, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{w.label}</button>
              ))}
            </div>
            <button onClick={refresh} style={{ padding: '7px 11px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.card, color: C.ink2, fontSize: 13, cursor: 'pointer', boxShadow: C.shadow }}>{busy ? '…' : '↻'}</button>
            <button onClick={() => exportReport('md')} title="Download a formatted report to feed to an AI" style={{ padding: '7px 11px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.card, color: C.ink2, fontSize: 13, cursor: 'pointer', boxShadow: C.shadow }}>{exporting === 'md' ? '…' : '⬇ Markdown'}</button>
            <button onClick={() => exportReport('pdf')} title="Open a print-ready report → Save as PDF" style={{ padding: '7px 11px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.card, color: C.ink2, fontSize: 13, cursor: 'pointer', boxShadow: C.shadow }}>{exporting === 'pdf' ? '…' : '⬇ PDF'}</button>
            <button onClick={() => { sessionStorage.removeItem(STORAGE_KEY); setSecret(''); setView('login') }} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 13, cursor: 'pointer' }}>Sign out</button>
          </div>
        </div>

        {hint && hintMsg[hint] && (
          <div style={{ background: '#fff8e6', border: '1px solid #f0d68a', borderRadius: 12, padding: '13px 15px', marginBottom: 14 }}>
            <div style={{ color: '#8a6d1a', fontSize: 14, fontWeight: 650, marginBottom: 3 }}>⚠ {hintMsg[hint].title}</div>
            <div style={{ color: '#9a7d2a', fontSize: 13, lineHeight: 1.5 }}>{hintMsg[hint].body}</div>
          </div>
        )}
        {err && (
          <div style={{ background: '#fdecec', border: '1px solid #f0b8b8', borderRadius: 12, padding: '13px 15px', marginBottom: 14 }}>
            <div style={{ color: C.red, fontSize: 13, marginBottom: 8 }}>{err}</div>
            <button onClick={refresh} style={{ padding: '6px 12px', borderRadius: 7, border: `1px solid #f0b8b8`, background: 'transparent', color: C.red, fontSize: 13, cursor: 'pointer' }}>Retry</button>
          </div>
        )}

        {/* Stat cards */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
          {stat('Searches', ov ? num(ov.searches.total) : '—', ov ? `${num(ov.searches.signedIn)} signed-in · ${num(ov.searches.anonymous)} anon` : undefined)}
          {stat('Searchers', ov ? num(ov.searches.distinctSearchers) : '—', 'signed-in, distinct')}
          {stat('Users', ov ? num(ov.users.total) : '—', ov ? `${num(ov.users.new)} new · ${num(ov.users.active)} active` : undefined)}
          {stat('AI calls', ov ? num(ov.ai.requests) : '—', ai ? `~${ktok(ai.totalEstPromptTokens)} prompt tok` : undefined)}
        </div>

        {/* AI recommendations — the self-improving loop's brain */}
        <div style={{ ...panel, borderColor: shownInsight ? '#cfe0f5' : C.border }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: shownInsight ? 10 : 0 }}>
            <div style={{ ...hStyle, marginBottom: 0, color: C.blue }}>✦ AI recommendations</div>
            <button onClick={generateInsight} disabled={analyzing} style={{ padding: '7px 13px', borderRadius: 9, border: 'none', background: analyzing ? '#e5e5e3' : C.blue, color: analyzing ? C.muted : '#fff', fontSize: 13, fontWeight: 600, cursor: analyzing ? 'default' : 'pointer' }}>{analyzing ? 'Analysing…' : 'Generate now'}</button>
          </div>
          {shownInsight ? (
            <>
              <div style={{ color: C.muted, fontSize: 11, marginBottom: 4 }}>Generated {ago(shownInsight.createdAt)} ago{shownInsight.model ? ` · ${shownInsight.model}` : ''}{shownInsight.windowDays ? ` · ${shownInsight.windowDays}d window` : ''}</div>
              <MiniMarkdown text={shownInsight.content} />
            </>
          ) : (
            <div style={{ color: C.muted, fontSize: 13, marginTop: 4, lineHeight: 1.5 }}>
              {analyzing ? 'Reading your data and writing specific improvements… (~10s)' : 'No analysis yet. Click Generate and Fabrics will read this data and propose concrete improvements to search, vocabulary, and merchandising — the same pass also runs automatically every week.'}
            </div>
          )}
        </div>

        {/* Activity over time */}
        <div style={panel}>
          <div style={hStyle}>Activity over time</div>
          {data?.timeSeries ? <LineChart points={data.timeSeries.points} days={data.days} /> : <div style={{ color: C.muted, fontSize: 13 }}>—</div>}
        </div>

        {/* Funnel + breakdowns */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ ...panel, flex: '1 1 320px' }}>
            <div style={hStyle}>Engagement funnel</div>
            {funnel ? (
              <>
                <BarRow label="Shown" value={funnel.impressions} max={funnelMax} accent={C.muted} />
                <BarRow label="Opened" value={funnel.views} max={funnelMax} sub={ov?.rates.viewRate != null ? `· ${pct(ov.rates.viewRate)}` : ''} accent={C.blue} />
                <BarRow label="Saved" value={funnel.saves} max={funnelMax} sub={ov?.rates.saveRate != null ? `· ${pct(ov.rates.saveRate)}` : ''} accent={C.good} />
                <BarRow label="Flagged" value={funnel.flags} max={funnelMax} sub={ov?.rates.flagRate != null ? `· ${pct(ov.rates.flagRate)}` : ''} accent={C.red} />
                <div style={{ color: C.muted, fontSize: 11, marginTop: 8 }}>Rates are % of products shown — the exact behaviour the learning loop trains on.</div>
              </>
            ) : <div style={{ color: C.muted, fontSize: 13 }}>—</div>}
          </div>
          <div style={{ ...panel, flex: '1 1 260px' }}>
            <div style={hStyle}>Users by device</div>
            {ov && ov.byDevice.length > 0 ? ov.byDevice.map(d => <BarRow key={d.label} label={d.label} value={d.count} max={Math.max(...ov.byDevice.map(x => x.count), 1)} accent={C.blue} />) : <div style={{ color: C.muted, fontSize: 13 }}>No device data yet</div>}
            <div style={{ ...hStyle, marginTop: 16 }}>Users by country</div>
            {ov && ov.byCountry.length > 0 ? ov.byCountry.map(c => <BarRow key={c.label} label={c.label} value={c.count} max={Math.max(...ov.byCountry.map(x => x.count), 1)} accent={C.green} />) : <div style={{ color: C.muted, fontSize: 13 }}>No country data yet</div>}
          </div>
        </div>

        {/* Top opened / saved products */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ ...panel, flex: '1 1 300px' }}>
            <div style={hStyle}>Most opened products</div>
            {prodList(data?.topProducts?.opened ?? [], C.blue, 'No opens in this window yet')}
          </div>
          <div style={{ ...panel, flex: '1 1 300px' }}>
            <div style={hStyle}>Most saved products</div>
            {prodList(data?.topProducts?.saved ?? [], C.good, 'No saves in this window yet')}
          </div>
        </div>

        {/* Needs attention */}
        {zeroQueries.length > 0 && (
          <div style={{ ...panel, borderColor: '#f0b8b8' }}>
            <div style={{ ...hStyle, color: C.red }}>⚠ Searches returning nothing — fix these first</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {zeroQueries.slice(0, 30).map((s, i) => (
                <span key={i} style={{ background: '#fdf0f0', border: '1px solid #f2cccc', borderRadius: 8, padding: '5px 10px', fontSize: 13, color: '#a13030' }}>{s.query} <span style={{ color: C.red }}>×{s.count}</span></span>
              ))}
            </div>
          </div>
        )}

        {/* Top searches */}
        <div style={panel}>
          <div style={hStyle}>Top searches</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={th}>Query</th><th style={{ ...th, textAlign: 'right' }}>Count</th><th style={{ ...th, textAlign: 'right' }}>People</th><th style={{ ...th, textAlign: 'right' }}>Avg results</th><th style={{ ...th, textAlign: 'right' }}>Last</th>
              </tr></thead>
              <tbody>
                {(data?.topSearches ?? []).map((s, i) => (
                  <tr key={i}>
                    <td style={{ ...td, maxWidth: 280 }}>{s.query}{(s.avgResults != null && s.avgResults < 1) && <span style={{ color: C.red, fontSize: 11, marginLeft: 6 }}>no results</span>}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{num(s.count)}</td>
                    <td style={{ ...td, textAlign: 'right', color: C.ink2, fontVariantNumeric: 'tabular-nums' }}>{num(s.searchers)}</td>
                    <td style={{ ...td, textAlign: 'right', color: C.ink2, fontVariantNumeric: 'tabular-nums' }}>{s.avgResults ?? '—'}</td>
                    <td style={{ ...td, textAlign: 'right', color: C.muted }}>{ago(s.lastAt)}</td>
                  </tr>
                ))}
                {(!data?.topSearches || data.topSearches.length === 0) && !busy && <tr><td colSpan={5} style={{ ...td, color: C.muted, textAlign: 'center', padding: 18 }}>No searches in this window yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* AI usage */}
        {ai && (
          <div style={panel}>
            <div style={hStyle}>AI usage · {num(ai.totalRequests)} calls · ~{ktok(ai.totalEstPromptTokens)} prompt tokens</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {Object.entries(ai.byProvider).sort((a, b) => b[1].requests - a[1].requests).map(([prov, v]) => (
                <div key={prov} style={{ background: '#fafafa', border: `1px solid ${C.border}`, borderRadius: 9, padding: '8px 12px', fontSize: 13 }}>
                  <span style={{ color: C.ink, fontWeight: 600 }}>{prov}</span>
                  <span style={{ color: C.ink2, marginLeft: 8 }}>{num(v.requests)} calls</span>
                  <span style={{ color: C.muted, marginLeft: 8 }}>~{ktok(v.estPromptTokens)} tok</span>
                  {v.failures > 0 && <span style={{ color: C.red, marginLeft: 8 }}>{v.failures} fail</span>}
                </div>
              ))}
              {Object.keys(ai.byProvider).length === 0 && <div style={{ color: C.muted, fontSize: 13 }}>No AI calls in this window</div>}
            </div>
          </div>
        )}

        {/* Top users */}
        <div style={panel}>
          <div style={hStyle}>Most active shoppers</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={th}>Email</th><th style={{ ...th, textAlign: 'right' }}>Searches</th><th style={{ ...th, textAlign: 'right' }}>Saves</th><th style={{ ...th, textAlign: 'right' }}>Where</th><th style={{ ...th, textAlign: 'right' }}>Last seen</th>
              </tr></thead>
              <tbody>
                {(data?.topUsers ?? []).map((u, i) => (
                  <tr key={i}>
                    <td style={{ ...td, maxWidth: 240 }}>{u.email}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{num(u.searches)}</td>
                    <td style={{ ...td, textAlign: 'right', color: C.ink2, fontVariantNumeric: 'tabular-nums' }}>{num(u.saves)}</td>
                    <td style={{ ...td, textAlign: 'right', color: C.ink2 }}>{[u.country, u.deviceType].filter(Boolean).join(' · ') || '—'}</td>
                    <td style={{ ...td, textAlign: 'right', color: C.muted }}>{ago(u.lastSeenAt)}</td>
                  </tr>
                ))}
                {(!data?.topUsers || data.topUsers.length === 0) && !busy && <tr><td colSpan={5} style={{ ...td, color: C.muted, textAlign: 'center', padding: 18 }}>No signed-in activity in this window</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* Full activity feed — every action + exact text */}
        <div style={panel}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            <div style={{ ...hStyle, marginBottom: 0 }}>Activity — everything people did</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['all', 'search', 'open', 'save', 'flag'] as const).map(k => (
                <button key={k} onClick={() => setFeedFilter(k)} style={{ padding: '4px 10px', borderRadius: 7, border: `1px solid ${feedFilter === k ? C.ink : C.border}`, background: feedFilter === k ? C.ink : C.card, color: feedFilter === k ? '#fff' : C.ink2, fontSize: 12, fontWeight: 500, cursor: 'pointer', textTransform: 'capitalize' }}>{k === 'all' ? 'All' : KIND[k].label}</button>
              ))}
            </div>
          </div>
          <div>
            {feed.map((a, i) => {
              const kk = KIND[a.kind] ?? { label: a.kind, color: C.muted }
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '8px 0', borderTop: i > 0 ? `1px solid ${C.hairline}` : 'none' }}>
                  <span style={{ flexShrink: 0, width: 64, color: kk.color, fontSize: 11, fontWeight: 600 }}><span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: kk.color, marginRight: 6, verticalAlign: 'middle' }} />{kk.label}</span>
                  <div style={{ flex: 1, minWidth: 0, color: C.ink, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.kind === 'search' ? <span>“{a.text}”</span> : <span>{a.text || '—'}</span>}
                    {a.meta && <span style={{ color: C.muted, marginLeft: 8, fontSize: 12 }}>{a.meta}</span>}
                  </div>
                  <div style={{ color: C.ink2, fontSize: 12, flexShrink: 0, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.email ?? 'anonymous'}</div>
                  <div style={{ color: C.muted, fontSize: 12, flexShrink: 0, width: 40, textAlign: 'right' }}>{ago(a.at)}</div>
                </div>
              )
            })}
            {feed.length === 0 && !busy && <div style={{ color: C.muted, fontSize: 13, textAlign: 'center', padding: 18 }}>No activity recorded yet</div>}
          </div>
        </div>

        <div style={{ color: C.muted, fontSize: 11, textAlign: 'center', margin: '6px 0 24px' }}>
          Data lives in Convex. Token counts are estimates. Anonymous actions appear in totals but can’t be attributed to a person.
        </div>
      </div>
    </div>
  )
}
