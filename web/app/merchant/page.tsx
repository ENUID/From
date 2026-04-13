'use client'

import Link from 'next/link'

export default function MerchantLanding() {
  const pillars = [
    {
      title: 'Connect Shopify once',
      body: 'Authenticate with Shopify and keep your catalog available inside Fluid Orbit without copying products manually.',
    },
    {
      title: 'Sync the live catalog',
      body: 'Products, variants, inventory, storefront links, and currency are pulled from the active store connection.',
    },
    {
      title: 'Review catalog readiness',
      body: 'Use the merchant workspace to check stock coverage, discovery quality, and storefront handoff before sending traffic.',
    },
  ]

  const workflow = [
    'Sign in with the Google account that owns the merchant workspace.',
    'Connect one or more Shopify stores from onboarding.',
    'Run a sync to index products and inspect catalog readiness inside the dashboard.',
  ]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', overflow: 'hidden', background: 'var(--bg)' }}>
      <div style={{ width: '48%', background: 'var(--m-green)', display: 'flex', flexDirection: 'column', padding: '38px 52px', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 60% at 10% 110%, rgba(200,213,181,0.08) 0%, transparent 60%)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 72 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="14" r="12" stroke="#c8d5b5" strokeWidth="1.5" />
              <circle cx="14" cy="14" r="5" fill="#c8d5b5" />
              <ellipse cx="14" cy="14" rx="12" ry="5" stroke="#c8d5b5" strokeWidth="1" strokeDasharray="2 2" fill="none" />
            </svg>
            <span style={{ fontFamily: 'var(--serif)', fontSize: 18, color: 'var(--bg-white)' }}>Fluid Orbit</span>
          </div>
        </div>

        <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(200,213,181,0.5)', marginBottom: 18 }}>
            Merchant workspace
          </div>
          <h1 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(40px,4.4vw,58px)', fontWeight: 300, color: 'var(--bg-white)', lineHeight: 1.04, letterSpacing: '-0.025em', marginBottom: 24 }}>
            Keep your store
            <br />
            searchable,
            <br />
            current, and
            <br />
            reviewable.
          </h1>
          <p style={{ fontSize: 13.5, color: 'rgba(200,213,181,0.56)', lineHeight: 1.85, maxWidth: 400, fontWeight: 300, marginBottom: 40 }}>
            Fluid Orbit for merchants focuses on the basics that matter: store connection, catalog sync, search readiness, and reliable handoff back to your storefront.
          </p>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link href="/merchant/login" style={{ background: 'rgba(200,213,181,0.15)', color: 'var(--bg-white)', border: '1px solid rgba(200,213,181,0.25)', borderRadius: 30, padding: '12px 28px', fontSize: 13.5, fontWeight: 500, textDecoration: 'none' }}>
              Open merchant workspace
            </Link>
            <Link href="/onboarding" style={{ color: 'rgba(200,213,181,0.65)', border: '1px solid rgba(200,213,181,0.16)', borderRadius: 30, padding: '12px 28px', fontSize: 13.5, textDecoration: 'none' }}>
              Connect a store
            </Link>
          </div>
        </div>

        <div style={{ position: 'relative', zIndex: 1, display: 'grid', gap: 14, paddingTop: 32 }}>
          {workflow.map(step => (
            <div key={step} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#c8d5b5', marginTop: 6, flexShrink: 0 }} />
              <div style={{ fontSize: 12.5, color: 'rgba(200,213,181,0.62)', lineHeight: 1.6 }}>{step}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '36px 40px 24px', borderBottom: '1px solid var(--m-border)' }}>
          <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ink3)', marginBottom: 6 }}>
            What is included
          </div>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 400, letterSpacing: '-0.02em' }}>
            Practical tools for a connected catalog.
          </h2>
        </div>

        <div style={{ padding: '18px 40px 32px', display: 'grid', gap: 14 }}>
          {pillars.map((item, index) => (
            <div key={item.title} style={{ display: 'flex', gap: 16, alignItems: 'flex-start', background: 'var(--bg-card)', border: '1px solid var(--m-border)', borderRadius: 16, padding: '18px 20px' }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--m-green-light)', border: '1px solid var(--m-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 12, fontWeight: 600, color: 'var(--m-green)' }}>
                {index + 1}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 5 }}>{item.title}</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink3)', lineHeight: 1.75 }}>{item.body}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ padding: '0 40px 36px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--m-border)', borderRadius: 16, padding: '20px 22px' }}>
            <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink3)', marginBottom: 8 }}>Connection</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Google sign-in + Shopify OAuth</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink3)', lineHeight: 1.7 }}>
              Merchant access is tied to the signed-in workspace owner, and each store connection is scoped to that user.
            </div>
          </div>

          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--m-border)', borderRadius: 16, padding: '20px 22px' }}>
            <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink3)', marginBottom: 8 }}>Catalog</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Products, variants, inventory, storefront URLs</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink3)', lineHeight: 1.7 }}>
              Synced product data powers buyer search results and merchant-side readiness views.
            </div>
          </div>

          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--m-border)', borderRadius: 16, padding: '20px 22px' }}>
            <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink3)', marginBottom: 8 }}>Handoff</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Buyers return to your storefront</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink3)', lineHeight: 1.7 }}>
              The buyer experience surfaces products, then opens the connected store for the final purchase path.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
