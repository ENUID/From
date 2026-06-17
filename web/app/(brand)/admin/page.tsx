'use client'

/**
 * /admin — operator console (corpus + brand review), in FROM's editorial language.
 *
 * Set up the database, sync the crawled corpus, and approve/reject brands that
 * have connected. Protected endpoints take the cron secret — you type it once
 * here; it lives only in this page's memory, never in the shipped bundle.
 */

import { useCallback, useEffect, useState } from 'react'
import {
  INK, INK2, INK3, PAPER, BRD, BRD2, FILL, GOOD, WARN, BAD, SANS, SERIF,
  card, sectionLabel, pill,
} from '@/features/brands/theme'

type Json = Record<string, unknown>
type StatusShape = {
  ready?: boolean
  products?: { total?: number; in_stock?: number; with_embedding?: number }
  stores?: { total?: number; active?: number; crawled?: number }
  lastSync?: { started_at?: string; products_upserted?: number; error?: string | null } | null
  message?: string; error?: string
}

const shell: React.CSSProperties = { maxWidth: 600, margin: '0 auto', padding: '0 20px 90px' }
const fullBtn = (disabled?: boolean): React.CSSProperties => ({ ...pill(disabled), display: 'block', width: '100%', textAlign: 'center', marginTop: 12 })

export default function AdminPage() {
  const [secret, setSecret] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [status, setStatus] = useState<StatusShape | null>(null)
  const [log, setLog] = useState<{ label: string; data: Json; ok: boolean }[]>([])

  const refreshStatus = useCallback(async () => {
    try { const r = await fetch('/api/v2/status', { cache: 'no-store' }); setStatus(await r.json()) }
    catch (err) { setStatus({ error: (err as Error).message }) }
  }, [])
  useEffect(() => { refreshStatus() }, [refreshStatus])

  useEffect(() => { const s = sessionStorage.getItem('from:admin-secret'); if (s) setSecret(s) }, [])
  useEffect(() => { if (secret) sessionStorage.setItem('from:admin-secret', secret) }, [secret])

  async function call(label: string, path: string, body?: Json) {
    if (!secret) { alert('Enter the admin secret first.'); return }
    setBusy(label)
    try {
      const res = await fetch(path, { method: 'POST', headers: { 'x-cron-secret': secret, 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) })
      const data = (await res.json()) as Json
      setLog(prev => [{ label, data, ok: res.ok }, ...prev].slice(0, 8)); refreshStatus()
    } catch (err) {
      setLog(prev => [{ label, data: { error: (err as Error).message }, ok: false }, ...prev].slice(0, 8))
    } finally { setBusy(null) }
  }

  const products = Number(status?.products?.total ?? 0)
  const stores = Number(status?.stores?.crawled ?? 0)

  return (
    <main style={{ fontFamily: SANS, color: INK, background: PAPER, minHeight: '100vh' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=DM+Sans:wght@300;400;500;600&display=swap');`}</style>

      <header style={{ ...shell, paddingTop: 30, paddingBottom: 16, textAlign: 'center' }}>
        <div style={{ fontFamily: SERIF, fontSize: 30, fontWeight: 500, letterSpacing: '.04em', color: INK }}>FROM</div>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.28em', textTransform: 'uppercase', color: INK3, marginTop: 4 }}>operator</div>
      </header>

      <div style={shell}>
        {/* Status */}
        <section style={card}>
          <div style={sectionLabel}>Corpus status</div>
          <div style={{ display: 'flex', gap: 30 }}>
            <Stat n={products} label="products" />
            <Stat n={stores} label="stores crawled" />
            <Stat n={Number(status?.products?.with_embedding ?? 0)} label="embedded" />
          </div>
          <div style={{ marginTop: 14, fontSize: 13, color: products > 0 ? GOOD : WARN }}>
            {products > 0 ? '● Live — search is serving from the corpus'
              : status?.message ? `○ ${status.message}`
              : '○ Empty — search is using live store fan-out'}
          </div>
          {status?.lastSync?.started_at && (
            <div style={{ marginTop: 8, fontSize: 12, color: INK3 }}>
              Last sync {new Date(status.lastSync.started_at).toLocaleString()} · {status.lastSync.products_upserted ?? 0} upserted
            </div>
          )}
          <button style={{ ...fullBtn(), marginTop: 16, background: 'transparent', color: INK, border: `1px solid ${BRD2}` }} onClick={refreshStatus}>Refresh status</button>
        </section>

        {/* Secret */}
        <section style={card}>
          <div style={sectionLabel}>Admin secret</div>
          <input
            type="password" value={secret} onChange={e => setSecret(e.target.value)} placeholder="cron secret" autoComplete="off"
            style={{ width: '100%', padding: '13px 15px', fontSize: 15, fontFamily: SANS, borderRadius: 12, border: `1px solid ${BRD2}`, background: FILL, color: INK, outline: 'none', boxSizing: 'border-box' }}
          />
          <p style={{ fontSize: 12, color: INK3, margin: '10px 0 0' }}>The value of <code>CRON_SECRET</code> in your Vercel env.</p>
        </section>

        {/* Steps */}
        <section style={card}>
          <div style={sectionLabel}>Steps</div>
          <button style={fullBtn(busy !== null)} disabled={busy !== null} onClick={() => call('1 · Set up database', '/api/v2/setup')}>
            {busy === '1 · Set up database' ? 'Setting up…' : '1 · Set up database schema'}
          </button>
          <button style={fullBtn(busy !== null)} disabled={busy !== null} onClick={() => call('2 · Sync products', '/api/v2/sync')}>
            {busy === '2 · Sync products' ? 'Crawling stores…' : '2 · Sync products from stores'}
          </button>
          <p style={{ fontSize: 12, color: INK3, margin: '14px 0 0', lineHeight: 1.55 }}>
            Step 2 crawls the curated stores and can take 1–4 minutes. Safe to re-run — it’s an idempotent upsert.
          </p>
        </section>

        {secret && <BrandReview secret={secret} />}

        {log.length > 0 && (
          <section style={card}>
            <div style={sectionLabel}>Results</div>
            {log.map((e, i) => (
              <div key={i} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: e.ok ? GOOD : BAD }}>{e.ok ? '✓' : '✗'} {e.label}</div>
                <pre style={{ margin: '6px 0 0', padding: 12, background: FILL, borderRadius: 10, fontSize: 11.5, lineHeight: 1.5, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: INK2, fontFamily: 'ui-monospace, monospace' }}>
                  {JSON.stringify(e.data, null, 2)}
                </pre>
              </div>
            ))}
          </section>
        )}
      </div>
    </main>
  )
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div>
      <div style={{ fontFamily: SERIF, fontSize: 32, fontWeight: 500, lineHeight: 1, color: INK }}>{n.toLocaleString()}</div>
      <div style={{ fontSize: 11.5, color: INK3, marginTop: 6 }}>{label}</div>
    </div>
  )
}

