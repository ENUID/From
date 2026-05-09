'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function MerchantLanding() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])
  const pillars = [
    {
      title: 'Connect Shopify once',
      body: 'Authenticate with Shopify and keep your catalog available inside From without copying products manually.',
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
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', minHeight: '100vh', background: 'var(--bg)', overflowX: 'hidden' }}>
      <div style={{ 
        width: isMobile ? '100%' : '48%', 
        background: 'var(--m-green)', 
        display: 'flex', 
        flexDirection: 'column', 
        padding: isMobile ? '24px 24px 32px' : '38px 52px', 
        position: 'relative', 
        overflow: 'hidden', 
        flexShrink: 0,
        textAlign: isMobile ? 'center' : 'left'
      }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 60% at 50% 110%, rgba(200,213,181,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: isMobile ? 'center' : 'space-between', marginBottom: isMobile ? 32 : 72 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src="/logo.png" alt="From Logo" style={{ width: 24, height: 24, objectFit: 'contain' }} />
            <span style={{ fontFamily: 'var(--serif)', fontSize: 20, color: 'var(--bg-white)', letterSpacing: '-0.01em' }}>From</span>
          </div>
        </div>

        <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: isMobile ? 'flex-start' : 'center', alignItems: isMobile ? 'center' : 'flex-start' }}>
          <div style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(200,213,181,0.6)', marginBottom: isMobile ? 12 : 20, fontWeight: 500 }}>
            Merchant workspace
          </div>
          <h1 style={{ 
            fontFamily: 'var(--serif)', 
            fontSize: isMobile ? '40px' : 'clamp(40px,4.4vw,58px)', 
            fontWeight: 300, 
            color: 'var(--bg-white)', 
            lineHeight: 1.02, 
            letterSpacing: '-0.03em', 
            marginBottom: isMobile ? 20 : 28 
          }}>
            {isMobile ? (
              <>Keep your store searchable & current.</>
            ) : (
              <>Keep your store<br />searchable,<br />current, and<br />reviewable.</>
            )}
          </h1>
          <p style={{ fontSize: 14, color: 'rgba(200,213,181,0.6)', lineHeight: 1.7, maxWidth: isMobile ? '100%' : 400, fontWeight: 300, marginBottom: isMobile ? 32 : 44 }}>
            From for merchants focuses on the basics that matter: store connection, catalog sync, and reliable buyer handoff.
          </p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', width: isMobile ? '100%' : 'auto' }}>
            <Link href="/merchant/stores" style={{ 
              background: '#fff', 
              color: 'var(--m-green)', 
              borderRadius: 30, 
              padding: '16px 32px', 
              fontSize: 14, 
              fontWeight: 600, 
              textDecoration: 'none',
              textAlign: 'center',
              flex: isMobile ? 1 : 'none',
              boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
            }}>
              Open workspace
            </Link>
            <Link href="/onboarding" style={{ 
              color: 'var(--bg-white)', 
              border: '1px solid rgba(255,255,255,0.25)', 
              borderRadius: 30, 
              padding: '16px 32px', 
              fontSize: 14, 
              textDecoration: 'none',
              textAlign: 'center',
              flex: isMobile ? 1 : 'none',
              backdropFilter: 'blur(4px)'
            }}>
              Connect store
            </Link>
          </div>
        </div>

        {!isMobile && (
          <div style={{ position: 'relative', zIndex: 1, display: 'grid', gap: 14, paddingTop: 32 }}>
            {workflow.map(step => (
              <div key={step} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#c8d5b5', marginTop: 6, flexShrink: 0 }} />
                <div style={{ fontSize: 12.5, color: 'rgba(200,213,181,0.62)', lineHeight: 1.6 }}>{step}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ flex: 1, background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: isMobile ? '28px 24px 16px' : '36px 40px 24px', borderBottom: '1px solid var(--m-border)' }}>
          <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ink3)', marginBottom: 6 }}>
            What is included
          </div>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: isMobile ? 21 : 24, fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            Practical tools for a connected catalog.
          </h2>
        </div>

        <div style={{ padding: isMobile ? '14px 24px 24px' : '18px 40px 32px', display: 'grid', gap: 12 }}>
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

        <div style={{ padding: isMobile ? '0 24px 48px' : '0 40px 36px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
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
