'use client'

/**
 * /brands — the merchant side of FROM.
 *
 * Not connected → enter Shopify domain, connect via OAuth.
 * Connected → catalog status + re-sync, AI description writer, demand insights.
 */

import { useCallback, useEffect, useState } from 'react'

type Brand = {
  store_domain: string
  display_name?: string
  plan?: string
  status?: string
  product_count?: number
  last_synced_at?: string
  sync_error?: string | null
  tagline?: string
  bio?: string
  logo_url?: string
  hero_url?: string
  instagram?: string
  website?: string
  rejection_reason?: string
}
type Me =
  | { connected: false }
  | { connected: true; brand?: Brand; live?: { total?: number; in_stock?: number }; store_domain?: string; error?: string }

const wrap: React.CSSProperties = {
  maxWidth: 720, margin: '0 auto', padding: '28px 18px 90px',
  fontFamily: 'system-ui, -apple-system, sans-serif', color: '#1a1a1a',
  background: '#faf9f7', minHeight: '100vh',
}
const card: React.CSSProperties = {
  background: '#fff', border: '1px solid #e8e6e1', borderRadius: 16, padding: 22, marginBottom: 16,
}
const label: React.CSSProperties = { fontSize: 12, fontWeight: 700, letterSpacing: 0.4, color: '#79756d', marginBottom: 10 }
const primaryBtn = (disabled?: boolean): React.CSSProperties => ({
  padding: '13px 20px', fontSize: 15, fontWeight: 600, color: '#fff',
  background: disabled ? '#bcb8b0' : '#111', border: 'none', borderRadius: 11,
  cursor: disabled ? 'default' : 'pointer', WebkitTapHighlightColor: 'transparent',
})
const input: React.CSSProperties = {
  width: '100%', padding: '13px 14px', fontSize: 16, borderRadius: 10,
  border: '1px solid #ddd9d2', outline: 'none', boxSizing: 'border-box',
}

export default function BrandsPage() {
  const [me, setMe] = useState<Me | null>(null)
  const [shop, setShop] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [banner, setBanner] = useState<string | null>(null)

  const loadMe = useCallback(async () => {
    try {
      const res = await fetch('/api/brands/me', { cache: 'no-store' })
      setMe(await res.json())
    } catch { setMe({ connected: false }) }
  }, [])

  useEffect(() => { loadMe() }, [loadMe])

  // Surface the OAuth callback result from the URL.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    if (p.get('connected')) setBanner(`Store connected — ${p.get('synced') ?? 0} products synced into FROM.`)
    else if (p.get('error')) setBanner(`Connection failed: ${p.get('error')}`)
    if (p.has('connected') || p.has('error')) window.history.replaceState({}, '', '/brands')
  }, [])

  function connect() {
    const s = shop.trim()
    if (!s) return
    window.location.href = `/api/brands/connect?shop=${encodeURIComponent(s)}`
  }

  async function resync() {
    setBusy('sync')
    try {
      const res = await fetch('/api/brands/sync', { method: 'POST' })
      const data = await res.json()
      setBanner(res.ok ? `Synced ${data.upserted ?? 0} products.` : `Sync failed: ${data.error}`)
      loadMe()
    } finally { setBusy(null) }
  }

  async function disconnect() {
    if (!confirm('Disconnect your store? Your products stay live but stop refreshing.')) return
    setBusy('disconnect')
    try { await fetch('/api/brands/disconnect', { method: 'POST' }); loadMe(); setBanner('Disconnected.') }
    finally { setBusy(null) }
  }

  const connected = me?.connected === true

  return (
    <main style={wrap}>
      <h1 style={{ fontSize: 26, fontWeight: 700, margin: '0 0 4px' }}>FROM for Brands</h1>
      <p style={{ color: '#79756d', fontSize: 14, margin: '0 0 22px' }}>
        Connect your store once. Your catalog goes live to every FROM shopper, and you get AI tools + real demand data back.
      </p>

      {banner && (
        <div style={{ ...card, background: '#f0f7f1', borderColor: '#cfe6d3', color: '#1f6b3a', fontSize: 14 }}>
          {banner}
        </div>
      )}

      {!connected && <Pitch />}

      {!connected ? (
        <div style={card}>
          <div style={label}>CONNECT YOUR SHOPIFY STORE</div>
          <input
            style={input}
            placeholder="your-store.myshopify.com"
            value={shop}
            onChange={e => setShop(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && connect()}
            autoCapitalize="none" autoCorrect="off"
          />
          <button style={{ ...primaryBtn(), marginTop: 14 }} onClick={connect}>Connect store →</button>
          <p style={{ fontSize: 12.5, color: '#9a968e', margin: '14px 0 0', lineHeight: 1.5 }}>
            We request read-only access to your products. You approve on Shopify; nothing is changed in your store.
            Checkout still happens on your own site.
          </p>
        </div>
      ) : (
        <Dashboard
          me={me as Extract<Me, { connected: true }>}
          busy={busy} onResync={resync} onDisconnect={disconnect} onReload={loadMe}
        />
      )}
    </main>
  )
}

