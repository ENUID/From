'use client'

/**
 * /brands — the merchant side of FROM, in the shopper app's editorial language.
 *
 * Not connected → pitch + connect. Connected → state-aware: under review,
 * rejected, or full dashboard (catalog, profile, AI copy, demand).
 */

import { useCallback, useEffect, useState } from 'react'
import {
  INK, INK2, INK3, PAPER, BRD, GOOD, WARN, BAD, SANS, SERIF,
  page, shell, card, sectionLabel, input, pill, pillGhost,
} from '@/features/brands/theme'

type Brand = {
  store_domain: string; display_name?: string; plan?: string; status?: string
  product_count?: number; last_synced_at?: string; sync_error?: string | null
  tagline?: string; bio?: string; logo_url?: string; hero_url?: string
  instagram?: string; website?: string; rejection_reason?: string
}
type Me =
  | { connected: false }
  | { connected: true; brand?: Brand; live?: { total?: number; in_stock?: number }; store_domain?: string; error?: string }

export default function BrandsPage() {
  const [me, setMe] = useState<Me | null>(null)
  const [shop, setShop] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const loadMe = useCallback(async () => {
    try { const r = await fetch('/api/brands/me', { cache: 'no-store' }); setMe(await r.json()) }
    catch { setMe({ connected: false }) }
  }, [])
  useEffect(() => { loadMe() }, [loadMe])

  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    if (p.get('connected')) setBanner({ kind: 'ok', text: `Store connected — ${p.get('synced') ?? 0} products pulled into FROM.` })
    else if (p.get('error')) setBanner({ kind: 'err', text: `Connection failed: ${p.get('error')}` })
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
      const r = await fetch('/api/brands/sync', { method: 'POST' }); const d = await r.json()
      setBanner(r.ok ? { kind: 'ok', text: `Synced ${d.upserted ?? 0} products.` } : { kind: 'err', text: `Sync failed: ${d.error}` })
      loadMe()
    } finally { setBusy(null) }
  }
  async function disconnect() {
    if (!confirm('Disconnect your store? Your products stay live but stop refreshing.')) return
    setBusy('disconnect')
    try { await fetch('/api/brands/disconnect', { method: 'POST' }); loadMe(); setBanner({ kind: 'ok', text: 'Disconnected.' }) }
    finally { setBusy(null) }
  }

  const connected = me?.connected === true

  return (
    <main style={page}>
      <FontFix />
      {/* Masthead */}
      <header style={{ ...shell, paddingTop: 30, paddingBottom: 10, textAlign: 'center' }}>
        <div style={{ fontFamily: SERIF, fontSize: 30, fontWeight: 500, letterSpacing: '.04em', color: INK }}>FROM</div>
        <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 600, letterSpacing: '.28em', textTransform: 'uppercase', color: INK3, marginTop: 4 }}>
          for brands
        </div>
      </header>

      <div style={shell}>
        {banner && (
          <div style={{
            ...card, padding: '14px 18px', display: 'flex', gap: 10, alignItems: 'center',
            background: banner.kind === 'ok' ? 'rgba(31,122,72,.06)' : 'rgba(154,48,48,.05)',
            borderColor: banner.kind === 'ok' ? 'rgba(31,122,72,.2)' : 'rgba(154,48,48,.2)',
            color: banner.kind === 'ok' ? GOOD : BAD, fontFamily: SANS, fontSize: 13.5,
          }}>{banner.text}</div>
        )}

        {!connected && <Pitch />}

        {!connected ? (
          <ConnectCard shop={shop} setShop={setShop} onConnect={connect} />
        ) : (
          <Dashboard me={me as Extract<Me, { connected: true }>} busy={busy} onResync={resync} onDisconnect={disconnect} onReload={loadMe} />
        )}
      </div>
    </main>
  )
}

/* Ensure the display + body fonts are present even if this route renders alone. */
function FontFix() {
  return (
    <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=DM+Sans:wght@300;400;500;600&display=swap');`}</style>
  )
}

