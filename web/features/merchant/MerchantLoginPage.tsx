'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { getProviders, signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

function AuthForm() {
  const [loading, setLoading] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [error, setError] = useState('')
  const [googleReady, setGoogleReady] = useState(false)
  const searchParams = useSearchParams()
  const router = useRouter()
  const { status } = useSession()

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    getProviders()
      .then(providers => setGoogleReady(Boolean(providers?.google)))
      .catch(() => setGoogleReady(false))
  }, [])

  useEffect(() => {
    if (status !== 'authenticated') return
    const next = searchParams.get('next')
    const callbackUrl = next && next.startsWith('/') ? next : '/merchant/stores'
    router.replace(callbackUrl)
  }, [router, searchParams, status])

  useEffect(() => {
    const code = searchParams.get('error')
    if (!code) {
      setError('')
      return
    }

    const messages: Record<string, string> = {
      AccessDenied: 'Access was denied. Please choose the Google account that should own this merchant workspace.',
      Callback: 'The Google callback did not complete. Please try again.',
      Configuration: 'Google sign-in is not configured correctly right now.',
      OAuthAccountNotLinked: 'This email is linked to another sign-in method. Use the correct Google account or the buyer sign-in page.',
      OAuthCallback: 'Google sign-in did not complete. Please try again.',
      OAuthCreateAccount: 'We could not create a session from Google sign-in.',
      SessionRequired: 'Please sign in to continue.',
      Default: 'Sign-in failed. Please try again.',
    }

    setError(messages[code] ?? messages.Default)
  }, [searchParams])

  function handleGoogle() {
    if (!googleReady) {
      setError('Google sign-in is not available right now.')
      return
    }

    setLoading(true)
    setError('')
    const next = searchParams.get('next')
    const callbackUrl = next && next.startsWith('/') ? next : '/merchant/stores'
    signIn('google', { callbackUrl })
  }

  const highlights = [
    {
      title: 'Shopify connection',
      description: 'Connect stores through the merchant workspace and keep ownership scoped to the signed-in account.',
    },
    {
      title: 'Catalog sync',
      description: 'Review synced products, variant coverage, inventory visibility, and storefront links in one place.',
    },
    {
      title: 'Search readiness',
      description: 'See which products are ready for buyer discovery and which ones still need cleanup.',
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', minHeight: '100vh', background: 'var(--bg)', overflowX: 'hidden' }}>
      <div style={{ 
        width: isMobile ? '100%' : '44%', 
        background: 'var(--m-green)', 
        flexShrink: 0, 
        display: 'flex', 
        flexDirection: 'column', 
        padding: isMobile ? '32px 24px' : '44px 52px', 
        position: 'relative', 
        overflow: 'hidden',
        textAlign: isMobile ? 'center' : 'left'
      }}>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse 80% 60% at 20% 110%, rgba(200,213,181,0.07) 0%, transparent 60%)' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: isMobile ? 'center' : 'flex-start', gap: 10, marginBottom: isMobile ? 40 : 80 }}>
            <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="14" r="12" stroke="#c8d5b5" strokeWidth="1.5" />
              <circle cx="14" cy="14" r="5" fill="#c8d5b5" />
              <ellipse cx="14" cy="14" rx="12" ry="5" stroke="#c8d5b5" strokeWidth="1" strokeDasharray="2 2" fill="none" />
            </svg>
            <span style={{ fontFamily: 'var(--serif)', fontSize: 18, color: 'var(--bg-white)' }}>Fluid Orbit</span>
          </div>

          <h1 style={{ 
            fontFamily: 'var(--serif)', 
            fontSize: isMobile ? '36px' : 'clamp(38px,4vw,52px)', 
            fontWeight: 300, 
            color: 'var(--bg-white)', 
            lineHeight: 1.1, 
            letterSpacing: '-0.02em', 
            marginBottom: isMobile ? 16 : 20,
            textAlign: isMobile ? 'center' : 'left'
          }}>
            {isMobile ? "Sign in to manage store connections." : (
              <>Sign in to manage<br />store connections,<br />syncs, and<br />catalog health.</>
            )}
          </h1>

          <p style={{ fontSize: 13, color: 'rgba(200,213,181,0.5)', lineHeight: 1.85, maxWidth: isMobile ? '100%' : 340, fontWeight: 300, marginBottom: isMobile ? 32 : 48, textAlign: isMobile ? 'center' : 'left' }}>
            The merchant workspace is tied to your Google account, then each Shopify store is authorized separately.
          </p>

          {!isMobile && (
            <div style={{ display: 'grid', gap: 16 }}>
              {highlights.map(item => (
                <div key={item.title} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#c8d5b5', marginTop: 6, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 12.5, color: 'rgba(200,213,181,0.8)', fontWeight: 500 }}>{item.title}</div>
                    <div style={{ fontSize: 11.5, color: 'rgba(200,213,181,0.38)', marginTop: 2, lineHeight: 1.6 }}>{item.description}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {!isMobile && (
          <div style={{ position: 'relative', zIndex: 1, marginTop: 'auto' }}>
            <Link href="/" style={{ fontSize: 11.5, color: 'rgba(200,213,181,0.32)', textDecoration: 'none' }}>
              Back to buyer workspace
            </Link>
          </div>
        )}
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '40px 24px' : 40 }}>
        <div style={{ width: '100%', maxWidth: 390 }}>
          <div style={{ marginBottom: isMobile ? 24 : 34 }}>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: isMobile ? 26 : 30, fontWeight: 400, letterSpacing: '-0.02em', marginBottom: 8, textAlign: isMobile ? 'center' : 'left' }}>
              Merchant sign-in
            </h2>
            <p style={{ fontSize: 13.5, color: 'var(--ink3)', lineHeight: 1.65, textAlign: isMobile ? 'center' : 'left' }}>
              Use the Google account that should own this merchant workspace.
            </p>
          </div>

          {error && (
            <div style={{
              background: '#fff0f0',
              border: '1px solid #ffd4d4',
              borderRadius: 10,
              padding: '10px 14px',
              marginBottom: 18,
              fontSize: 13,
              color: '#d32f2f',
              lineHeight: 1.6,
            }}>
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogle}
            disabled={loading || !googleReady}
            style={{
              width: '100%',
              padding: '13px 16px',
              background: 'var(--bg-card)',
              border: '1px solid var(--m-border)',
              borderRadius: 12,
              fontSize: 14,
              color: loading ? 'var(--ink3)' : 'var(--ink)',
              cursor: loading || !googleReady ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              fontFamily: 'var(--sans)',
              fontWeight: 500,
              transition: 'border-color 0.15s, background 0.15s',
            }}
            onMouseEnter={e => {
              if (loading || !googleReady) return
              e.currentTarget.style.background = 'var(--bg-white)'
              e.currentTarget.style.borderColor = 'var(--m-border-2)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'var(--bg-card)'
              e.currentTarget.style.borderColor = 'var(--m-border)'
            }}
          >
            {loading ? (
              <>
                <div style={{ width: 14, height: 14, border: '1.5px solid var(--m-border)', borderTopColor: 'var(--ink3)', borderRadius: '50%', animation: 'spin 0.65s linear infinite' }} />
                Connecting...
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Continue with Google
              </>
            )}
          </button>

          {!googleReady && (
            <div style={{ marginTop: 10, fontSize: 11.5, color: 'var(--ink3)', textAlign: 'center', lineHeight: 1.6 }}>
              Google sign-in is unavailable in this environment.
            </div>
          )}

          <div style={{ marginTop: 26, paddingTop: 18, borderTop: '1px solid var(--m-border)' }}>
            <p style={{ fontSize: 11.5, color: 'var(--ink3)', lineHeight: 1.7, textAlign: 'center' }}>
              After sign-in, you can choose an existing store or open onboarding to connect a new Shopify store.
            </p>
            <p style={{ fontSize: 11.5, color: 'var(--ink3)', lineHeight: 1.7, textAlign: 'center', marginTop: 8 }}>
              Looking for buyer login? <Link href="/signin" style={{ color: 'var(--m-green-mid)', textDecoration: 'none' }}>Open the storefront sign-in page</Link>.
            </p>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

export default function MerchantLogin() {
  return <Suspense><AuthForm /></Suspense>
}