type BrandRow = {
  store_domain: string; display_name?: string; status?: string; product_count?: number
  tagline?: string; submitted_at?: string
}

function BrandReview({ secret }: { secret: string }) {
  const [data, setData] = useState<{ pending?: BrandRow[]; approved?: BrandRow[]; error?: string } | null>(null)
  const [acting, setActing] = useState<string | null>(null)

  const load = useCallback(async () => {
    try { const r = await fetch('/api/admin/brands', { headers: { 'x-cron-secret': secret }, cache: 'no-store' }); setData(await r.json()) }
    catch (err) { setData({ error: (err as Error).message }) }
  }, [secret])
  useEffect(() => { load() }, [load])

  async function review(domain: string, action: 'approve' | 'reject') {
    let reason: string | undefined
    if (action === 'reject') reason = prompt(`Reject ${domain}? Optional reason:`) ?? undefined
    setActing(domain)
    try {
      await fetch('/api/admin/brands', { method: 'POST', headers: { 'x-cron-secret': secret, 'content-type': 'application/json' }, body: JSON.stringify({ domain, action, reason }) })
      await load()
    } finally { setActing(null) }
  }

  const pending = data?.pending ?? []
  const approved = data?.approved ?? []

  return (
    <section style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={sectionLabel as React.CSSProperties}>Brand review</div>
        <button onClick={load} style={{ fontFamily: SANS, fontSize: 12.5, color: INK3, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>refresh</button>
      </div>

      {data?.error && <div style={{ color: BAD, fontSize: 13 }}>{data.error}</div>}
      {pending.length === 0 && !data?.error && <div style={{ fontSize: 13, color: INK3 }}>No brands awaiting review.</div>}

      {pending.map(b => (
        <div key={b.store_domain} style={{ border: `1px solid ${BRD}`, borderRadius: 14, padding: 16, marginBottom: 10 }}>
          <div style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 500, color: INK }}>{b.display_name || b.store_domain}</div>
          <div style={{ fontSize: 12.5, color: INK3, marginTop: 3 }}>
            {b.store_domain} · {b.product_count ?? 0} products{b.submitted_at ? ` · submitted ${new Date(b.submitted_at).toLocaleDateString()}` : ''}
          </div>
          {b.tagline && <div style={{ fontSize: 13.5, color: INK2, marginTop: 8 }}>{b.tagline}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button disabled={acting === b.store_domain} onClick={() => review(b.store_domain, 'approve')}
              style={{ flex: 1, padding: '11px', fontFamily: SANS, fontSize: 12, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: '#fff', background: acting === b.store_domain ? '#9bbfa8' : GOOD, border: 'none', borderRadius: 30, cursor: 'pointer' }}>
              {acting === b.store_domain ? '…' : 'Approve · go live'}
            </button>
            <button disabled={acting === b.store_domain} onClick={() => review(b.store_domain, 'reject')}
              style={{ padding: '11px 20px', fontFamily: SANS, fontSize: 12, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: BAD, background: 'transparent', border: `1px solid rgba(154,48,48,.3)`, borderRadius: 30, cursor: 'pointer' }}>
              Reject
            </button>
          </div>
        </div>
      ))}

      {approved.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: INK3, marginBottom: 8 }}>Live brands ({approved.length})</div>
          {approved.map(b => (
            <div key={b.store_domain} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, padding: '8px 0', borderBottom: `1px solid ${BRD}` }}>
              <span>{b.display_name || b.store_domain}</span>
              <span style={{ color: INK3 }}>{b.product_count ?? 0} products</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
