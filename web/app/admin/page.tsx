'use client'

/**
 * /admin — one-tap corpus control panel.
 *
 * Trigger the v2 backend pipeline from any device (built for iPad): set up the
 * database schema, sync the product corpus, and watch its health. The protected
 * endpoints (/api/v2/setup, /api/v2/sync) require the cron secret — you type it
 * once here; it lives only in this page's memory, never in the shipped bundle.
 */

import { useCallback, useEffect, useState } from 'react'

type Json = Record<string, unknown>

type StatusShape = {
  ready?: boolean
  products?: { total?: number; in_stock?: number; with_embedding?: number }
  stores?: { total?: number; active?: number; crawled?: number }
  lastSync?: {
    started_at?: string
    finished_at?: string
    stores_succeeded?: number
    products_upserted?: number
    error?: string | null
  } | null
  message?: string
  error?: string
}

const card: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e8e6e1',
  borderRadius: 16,
  padding: 20,
  marginBottom: 16,
}

const btn = (color: string, disabled?: boolean): React.CSSProperties => ({
  display: 'block',
  width: '100%',
  padding: '15px 18px',
  fontSize: 16,
  fontWeight: 600,
  color: '#fff',
  background: disabled ? '#bcb8b0' : color,
  border: 'none',
  borderRadius: 12,
  cursor: disabled ? 'default' : 'pointer',
  marginTop: 12,
  WebkitTapHighlightColor: 'transparent',
})

export default function AdminPage() {
  const [secret, setSecret] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [status, setStatus] = useState<StatusShape | null>(null)
  const [log, setLog] = useState<{ label: string; data: Json; ok: boolean }[]>([])

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/v2/status', { cache: 'no-store' })
      setStatus(await res.json())
    } catch (err) {
      setStatus({ error: (err as Error).message })
    }
  }, [])

  useEffect(() => { refreshStatus() }, [refreshStatus])

  // Remember the secret locally so a page reload during a long sync doesn't lose it.
  useEffect(() => {
    const saved = sessionStorage.getItem('from:admin-secret')
    if (saved) setSecret(saved)
  }, [])
  useEffect(() => {
    if (secret) sessionStorage.setItem('from:admin-secret', secret)
  }, [secret])

  async function call(label: string, path: string, body?: Json) {
    if (!secret) { alert('Enter the admin secret first.'); return }
    setBusy(label)
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'x-cron-secret': secret, 'content-type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      })
      const data = (await res.json()) as Json
      setLog(prev => [{ label, data, ok: res.ok }, ...prev].slice(0, 8))
      refreshStatus()
    } catch (err) {
      setLog(prev => [{ label, data: { error: (err as Error).message }, ok: false }, ...prev].slice(0, 8))
    } finally {
      setBusy(null)
    }
  }

  const products = Number(status?.products?.total ?? 0)
  const stores = Number(status?.stores?.crawled ?? 0)

  return (
    <main style={{
      maxWidth: 560, margin: '0 auto', padding: '28px 18px 80px',
      fontFamily: 'system-ui, -apple-system, sans-serif', color: '#1a1a1a',
      background: '#faf9f7', minHeight: '100vh',
    }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 4px' }}>FROM · Corpus Admin</h1>
      <p style={{ color: '#79756d', fontSize: 14, margin: '0 0 22px' }}>
        Set up and populate the product backend. Run the steps in order.
      </p>

      {/* Live status */}
      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#79756d', marginBottom: 10 }}>CORPUS STATUS</div>
        <div style={{ display: 'flex', gap: 22 }}>
          <Stat n={products} label="products" />
          <Stat n={stores} label="stores crawled" />
          <Stat n={Number(status?.products?.with_embedding ?? 0)} label="embedded" />
        </div>
        <div style={{ marginTop: 12, fontSize: 13, color: products > 0 ? '#1f8a4c' : '#b06a00' }}>
          {products > 0
            ? '● Live — search is serving from the corpus'
            : status?.message
              ? `○ ${status.message}`
              : '○ Empty — search is using live store fan-out'}
        </div>
        {status?.lastSync?.started_at && (
          <div style={{ marginTop: 8, fontSize: 12, color: '#9a968e' }}>
            Last sync: {new Date(status.lastSync.started_at).toLocaleString()} ·
            {' '}{status.lastSync.products_upserted ?? 0} upserted
            {status.lastSync.error ? ` · error: ${status.lastSync.error}` : ''}
          </div>
        )}
        <button style={{ ...btn('#3a3733'), marginTop: 14, padding: '11px 18px', fontSize: 14 }} onClick={refreshStatus}>
          Refresh status
        </button>
      </div>

      {/* Secret */}
      <div style={card}>
        <label style={{ fontSize: 13, fontWeight: 600, color: '#79756d', display: 'block', marginBottom: 8 }}>
          ADMIN SECRET
        </label>
        <input
          type="password"
          value={secret}
          onChange={e => setSecret(e.target.value)}
          placeholder="cron secret"
          autoComplete="off"
          style={{
            width: '100%', padding: '13px 14px', fontSize: 16, borderRadius: 10,
            border: '1px solid #ddd9d2', outline: 'none', boxSizing: 'border-box',
          }}
        />
        <p style={{ fontSize: 12, color: '#9a968e', margin: '8px 0 0' }}>
          The value of <code>CRON_SECRET</code> in your Vercel env.
        </p>
      </div>

      {/* Actions */}
      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#79756d', marginBottom: 4 }}>STEPS</div>

        <button
          style={btn('#2563eb', busy !== null)}
          disabled={busy !== null}
          onClick={() => call('1 · Set up database', '/api/v2/setup')}
        >
          {busy === '1 · Set up database' ? 'Setting up…' : '1 · Set up database schema'}
        </button>

        <button
          style={btn('#7c3aed', busy !== null)}
          disabled={busy !== null}
          onClick={() => call('2 · Sync products', '/api/v2/sync')}
        >
          {busy === '2 · Sync products' ? 'Crawling stores… (can take a few minutes)' : '2 · Sync products from stores'}
        </button>

        <p style={{ fontSize: 12, color: '#9a968e', margin: '12px 0 0' }}>
          Step 2 crawls ~40 stores live and can take 1–4 minutes. If it times out,
          just tap it again — it’s safe to re-run (idempotent upsert).
        </p>
      </div>

      {/* Log */}
      {log.length > 0 && (
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#79756d', marginBottom: 10 }}>RESULTS</div>
          {log.map((entry, i) => (
            <div key={i} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: entry.ok ? '#1f8a4c' : '#c0392b' }}>
                {entry.ok ? '✓' : '✗'} {entry.label}
              </div>
              <pre style={{
                margin: '6px 0 0', padding: 12, background: '#f4f2ee', borderRadius: 8,
                fontSize: 11.5, lineHeight: 1.5, overflowX: 'auto', whiteSpace: 'pre-wrap',
                wordBreak: 'break-word', color: '#3a3733',
              }}>
                {JSON.stringify(entry.data, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div>
      <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1 }}>{n.toLocaleString()}</div>
      <div style={{ fontSize: 12, color: '#9a968e', marginTop: 4 }}>{label}</div>
    </div>
  )
}
