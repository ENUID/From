'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

function normalizeDomain(input: string) {
  return input.trim()
    .replace(/^https?:\/\//, '')
    .replace(/\.myshopify\.com\/?$/, '')
    .replace(/\/$/, '')
}

export default function Onboarding() {
  const [domain, setDomain] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleContinue() {
    setError('')
    const slug = normalizeDomain(domain)

    if (!slug) {
      setError('Enter the Shopify store subdomain to continue.')
      return
    }

    if (!/^[a-zA-Z0-9-]+$/.test(slug)) {
      setError('Use only letters, numbers, and dashes in the store subdomain.')
      return
    }

    setLoading(true)
    window.location.href = `/api/shopify/install?shop=${slug}.myshopify.com`
  }

  const steps = [
    { n: 1, label: 'Store', active: true },
    { n: 2, label: 'Authorize', active: false },
    { n: 3, label: 'Sync', active: false },
    { n: 4, label: 'Review', active: false },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <button
        type="button"
        onClick={() => router.push('/merchant/dashboard')}
        style={{
          position: 'fixed',
          top: 22,
          left: 24,
          background: 'var(--bg-card)',
          border: '1px solid var(--m-border)',
          borderRadius: 20,
          padding: '6px 14px',
          fontSize: 12,
          color: 'var(--ink3)',
          cursor: 'pointer',
          fontFamily: 'var(--sans)',
        }}
      >
        Back to dashboard
      </button>

      <div style={{ display: 'flex', width: '100%', maxWidth: 840, borderRadius: 18, overflow: 'hidden', border: '1px solid var(--m-border)' }}>
        <div style={{ width: 270, background: 'var(--m-green)', color: 'var(--bg-white)', padding: '38px 28px', display: 'flex', flexDirection: 'column', flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 100% 70% at 0% 120%, rgba(200,213,181,0.07) 0%, transparent 60%)', pointerEvents: 'none' }} />

          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 32 }}>
              <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
                <circle cx="14" cy="14" r="12" stroke="#c8d5b5" strokeWidth="1.5" />
                <circle cx="14" cy="14" r="5" fill="#c8d5b5" />
                <ellipse cx="14" cy="14" rx="12" ry="5" stroke="#c8d5b5" strokeWidth="1" strokeDasharray="2 2" fill="none" />
              </svg>
              <span style={{ fontFamily: 'var(--serif)', fontSize: 16, color: 'var(--bg-white)' }}>Fluid Orbit</span>
            </div>

            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 24, lineHeight: 1.15, marginBottom: 10, letterSpacing: '-0.02em', fontWeight: 300 }}>
              Connect a Shopify store
              <br />
              to this workspace.
            </h2>
            <p style={{ fontSize: 12.5, color: 'rgba(200,213,181,0.5)', lineHeight: 1.8, marginBottom: 28, fontWeight: 300 }}>
              We only ask for the Shopify store domain first. Authorization, sync, and catalog review happen in the next steps.
            </p>

            <div style={{ display: 'grid', gap: 14 }}>
              {[
                'Authorize the store owner through Shopify OAuth.',
                'Sync live products, variants, inventory, and storefront links.',
                'Review search readiness in the merchant dashboard after connection.',
              ].map(item => (
                <div key={item} style={{ display: 'flex', gap: 10 }}>
                  <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#c8d5b5', marginTop: 6, flexShrink: 0 }} />
                  <div style={{ fontSize: 12, color: 'rgba(200,213,181,0.68)', lineHeight: 1.65 }}>{item}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ position: 'relative', zIndex: 1, marginTop: 'auto', fontSize: 11, color: 'rgba(200,213,181,0.26)' }}>
            Shopify connection required
          </div>
        </div>

        <div style={{ flex: 1, background: 'var(--bg)', padding: '36px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 36 }}>
            {steps.map((step, index) => (
              <div key={step.n} style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 500, flexShrink: 0, background: step.active ? 'var(--m-green)' : 'var(--bg-card)', color: step.active ? 'var(--bg-white)' : 'var(--ink3)', border: step.active ? 'none' : '1px solid var(--m-border)' }}>
                    {step.n}
                  </div>
                  <span style={{ fontSize: 11.5, color: step.active ? 'var(--ink)' : 'var(--ink3)', fontWeight: step.active ? 500 : 400, whiteSpace: 'nowrap' }}>{step.label}</span>
                </div>
                {index < steps.length - 1 && <div style={{ width: 24, height: 1, background: 'var(--m-border)', margin: '0 8px', flexShrink: 0 }} />}
              </div>
            ))}
          </div>

          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--m-border)', borderRadius: 14, padding: '28px 26px', width: '100%', maxWidth: 420 }}>
            <h3 style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 400, marginBottom: 6, letterSpacing: '-0.01em' }}>
              Store domain
            </h3>
            <p style={{ fontSize: 12.5, color: 'var(--ink3)', marginBottom: 22, lineHeight: 1.7 }}>
              Enter the Shopify subdomain for the store you want to connect.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${error ? 'var(--red)' : 'var(--m-border)'}`, borderRadius: 10, padding: '11px 14px', marginBottom: error ? 8 : 16, gap: 4, transition: 'border-color 0.15s', background: 'var(--bg)' }}>
              <span style={{ fontSize: 12, color: 'var(--ink3)', whiteSpace: 'nowrap' }}>https://</span>
              <input
                value={domain}
                onChange={event => {
                  setDomain(event.target.value)
                  setError('')
                }}
                onKeyDown={event => event.key === 'Enter' && handleContinue()}
                placeholder="store subdomain"
                autoFocus
                style={{ flex: 1, border: 'none', fontSize: 13.5, color: 'var(--ink)', background: 'none' }}
              />
              <span style={{ fontSize: 12, color: 'var(--ink3)', whiteSpace: 'nowrap' }}>.myshopify.com</span>
            </div>

            {error && <p style={{ fontSize: 12, color: 'var(--red)', marginBottom: 14 }}>{error}</p>}

            <button
              type="button"
              onClick={handleContinue}
              disabled={loading}
              style={{ width: '100%', padding: '12px', background: loading ? 'var(--ink3)' : 'var(--m-green)', color: 'var(--bg-white)', border: 'none', borderRadius: 10, fontSize: 13.5, fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'var(--sans)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'background 0.15s' }}
            >
              {loading ? (
                <>
                  <div style={{ width: 13, height: 13, border: '1.5px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.65s linear infinite' }} />
                  Redirecting to Shopify...
                </>
              ) : (
                'Continue to Shopify'
              )}
            </button>

            <p style={{ fontSize: 11, color: 'var(--ink3)', textAlign: 'center', marginTop: 14, lineHeight: 1.65 }}>
              The next screen is Shopify authorization for this specific store.
            </p>
          </div>

          <p style={{ marginTop: 16, fontSize: 11, color: 'var(--ink3)' }}>Step 1 of 4</p>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
