'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { signIn, getProviders, useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'

type ProviderMap = Awaited<ReturnType<typeof getProviders>>

function getSafeNext(next: string | null, fallback: string) {
  if (!next || !next.startsWith('/')) return fallback
  return next
}

function normalizeClientRedirect(url: string | null | undefined, fallback: string) {
  if (!url) return fallback

  try {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const parsed = new URL(url)
      return `${parsed.pathname}${parsed.search}${parsed.hash}` || fallback
    }
  } catch {
    return fallback
  }

  return url.startsWith('/') ? url : fallback
}

function getErrorMessage(code: string | null) {
  if (!code) return ''

  const messages: Record<string, string> = {
    AccessDenied: 'Access was denied. Please try again.',
    Callback: 'The Google sign-in callback did not complete. Please try again.',
    Configuration: 'Authentication is not configured correctly right now.',
    OAuthAccountNotLinked: 'This email is already linked to a different sign-in method.',
    OAuthCallback: 'Google sign-in did not complete. Please try again.',
    OAuthCreateAccount: 'We could not create a session from Google sign-in.',
    SessionRequired: 'Please sign in to continue.',
    Default: 'Sign-in failed. Please try again.',
  }

  return messages[code] ?? messages.Default
}

function GoogleButton({
  disabled,
  onClick,
  label,
}: {
  disabled: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        width: '100%',
        height: 46,
        borderRadius: 10,
        border: '1px solid #ddd',
        background: '#fff',
        color: '#1a1a1a',
        fontSize: 14,
        fontFamily: "'Outfit', sans-serif",
        fontWeight: 400,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.7 : 1,
        transition: 'all 0.2s',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
      </svg>
      {label}
    </button>
  )
}

function SignInForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { status } = useSession()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [providers, setProviders] = useState<ProviderMap>(null)

  const next = useMemo(
    () => getSafeNext(searchParams.get('next'), '/'),
    [searchParams]
  )
  const registered = searchParams.get('registered') === 'true'
  const authIntent = searchParams.get('intent')
  const isMerchantIntent = authIntent === 'merchant' || next.startsWith('/merchant')

  useEffect(() => {
    getProviders().then(setProviders).catch(() => setProviders(null))
  }, [])

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace(next)
    }
  }, [next, router, status])

  useEffect(() => {
    const nextError = getErrorMessage(searchParams.get('error'))
    if (nextError) {
      setError(nextError)
    }
  }, [searchParams])

  const googleAvailable = Boolean(providers?.google)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email.trim()) {
      setError('Please enter your email')
      return
    }
    if (!password) {
      setError('Please enter your password')
      return
    }

    setLoading(true)

    try {
      const res = await signIn('credentials', {
        email: email.toLowerCase().trim(),
        password,
        redirect: false,
        callbackUrl: next,
      })

      if (res?.error) {
        setError(res.error)
        return
      }

      router.push(normalizeClientRedirect(res?.url, next))
      router.refresh()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleGoogle() {
    if (!googleAvailable) {
      setError('Google sign-in is not available right now.')
      return
    }

    setError('')
    setGoogleLoading(true)
    signIn('google', { callbackUrl: next })
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#fafaf8',
        fontFamily: "'Outfit', sans-serif",
        padding: '20px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 440,
          background: '#fff',
          border: '1px solid #e8e6e1',
          borderRadius: 16,
          padding: '40px 32px',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 12px',
              borderRadius: 999,
              background: '#f3f1eb',
              color: '#666',
              fontSize: 11,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: 16,
            }}
          >
            {isMerchantIntent ? 'Merchant access' : 'Buyer account'}
          </div>
          <h1
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 30,
              fontWeight: 400,
              color: '#1a1a1a',
              margin: '0 0 6px',
            }}
          >
            Welcome Back
          </h1>
          <p
            style={{
              fontSize: 13,
              color: '#888',
              fontWeight: 300,
              margin: 0,
              lineHeight: 1.6,
            }}
          >
            {isMerchantIntent
              ? 'Sign in with Google for merchant workspace access, or use your buyer account for the storefront.'
              : 'Sign in to Fluid Orbit with Google or your buyer account.'}
          </p>
        </div>

        {registered && !error && (
          <div
            style={{
              background: '#f0faf2',
              border: '1px solid #c8e6c9',
              borderRadius: 10,
              padding: '10px 14px',
              marginBottom: 20,
              fontSize: 13,
              color: '#2e7d32',
              fontWeight: 300,
            }}
          >
            Account created successfully. Please sign in.
          </div>
        )}

        {error && (
          <div
            style={{
              background: '#fff0f0',
              border: '1px solid #ffd4d4',
              borderRadius: 10,
              padding: '10px 14px',
              marginBottom: 20,
              fontSize: 13,
              color: '#d32f2f',
              fontWeight: 300,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: 'grid', gap: 12, marginBottom: 20 }}>
          <GoogleButton
            disabled={googleLoading}
            onClick={handleGoogle}
            label={googleLoading ? 'Connecting to Google...' : 'Continue with Google'}
          />
          {!googleAvailable && (
            <div style={{ fontSize: 11.5, color: '#888', textAlign: 'center', lineHeight: 1.6 }}>
              Google sign-in is currently unavailable in this environment.
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0 22px' }}>
          <div style={{ flex: 1, height: 1, background: '#ece8df' }} />
          <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#999' }}>or</div>
          <div style={{ flex: 1, height: 1, background: '#ece8df' }} />
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: 'block',
                fontSize: 11,
                fontWeight: 400,
                color: '#666',
                marginBottom: 6,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
              }}
            >
              Email
            </label>
            <input
              id="signin-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={{
                width: '100%',
                height: 44,
                border: '1px solid #ddd',
                borderRadius: 10,
                padding: '0 14px',
                fontSize: 14,
                fontFamily: "'Outfit', sans-serif",
                fontWeight: 300,
                color: '#1a1a1a',
                outline: 'none',
                transition: 'border-color 0.2s',
                boxSizing: 'border-box',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = '#3d5a47')}
              onBlur={e => (e.currentTarget.style.borderColor = '#ddd')}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label
              style={{
                display: 'block',
                fontSize: 11,
                fontWeight: 400,
                color: '#666',
                marginBottom: 6,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
              }}
            >
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="signin-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                style={{
                  width: '100%',
                  height: 44,
                  border: '1px solid #ddd',
                  borderRadius: 10,
                  padding: '0 44px 0 14px',
                  fontSize: 14,
                  fontFamily: "'Outfit', sans-serif",
                  fontWeight: 300,
                  color: '#1a1a1a',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = '#3d5a47')}
                onBlur={e => (e.currentTarget.style.borderColor = '#ddd')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px 6px',
                  color: '#999',
                  fontSize: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            id="signin-submit"
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              height: 46,
              border: 'none',
              borderRadius: 10,
              background: '#3d5a47',
              color: '#fff',
              fontSize: 14,
              fontFamily: "'Outfit', sans-serif",
              fontWeight: 400,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              transition: 'all 0.2s',
              letterSpacing: '0.02em',
            }}
            onMouseEnter={e => {
              if (!loading) e.currentTarget.style.background = '#4a6b54'
            }}
            onMouseLeave={e => {
              if (!loading) e.currentTarget.style.background = '#3d5a47'
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div
          style={{
            textAlign: 'center',
            marginTop: 20,
            fontSize: 13,
            color: '#888',
            fontWeight: 300,
            lineHeight: 1.7,
          }}
        >
          Don&apos;t have an account?{' '}
          <Link
            href="/signup"
            style={{
              color: '#3d5a47',
              textDecoration: 'none',
              fontWeight: 400,
            }}
          >
            Sign Up
          </Link>
          {isMerchantIntent && (
            <>
              <br />
              <Link
                href="/merchant/login"
                style={{
                  color: '#3d5a47',
                  textDecoration: 'none',
                  fontWeight: 400,
                }}
              >
                Open the merchant Google sign-in page
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  )
}
