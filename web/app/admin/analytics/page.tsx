'use client'

import { useState, useEffect, useCallback } from 'react'

// Shares the community-admin login token so one ADMIN_SECRET unlocks both pages.
const STORAGE_KEY = 'discern_admin_secret'

interface Overview {
  windowMs: number
  searches: { total: number; signedIn: number; anonymous: number; distinctSearchers: number; capped: boolean }
  ai: { requests: number; capped: boolean }
  users: { total: number; new: number; active: number; capped: boolean }
}
interface TopSearch { query: string; count: number; searchers: number; avgResults: number | null; zeroResults: number; lastAt: number }
interface TopUser { email: string; name: string | null; searches: number; saves: number; lastSeenAt: number | null; country: string | null; deviceType: string | null }
interface Recent { query: string; email: string | null; resultCount: number | null; at: number; country: string | null }
interface AiUsage { totalRequests: number; totalEstPromptTokens: number; totalEstCompletionTokensCap: number; byProvider: Record<string, { requests: number; failures: number }>; byPath: Record<string, number> }
interface Payload { ok: boolean; days: number; overview: Overview | null; topSearches: TopSearch[]; topUsers: TopUser[]; recent: Recent[]; aiUsage: AiUsage | null }

async function fetchT(url: string, init: RequestInit = {}, ms = 15000): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try { return await fetch(url, { ...init, signal: ctrl.signal }) }
  finally { clearTimeout(t) }
}

function ago(ts: number | null): string {
  if (!ts) return '—'
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000))
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24); if (d < 30) return `${d}d ago`
  return new Date(ts).toLocaleDateString()
}
function num(n: number): string { return n.toLocaleString() }
function ktok(n: number): string { return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n) }

const WINDOWS = [{ label: '24h', days: 1 }, { label: '7d', days: 7 }, { label: '30d', days: 30 }]