function Pitch() {
  const benefits = [
    { t: 'Be found by shoppers hunting for you', b: 'FROM shoppers search by feeling — “quiet luxury linen for a coastal wedding.” Your pieces surface to people who want exactly what you make.' },
    { t: 'AI tools, on the house', b: 'Polished product copy, SEO and tags in seconds — plus real demand data on what shoppers want, including the gaps you could fill.' },
    { t: 'Your store stays yours', b: 'Checkout happens on your own site. We only read your products, and you approve it on Shopify. Connect in a click, leave anytime.' },
  ]
  return (
    <section style={{ ...card, padding: '30px 26px' }}>
      <h1 style={{
        fontFamily: SERIF, fontSize: 'clamp(26px,5.5vw,34px)', fontWeight: 500, lineHeight: 1.18,
        letterSpacing: '-.01em', color: INK, margin: '0 0 14px',
      }}>
        The best-dressed shoppers aren’t on the mainstream. They’re searching for brands like yours.
      </h1>
      <p style={{ fontFamily: SANS, fontSize: 15, color: INK2, lineHeight: 1.6, margin: '0 0 26px', opacity: .85 }}>
        FROM is an AI shopping search across independent brands. Connect your Shopify store once —
        your catalog goes live to every FROM shopper.
      </p>
      <div style={{ display: 'grid', gap: 20 }}>
        {benefits.map((x, i) => (
          <div key={i} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <div style={{ fontFamily: SERIF, fontSize: 30, fontWeight: 500, color: INK3, lineHeight: 1, width: 26, flexShrink: 0 }}>{i + 1}</div>
            <div>
              <div style={{ fontFamily: SANS, fontSize: 15.5, fontWeight: 600, color: INK, marginBottom: 3 }}>{x.t}</div>
              <div style={{ fontFamily: SANS, fontSize: 13.5, color: INK3, lineHeight: 1.55 }}>{x.b}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function ConnectCard({ shop, setShop, onConnect }: { shop: string; setShop: (s: string) => void; onConnect: () => void }) {
  return (
    <section style={card}>
      <div style={sectionLabel}>Connect your Shopify store</div>
      <input
        style={input} placeholder="your-store.myshopify.com" value={shop}
        onChange={e => setShop(e.target.value)} onKeyDown={e => e.key === 'Enter' && onConnect()}
        autoCapitalize="none" autoCorrect="off"
      />
      <button style={{ ...pill(), marginTop: 16 }} onClick={onConnect}>Connect store</button>
      <p style={{ fontFamily: SANS, fontSize: 12.5, color: INK3, margin: '16px 0 0', lineHeight: 1.55 }}>
        Read-only access to your products. You approve on Shopify — nothing in your store changes,
        and checkout stays on your own site.
      </p>
    </section>
  )
}

function Dashboard({ me, busy, onResync, onDisconnect, onReload }: {
  me: Extract<Me, { connected: true }>; busy: string | null
  onResync: () => void; onDisconnect: () => void; onReload: () => void
}) {
  const status = me.brand?.status ?? 'pending'

  if (status === 'rejected') {
    return (
      <section style={{ ...card, background: 'rgba(154,48,48,.04)', borderColor: 'rgba(154,48,48,.18)' }}>
        <Notice serif="Not approved yet" body={
          `Your store wasn’t approved for FROM at this time.${me.brand?.rejection_reason ? ` Reason: ${me.brand.rejection_reason}.` : ''} Reach out if you think this was a mistake.`
        } tone={BAD} />
        <button style={{ ...pillGhost(), marginTop: 18 }} onClick={onDisconnect}>Disconnect</button>
      </section>
    )
  }

  return (
    <>
      {status === 'pending' && (
        <section style={{ ...card, background: 'rgba(154,106,26,.05)', borderColor: 'rgba(154,106,26,.2)' }}>
          <Notice serif="Under review" tone={WARN} body={
            'Thank you for connecting — we’ve pulled your catalog and your store is in the review queue. FROM is curated, so a human checks every brand first. You’ll go live the moment you’re approved. Meanwhile, make your profile shine below.'
          } />
        </section>
      )}

      <CatalogCard me={me} busy={busy} onResync={onResync} onDisconnect={onDisconnect} isLive={status === 'approved'} />
      <ProfileEditor me={me} onSaved={onReload} />
      {status === 'approved' && <AiTools />}
      {status === 'approved' && <Insights />}
    </>
  )
}

function Notice({ serif, body, tone }: { serif: string; body: string; tone: string }) {
  return (
    <>
      <div style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 500, color: tone, marginBottom: 6 }}>{serif}</div>
      <p style={{ fontFamily: SANS, fontSize: 14, color: INK2, lineHeight: 1.6, margin: 0, opacity: .9 }}>{body}</p>
    </>
  )
}

function CatalogCard({ me, busy, onResync, onDisconnect, isLive }: {
  me: Extract<Me, { connected: true }>; busy: string | null; onResync: () => void; onDisconnect: () => void; isLive: boolean
}) {
  const b = me.brand, live = me.live
  return (
    <section style={card}>
      <div style={sectionLabel}>Your catalogue in FROM</div>
      <div style={{ display: 'flex', gap: 34 }}>
        <Stat n={Number(b?.product_count ?? 0)} label="products synced" />
        <Stat n={Number(live?.total ?? 0)} label={isLive ? 'live in search' : 'ready · hidden'} />
        <Stat n={Number(live?.in_stock ?? 0)} label="in stock" />
      </div>
      <div style={{ fontFamily: SANS, fontSize: 12.5, color: INK3, marginTop: 16 }}>
        {b?.store_domain}{b?.last_synced_at ? ` · last synced ${new Date(b.last_synced_at).toLocaleString()}` : ''}
      </div>
      {b?.sync_error && <div style={{ fontFamily: SANS, fontSize: 12.5, color: BAD, marginTop: 6 }}>Last error: {b.sync_error}</div>}
      <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
        <button style={pill(busy === 'sync')} disabled={busy === 'sync'} onClick={onResync}>
          {busy === 'sync' ? 'Syncing…' : 'Re-sync catalogue'}
        </button>
        <button style={pillGhost()} onClick={onDisconnect}>Disconnect</button>
      </div>
    </section>
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
    <section style={card}>
      <div style={sectionLabel}>Your FROM profile</div>
      <p style={{ fontFamily: SANS, fontSize: 13, color: INK3, margin: '0 0 16px', lineHeight: 1.5 }}>
        Your public brand page on FROM{b?.status === 'approved'
          ? <> — <a href={`/brand/${slug}`} target="_blank" rel="noopener" style={{ color: INK, textDecoration: 'underline', textUnderlineOffset: 2 }}>view it ↗</a></>
          : ' (goes live when approved)'}.
      </p>
      <input style={input} placeholder="Tagline — e.g. Heritage workwear, made in Japan" value={tagline} onChange={e => setTagline(e.target.value)} />
      <textarea style={{ ...input, marginTop: 10, minHeight: 88, resize: 'vertical' }} placeholder="Your brand story" value={bio} onChange={e => setBio(e.target.value)} />
      <input style={{ ...input, marginTop: 10 }} placeholder="Logo image URL" value={logo} onChange={e => setLogo(e.target.value)} />
      <input style={{ ...input, marginTop: 10 }} placeholder="Hero / banner image URL" value={hero} onChange={e => setHero(e.target.value)} />
      <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
        <input style={input} placeholder="Instagram" value={instagram} onChange={e => setInstagram(e.target.value)} />
        <input style={input} placeholder="Website" value={website} onChange={e => setWebsite(e.target.value)} />
      </div>
      <button style={{ ...pill(busy), marginTop: 16 }} disabled={busy} onClick={save}>
        {busy ? 'Saving…' : saved ? 'Saved ✓' : 'Save profile'}
      </button>
    </section>
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
      const r = await fetch('/api/brands/ai/describe', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title, materials, notes }),
      })
      setOut(await r.json())
    } catch (e) { setOut({ error: (e as Error).message }) }
    finally { setBusy(false) }
  }

  return (
    <section style={card}>
      <div style={sectionLabel}>AI product copy</div>
      <p style={{ fontFamily: SANS, fontSize: 13, color: INK3, margin: '0 0 16px', lineHeight: 1.5 }}>
        A product name and a few details — out comes a polished description, SEO title and tags.
      </p>
      <input style={input} placeholder="Product name — e.g. Cropped Linen Camp Shirt" value={title} onChange={e => setTitle(e.target.value)} />
      <input style={{ ...input, marginTop: 10 }} placeholder="Materials (optional)" value={materials} onChange={e => setMaterials(e.target.value)} />
      <textarea style={{ ...input, marginTop: 10, minHeight: 64, resize: 'vertical' }} placeholder="Notes — fit, occasion, story (optional)" value={notes} onChange={e => setNotes(e.target.value)} />
      <button style={{ ...pill(busy), marginTop: 16 }} disabled={busy} onClick={generate}>{busy ? 'Writing…' : 'Generate copy'}</button>

      {out && !out.error && (
        <div style={{ marginTop: 22, borderTop: `1px solid ${BRD}`, paddingTop: 18 }}>
          {out.description && <Field title="Description" value={out.description} />}
          {out.seoTitle && <Field title="SEO title" value={out.seoTitle} />}
          {out.metaDescription && <Field title="Meta description" value={out.metaDescription} />}
          {out.tags && out.tags.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontFamily: SANS, fontSize: 11.5, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: INK3, marginBottom: 8 }}>Tags</div>
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                {out.tags.map((t, i) => <Chip key={i}>{t}</Chip>)}
              </div>
            </div>
          )}
        </div>
      )}
      {out?.error && <div style={{ fontFamily: SANS, marginTop: 12, color: BAD, fontSize: 13 }}>{out.error}</div>}
    </section>
  )
}