function Dashboard({ me, busy, onResync, onDisconnect, onReload }: {
  me: Extract<Me, { connected: true }>; busy: string | null
  onResync: () => void; onDisconnect: () => void; onReload: () => void
}) {
  const status = me.brand?.status ?? 'pending'

  if (status === 'rejected') {
    return (
      <div style={{ ...card, background: '#fcf3f2', borderColor: '#eccfcf' }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Not approved yet</div>
        <p style={{ fontSize: 14, color: '#7a4a4a', margin: 0, lineHeight: 1.55 }}>
          Your store wasn’t approved for FROM at this time.
          {me.brand?.rejection_reason ? ` Reason: ${me.brand.rejection_reason}.` : ''}
          {' '}Reach out if you think this was a mistake.
        </p>
        <button style={{ ...primaryBtn(), marginTop: 16, background: '#fff', color: '#9a3030', border: '1px solid #e3cfcf' }} onClick={onDisconnect}>
          Disconnect
        </button>
      </div>
    )
  }

  return (
    <>
      {status === 'pending' && (
        <div style={{ ...card, background: '#fff8ec', borderColor: '#f0e2c4' }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>✦ Under review</div>
          <p style={{ fontSize: 14, color: '#7a6a45', margin: 0, lineHeight: 1.55 }}>
            Thanks for connecting — we’ve pulled your catalog and your store is in the review queue.
            FROM is curated, so every brand is checked by a human first. You’ll go live once approved.
            Meanwhile, polish your profile below so it’s ready.
          </p>
        </div>
      )}

      <Connected me={me} busy={busy} onResync={onResync} onDisconnect={onDisconnect} isLive={status === 'approved'} />
      <ProfileEditor me={me} onSaved={onReload} />
      {status === 'approved' && <AiTools />}
      {status === 'approved' && <Insights />}
    </>
  )
}

function ProfileEditor({ me, onSaved }: { me: Extract<Me, { connected: true }>; onSaved: () => void }) {
  const b = me.brand
  const [tagline, setTagline] = useState(b?.tagline ?? '')
  const [bio, setBio] = useState(b?.bio ?? '')
  const [logo, setLogo] = useState(b?.logo_url ?? '')
  const [hero, setHero] = useState(b?.hero_url ?? '')
  const [instagram, setInstagram] = useState(b?.instagram ?? '')
  const [website, setWebsite] = useState(b?.website ?? '')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    setBusy(true); setSaved(false)
    try {
      await fetch('/api/brands/profile', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tagline, bio, logo_url: logo, hero_url: hero, instagram, website }),
      })
      setSaved(true); onSaved()
    } finally { setBusy(false) }
  }

  const slug = (b?.display_name || b?.store_domain || '').replace(/\.myshopify\.com$/, '')
  return (
    <div style={card}>
      <div style={label}>YOUR FROM PROFILE</div>
      <p style={{ fontSize: 13, color: '#79756d', margin: '0 0 14px' }}>
        This is your public brand page on FROM{me.brand?.status === 'approved' ? <> — <a href={`/brand/${slug}`} target="_blank" rel="noopener" style={{ color: '#111' }}>view it ↗</a></> : ' (goes live when approved)'}.
      </p>
      <input style={input} placeholder="Tagline (e.g. Heritage workwear, made in Japan)" value={tagline} onChange={e => setTagline(e.target.value)} />
      <textarea style={{ ...input, marginTop: 10, minHeight: 80, resize: 'vertical' }} placeholder="Brand story / bio" value={bio} onChange={e => setBio(e.target.value)} />
      <input style={{ ...input, marginTop: 10 }} placeholder="Logo image URL" value={logo} onChange={e => setLogo(e.target.value)} />
      <input style={{ ...input, marginTop: 10 }} placeholder="Hero/banner image URL" value={hero} onChange={e => setHero(e.target.value)} />
      <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
        <input style={input} placeholder="Instagram handle" value={instagram} onChange={e => setInstagram(e.target.value)} />
        <input style={input} placeholder="Website" value={website} onChange={e => setWebsite(e.target.value)} />
      </div>
      <button style={{ ...primaryBtn(busy), marginTop: 14 }} disabled={busy} onClick={save}>
        {busy ? 'Saving…' : saved ? 'Saved ✓' : 'Save profile'}
      </button>
    </div>
  )
}