export default function AdminAnalyticsPage() {
  const [view, setView] = useState<'loading' | 'login' | 'admin'>('loading')
  const [secret, setSecret] = useState('')
  const [loginErr, setLoginErr] = useState('')
  const [working, setWorking] = useState(false)
  const [days, setDays] = useState(7)
  const [data, setData] = useState<Payload | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const checkAuth = useCallback(async (s: string): Promise<boolean> => {
    try { const r = await fetchT('/api/admin/analytics?check=1', { headers: { 'x-admin-secret': s } }); return r.ok }
    catch { return false }
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
    checkAuth(stored).then(ok => {
      if (ok) { setView('admin'); load(stored, days) }
      else { sessionStorage.removeItem(STORAGE_KEY); setView('login') }
    })
  }, [checkAuth, load]) // eslint-disable-line react-hooks/exhaustive-deps

  async function login() {
    const s = secret.trim()
    if (!s || working) return
    setWorking(true); setLoginErr('')
    try {
      const r = await fetchT('/api/admin/analytics?check=1', { headers: { 'x-admin-secret': s } })
      if (r.ok) { sessionStorage.setItem(STORAGE_KEY, s); setView('admin'); load(s, days) }
      else if (r.status === 401) {
        const d = await r.json().catch(() => ({}))
        setLoginErr(d.reason === 'not_configured' ? 'ADMIN_SECRET not set in Vercel env' : 'Wrong password')
      } else setLoginErr(`Error ${r.status}`)
    } catch (e: any) {
      setLoginErr(e?.name === 'AbortError' ? 'Timed out — server not responding' : 'Network error: ' + (e?.message ?? 'unknown'))
    }
    setWorking(false)
  }

  function setWindow(d: number) {
    setDays(d)
    const s = sessionStorage.getItem(STORAGE_KEY); if (s) load(s, d)
  }

  const st: Record<string, any> = {
    page: { minHeight: '100svh', background: '#0a0a0a', padding: '24px 16px', fontFamily: 'system-ui', color: '#fff' },
    center: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
    card: { background: '#1a1a1a', borderRadius: '16px', padding: '32px 24px', width: '100%', maxWidth: '360px' },
    input: { width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #333', background: '#111', color: '#fff', fontSize: '15px', boxSizing: 'border-box', outline: 'none', display: 'block' },
    btn: (active: boolean) => ({ width: '100%', padding: '13px', borderRadius: '10px', border: 'none', background: active ? '#fff' : '#333', color: active ? '#000' : '#888', fontSize: '15px', fontWeight: 600, cursor: active ? 'pointer' : 'default' }),
    panel: { background: '#141414', border: '1px solid #222', borderRadius: '14px', padding: '18px 18px 6px', marginBottom: '18px' },
    h: { color: '#aaa', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '14px' },
    th: { color: '#666', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left', padding: '6px 8px', fontWeight: 600 },
    td: { color: '#ddd', fontSize: '13px', padding: '8px 8px', borderTop: '1px solid #1e1e1e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  }

  if (view === 'loading') return <div style={{ ...st.page, ...st.center }}><div style={{ color: '#555' }}>Loading…</div></div>

  if (view === 'login') {
    return (
      <div style={{ ...st.page, ...st.center }}>
        <div style={st.card}>
          <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '4px' }}>Discern Analytics</div>
          <div style={{ color: '#888', fontSize: '13px', marginBottom: '24px' }}>Usage dashboard</div>
          <input type="password" placeholder="Admin secret" value={secret} autoFocus
            onChange={e => setSecret(e.target.value)} onKeyDown={e => e.key === 'Enter' && login()} style={st.input} />
          {loginErr && <div style={{ color: '#f66', fontSize: '13px', marginTop: '10px' }}>{loginErr}</div>}
          <button onClick={login} disabled={working} style={{ ...st.btn(!working && !!secret.trim()), marginTop: '16px' }}>
            {working ? 'Checking…' : 'Enter'}
          </button>
        </div>
      </div>
    )
  }

  const ov = data?.overview
  const stat = (label: string, value: string, sub?: string) => (
    <div style={{ background: '#141414', border: '1px solid #222', borderRadius: '12px', padding: '16px 18px', flex: '1 1 140px', minWidth: 140 }}>
      <div style={{ color: '#777', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ color: '#fff', fontSize: '26px', fontWeight: 700, marginTop: '6px', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ color: '#888', fontSize: '12px', marginTop: '6px' }}>{sub}</div>}
    </div>
  )

  return (
    <div style={st.page}>
      <div style={{ maxWidth: '920px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ fontSize: '20px', fontWeight: 700 }}>Discern · Analytics</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', background: '#161616', border: '1px solid #262626', borderRadius: 9, overflow: 'hidden' }}>
              {WINDOWS.map(w => (
                <button key={w.days} onClick={() => setWindow(w.days)}
                  style={{ padding: '7px 13px', border: 'none', background: days === w.days ? '#fff' : 'transparent', color: days === w.days ? '#000' : '#999', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {w.label}
                </button>
              ))}
            </div>
            <button onClick={() => { const s = sessionStorage.getItem(STORAGE_KEY); if (s) load(s, days) }}
              style={{ padding: '7px 12px', borderRadius: 9, border: '1px solid #262626', background: 'transparent', color: '#999', fontSize: 13, cursor: 'pointer' }}>
              {busy ? '…' : '↻'}
            </button>
            <button onClick={() => { sessionStorage.removeItem(STORAGE_KEY); setSecret(''); setView('login') }}
              style={{ background: 'none', border: 'none', color: '#555', fontSize: 13, cursor: 'pointer' }}>Sign out</button>
          </div>
        </div>

        {err && (
          <div style={{ background: '#2a1212', border: '1px solid #5a2020', borderRadius: 12, padding: '14px 16px', marginBottom: 18 }}>
            <div style={{ color: '#f88', fontSize: 13, marginBottom: 8 }}>{err}</div>
            <button onClick={() => { const s = sessionStorage.getItem(STORAGE_KEY); if (s) load(s, days) }}
              style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid #5a2020', background: 'transparent', color: '#f88', fontSize: 13, cursor: 'pointer' }}>Retry</button>
          </div>
        )}

        {/* Overview cards */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          {stat('Searches', ov ? num(ov.searches.total) : '—', ov ? `${num(ov.searches.signedIn)} signed-in · ${num(ov.searches.anonymous)} anon` : undefined)}
          {stat('Searchers', ov ? num(ov.searches.distinctSearchers) : '—', 'signed-in, distinct')}
          {stat('Users', ov ? num(ov.users.total) : '—', ov ? `${num(ov.users.new)} new · ${num(ov.users.active)} active` : undefined)}
          {stat('AI calls', ov ? num(ov.ai.requests) : '—', data?.aiUsage ? `~${ktok(data.aiUsage.totalEstPromptTokens)} prompt tok` : undefined)}
        </div>

        {/* Top searches */}
        <div style={st.panel}>
          <div style={st.h}>Top searches</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={st.th}>Query</th><th style={{ ...st.th, textAlign: 'right' }}>Count</th>
                <th style={{ ...st.th, textAlign: 'right' }}>People</th><th style={{ ...st.th, textAlign: 'right' }}>Avg results</th>
                <th style={{ ...st.th, textAlign: 'right' }}>Last</th>
              </tr></thead>
              <tbody>
                {(data?.topSearches ?? []).map((s, i) => (
                  <tr key={i}>
                    <td style={{ ...st.td, maxWidth: 260, color: s.zeroResults > 0 && s.avgResults === 0 ? '#f0a' : '#eee' }}>
                      {s.query}{s.avgResults === 0 && <span style={{ color: '#c05', fontSize: 11, marginLeft: 6 }}>no results</span>}
                    </td>
                    <td style={{ ...st.td, textAlign: 'right', fontWeight: 600 }}>{num(s.count)}</td>
                    <td style={{ ...st.td, textAlign: 'right', color: '#999' }}>{num(s.searchers)}</td>
                    <td style={{ ...st.td, textAlign: 'right', color: '#999' }}>{s.avgResults ?? '—'}</td>
                    <td style={{ ...st.td, textAlign: 'right', color: '#777' }}>{ago(s.lastAt)}</td>
                  </tr>
                ))}
                {(!data?.topSearches || data.topSearches.length === 0) && !busy && (
                  <tr><td colSpan={5} style={{ ...st.td, color: '#555', textAlign: 'center', padding: '18px' }}>No searches in this window yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top users */}
        <div style={st.panel}>
          <div style={st.h}>Most active shoppers</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={st.th}>Email</th><th style={{ ...st.th, textAlign: 'right' }}>Searches</th>
                <th style={{ ...st.th, textAlign: 'right' }}>Saves</th><th style={{ ...st.th, textAlign: 'right' }}>Where</th>
                <th style={{ ...st.th, textAlign: 'right' }}>Last seen</th>
              </tr></thead>
              <tbody>
                {(data?.topUsers ?? []).map((u, i) => (
                  <tr key={i}>
                    <td style={{ ...st.td, maxWidth: 240 }}>{u.email}</td>
                    <td style={{ ...st.td, textAlign: 'right', fontWeight: 600 }}>{num(u.searches)}</td>
                    <td style={{ ...st.td, textAlign: 'right', color: '#999' }}>{num(u.saves)}</td>
                    <td style={{ ...st.td, textAlign: 'right', color: '#999' }}>{[u.country, u.deviceType].filter(Boolean).join(' · ') || '—'}</td>
                    <td style={{ ...st.td, textAlign: 'right', color: '#777' }}>{ago(u.lastSeenAt)}</td>
                  </tr>
                ))}
                {(!data?.topUsers || data.topUsers.length === 0) && !busy && (
                  <tr><td colSpan={5} style={{ ...st.td, color: '#555', textAlign: 'center', padding: '18px' }}>No signed-in activity in this window</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* AI usage by provider */}
        {data?.aiUsage && (
          <div style={st.panel}>
            <div style={st.h}>AI usage · {num(data.aiUsage.totalRequests)} calls · ~{ktok(data.aiUsage.totalEstPromptTokens)} prompt tokens</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingBottom: 12 }}>
              {Object.entries(data.aiUsage.byProvider).sort((a, b) => b[1].requests - a[1].requests).map(([prov, v]) => (
                <div key={prov} style={{ background: '#161616', border: '1px solid #242424', borderRadius: 9, padding: '8px 12px', fontSize: 13 }}>
                  <span style={{ color: '#ddd', fontWeight: 600 }}>{prov}</span>
                  <span style={{ color: '#888', marginLeft: 8 }}>{num(v.requests)} calls</span>
                  {v.failures > 0 && <span style={{ color: '#f66', marginLeft: 8 }}>{v.failures} fail</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent searches feed */}
        <div style={st.panel}>
          <div style={st.h}>Live activity</div>
          <div style={{ paddingBottom: 12 }}>
            {(data?.recent ?? []).map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '7px 0', borderTop: i > 0 ? '1px solid #1c1c1c' : 'none' }}>
                <div style={{ flex: 1, minWidth: 0, color: '#eee', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>“{r.query}”</div>
                <div style={{ color: '#777', fontSize: 12, flexShrink: 0 }}>{r.resultCount != null ? `${r.resultCount} results` : ''}</div>
                <div style={{ color: '#666', fontSize: 12, flexShrink: 0, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.email ?? 'anonymous'}</div>
                <div style={{ color: '#555', fontSize: 12, flexShrink: 0 }}>{ago(r.at)}</div>
              </div>
            ))}
            {(!data?.recent || data.recent.length === 0) && !busy && (
              <div style={{ color: '#555', fontSize: 13, textAlign: 'center', padding: '18px' }}>No activity recorded yet</div>
            )}
          </div>
        </div>

        <div style={{ color: '#444', fontSize: 11, textAlign: 'center', margin: '8px 0 24px' }}>
          Data lives in Convex. Token counts are estimates. Anonymous searches appear in totals but can’t be attributed to a person.
        </div>
      </div>
    </div>
  )
}