function Insights() {
  const [data, setData] = useState<{ total?: number; thinResults?: number; terms?: { term: string; count: number }[]; message?: string } | null>(null)
  useEffect(() => { fetch('/api/brands/insights', { cache: 'no-store' }).then(r => r.json()).then(setData).catch(() => {}) }, [])
  if (!data) return null
  return (
    <section style={card}>
      <div style={sectionLabel}>Shopper demand · last 14 days</div>
      {data.message ? (
        <p style={{ fontFamily: SANS, fontSize: 13, color: INK3, margin: 0 }}>{data.message}</p>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 34, marginBottom: 18 }}>
            <Stat n={Number(data.total ?? 0)} label="searches" />
            <Stat n={Number(data.thinResults ?? 0)} label="unmet demand" />
          </div>
          {data.terms && data.terms.length > 0 && (
            <>
              <div style={{ fontFamily: SANS, fontSize: 11.5, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: INK3, margin: '4px 0 10px' }}>What shoppers want</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {data.terms.slice(0, 24).map((t, i) => <Chip key={i}>{t.term} <span style={{ color: INK3, opacity: .7 }}>{t.count}</span></Chip>)}
              </div>
            </>
          )}
        </>
      )}
    </section>
  )
}

function Field({ title, value }: { title: string; value: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <span style={{ fontFamily: SANS, fontSize: 11.5, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: INK3 }}>{title}</span>
        <button onClick={() => navigator.clipboard?.writeText(value)} style={{ fontFamily: SANS, fontSize: 11.5, color: INK3, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>copy</button>
      </div>
      <div style={{ fontFamily: SANS, fontSize: 14, lineHeight: 1.6, color: INK2, whiteSpace: 'pre-wrap' }}>{value}</div>
    </div>
  )
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      fontFamily: SANS, fontSize: 13, color: INK2, padding: '5px 12px',
      background: 'rgba(44,18,6,.04)', border: `1px solid ${BRD}`, borderRadius: 20,
    }}>{children}</span>
  )
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div>
      <div style={{ fontFamily: SERIF, fontSize: 34, fontWeight: 500, lineHeight: 1, color: INK }}>{n.toLocaleString()}</div>
      <div style={{ fontFamily: SANS, fontSize: 11.5, color: INK3, marginTop: 6, letterSpacing: '.02em' }}>{label}</div>
    </div>
  )
}