function Pitch() {
  const benefits = [
    {
      title: 'Reach shoppers hunting for you',
      body: 'FROM shoppers search by vibe and intent — "quiet luxury linen for a coastal wedding." Your pieces surface to people who want exactly what you make, not a sea of fast fashion.',
    },
    {
      title: 'Free AI tools for your store',
      body: 'Generate polished product copy, SEO titles, and tags in seconds. See real demand data — what shoppers search for, including gaps you could stock into.',
    },
    {
      title: 'Keep your store, keep your customer',
      body: 'Checkout stays on your own site. We only read your products (you approve on Shopify). No fees to be found. Connect in one click, disconnect anytime.',
    },
  ]
  return (
    <div style={{ ...card, padding: '26px 22px' }}>
      <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.25, marginBottom: 8 }}>
        The best-dressed shoppers aren’t on the mainstream. They’re searching for brands like yours.
      </div>
      <p style={{ fontSize: 14.5, color: '#6b675f', lineHeight: 1.55, margin: '0 0 20px' }}>
        FROM is an AI shopping search across independent brands. Connect your Shopify store and your
        catalog goes live to every FROM shopper — with AI tools and real demand data on the house.
      </p>
      <div style={{ display: 'grid', gap: 12 }}>
        {benefits.map((b, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{
              flexShrink: 0, width: 24, height: 24, borderRadius: 12, background: '#111', color: '#fff',
              fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{i + 1}</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>{b.title}</div>
              <div style={{ fontSize: 13.5, color: '#6b675f', lineHeight: 1.5 }}>{b.body}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Connected({ me, busy, onResync, onDisconnect, isLive }: {
  me: Extract<Me, { connected: true }>; busy: string | null; onResync: () => void; onDisconnect: () => void; isLive: boolean
}) {
  const b = me.brand
  const live = me.live
  return (
    <div style={card}>
      <div style={label}>YOUR CATALOG IN FROM</div>
      <div style={{ display: 'flex', gap: 28, marginBottom: 6 }}>
        <Stat n={Number(b?.product_count ?? 0)} label="products synced" />
        <Stat n={Number(live?.total ?? 0)} label={isLive ? 'live in search' : 'ready (hidden)'} />
        <Stat n={Number(live?.in_stock ?? 0)} label="in stock" />
      </div>
      <div style={{ fontSize: 13, color: '#6b675f', marginTop: 10 }}>
        {b?.store_domain} · {b?.status}
        {b?.last_synced_at ? ` · last synced ${new Date(b.last_synced_at).toLocaleString()}` : ''}
      </div>
      {b?.sync_error && <div style={{ fontSize: 13, color: '#c0392b', marginTop: 6 }}>Last error: {b.sync_error}</div>}
      <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
        <button style={primaryBtn(busy === 'sync')} disabled={busy === 'sync'} onClick={onResync}>
          {busy === 'sync' ? 'Syncing…' : 'Re-sync catalog'}
        </button>
        <button
          style={{ ...primaryBtn(), background: '#fff', color: '#9a3030', border: '1px solid #e3cfcf' }}
          onClick={onDisconnect}
        >
          Disconnect
        </button>
      </div>
    </div>
  )
}

function AiTools() {
  const [title, setTitle] = useState('')
  const [materials, setMaterials] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [out, setOut] = useState<{ description?: string; seoTitle?: string; metaDescription?: string; tags?: string[]; error?: string } | null>(null)

  async function generate() {
    if (!title.trim()) return
    setBusy(true); setOut(null)
    try {
      const res = await fetch('/api/brands/ai/describe', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title, materials, notes }),
      })
      setOut(await res.json())
    } catch (e) { setOut({ error: (e as Error).message }) }
    finally { setBusy(false) }
  }

  return (
    <div style={card}>
      <div style={label}>AI PRODUCT COPY</div>
      <p style={{ fontSize: 13, color: '#79756d', margin: '0 0 14px' }}>
        Drop in a product name and a few details — get a polished description, SEO title, and tags.
      </p>
      <input style={input} placeholder="Product name (e.g. Cropped Linen Camp Shirt)" value={title} onChange={e => setTitle(e.target.value)} />
      <input style={{ ...input, marginTop: 10 }} placeholder="Materials (optional, e.g. 100% French linen)" value={materials} onChange={e => setMaterials(e.target.value)} />
      <textarea style={{ ...input, marginTop: 10, minHeight: 70, resize: 'vertical' }} placeholder="Notes (optional: fit, occasion, story)" value={notes} onChange={e => setNotes(e.target.value)} />
      <button style={{ ...primaryBtn(busy), marginTop: 14 }} disabled={busy} onClick={generate}>
        {busy ? 'Writing…' : 'Generate copy'}
      </button>

      {out && !out.error && (
        <div style={{ marginTop: 18, borderTop: '1px solid #eee', paddingTop: 16 }}>
          {out.description && <Field title="Description" value={out.description} />}
          {out.seoTitle && <Field title="SEO title" value={out.seoTitle} />}
          {out.metaDescription && <Field title="Meta description" value={out.metaDescription} />}
          {out.tags && out.tags.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#79756d', marginBottom: 6 }}>Tags</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {out.tags.map((t, i) => (
                  <span key={i} style={{ fontSize: 12.5, padding: '4px 10px', background: '#f0eee9', borderRadius: 20 }}>{t}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {out?.error && <div style={{ marginTop: 12, color: '#c0392b', fontSize: 13 }}>{out.error}</div>}
    </div>
  )
}

function Insights() {
  const [data, setData] = useState<{ total?: number; thinResults?: number; topSearches?: { query: string; count: number }[]; terms?: { term: string; count: number }[]; message?: string } | null>(null)

  useEffect(() => {
    fetch('/api/brands/insights', { cache: 'no-store' }).then(r => r.json()).then(setData).catch(() => {})
  }, [])

  if (!data) return null
  return (
    <div style={card}>
      <div style={label}>SHOPPER DEMAND · LAST 14 DAYS</div>
      {data.message ? (
        <p style={{ fontSize: 13, color: '#9a968e', margin: 0 }}>{data.message}</p>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 28, marginBottom: 16 }}>
            <Stat n={Number(data.total ?? 0)} label="searches" />
            <Stat n={Number(data.thinResults ?? 0)} label="unmet (thin results)" />
          </div>
          {data.terms && data.terms.length > 0 && (
            <>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#79756d', margin: '4px 0 8px' }}>What shoppers want</div>
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                {data.terms.slice(0, 24).map((t, i) => (
                  <span key={i} style={{ fontSize: 13, padding: '5px 11px', background: '#f0eee9', borderRadius: 20 }}>
                    {t.term} <span style={{ color: '#a8a39a' }}>{t.count}</span>
                  </span>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

function Field({ title, value }: { title: string; value: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#79756d' }}>{title}</span>
        <button
          onClick={() => navigator.clipboard?.writeText(value)}
          style={{ fontSize: 11.5, color: '#666', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
        >copy</button>
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.55, color: '#2a2a2a', whiteSpace: 'pre-wrap' }}>{value}</div>
    </div>
  )
}

function Stat({ n, label: l }: { n: number; label: string }) {
  return (
    <div>
      <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1 }}>{n.toLocaleString()}</div>
      <div style={{ fontSize: 12, color: '#9a968e', marginTop: 4 }}>{l}</div>
    </div>
  )
}
