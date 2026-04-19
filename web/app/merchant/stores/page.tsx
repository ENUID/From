'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'

type Store = { _id: string; shop_name: string; shop_domain: string }

function StorePickerInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status } = useSession()
  const user = session?.user

  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/merchant/login')
  }, [status, router])

  useEffect(() => {
    if (searchParams.get('connected') === '1') {
      setToast({ msg: 'Store connected successfully.', ok: true })
      setTimeout(() => setToast(null), 3500)
    }

    const error = searchParams.get('error')
    if (!error) return

    const messages: Record<string, string> = {
      invalid_params: 'Invalid request from Shopify.',
      hmac_invalid: 'Security check failed. Please try again.',
      invalid_state: 'Session expired. Please reconnect.',
      invalid_user_session: 'Google session was missing during Shopify connect. Please sign in again and retry.',
      shop_mismatch: 'Store mismatch. Please try again.',
      token_exchange_failed: 'Could not get an access token from Shopify.',
      callback_failed: searchParams.get('message') || 'The Shopify callback failed while saving or syncing the store.',
      save_failed: 'The connected store could not be saved to this workspace.',
    }

    setToast({ msg: messages[error] ?? `Error: ${error}`, ok: false })
    setTimeout(() => setToast(null), 5000)
  }, [searchParams])

  useEffect(() => {
    if (status !== 'authenticated') return

    fetch('/api/merchant/stores')
      .then(async (response) => {
        const data = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(data.error ?? 'Failed to load stores')
        }
        setStores(data.stores ?? [])
      })
      .catch((error: unknown) => {
        setStores([])
        const message = error instanceof Error ? error.message : 'Failed to load stores'
        setToast({ msg: message, ok: false })
        setTimeout(() => setToast(null), 5000)
      })
      .finally(() => setLoading(false))
  }, [status])

  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--ink3)', fontSize: 13 }}>
        Loading...
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', flexDirection: 'column', padding: isMobile ? 16 : 24 }}>
      {toast && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', background: toast.ok ? '#0f2d1a' : '#2d0f0f', color: toast.ok ? '#6edba8' : '#ed8080', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 500, boxShadow: '0 4px 24px rgba(0,0,0,0.18)', zIndex: 999, whiteSpace: 'nowrap' }}>
          {toast.msg}
        </div>
      )}

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--m-border)', borderRadius: 16, width: '100%', maxWidth: 460, overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
        <div style={{ padding: isMobile ? '18px 20px 14px' : '22px 24px 18px', borderBottom: '1px solid var(--m-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: isMobile ? 14 : 20 }}>
            {user?.image ? (
              <img src={user.image} alt="" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--m-green)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, color: 'var(--bg-white)' }}>
                {(user?.name ?? 'M')[0].toUpperCase()}
              </div>
            )}
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 500 }}>{user?.name ?? 'Merchant account'}</div>
              <div style={{ fontSize: 12, color: 'var(--ink3)', marginTop: 1 }}>{user?.email ?? 'No email available'}</div>
            </div>
          </div>
          <h1 style={{ fontFamily: 'var(--serif)', fontSize: isMobile ? 20 : 22, fontWeight: 400, letterSpacing: '-0.02em', marginBottom: 4 }}>Choose a store</h1>
          <p style={{ fontSize: 12.5, color: 'var(--ink3)' }}>Select which connected Shopify store you want to manage.</p>
        </div>

        <div>
          {loading ? (
            <div style={{ padding: 28, textAlign: 'center', color: 'var(--ink3)', fontSize: 13 }}>Loading...</div>
          ) : stores.length > 0 ? (
            stores.map((store, index) => (
              <div
                key={store._id}
                onClick={() => router.push(`/merchant/dashboard?storeId=${store._id}`)}
                style={{ padding: isMobile ? '12px 20px' : '14px 24px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', transition: 'background 0.1s', borderBottom: index < stores.length - 1 ? '1px solid var(--m-border)' : 'none', background: 'var(--bg-card)' }}
                onMouseEnter={event => { event.currentTarget.style.background = 'var(--bg)' }}
                onMouseLeave={event => { event.currentTarget.style.background = 'var(--bg-card)' }}
              >
                <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--m-green)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 600, color: 'var(--bg-white)', flexShrink: 0 }}>
                  {store.shop_name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{store.shop_name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink3)', marginTop: 1 }}>{store.shop_domain}</div>
                </div>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#5a9a5a', flexShrink: 0 }} />
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="var(--ink3)" strokeWidth="1.5"><path d="M3 7h8M7 3l4 4-4 4" /></svg>
              </div>
            ))
          ) : (
            <div style={{ padding: '40px 24px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 32, marginBottom: 14, color: 'var(--m-green)' }}>No stores yet</div>
              <div style={{ fontSize: 14.5, fontWeight: 500, marginBottom: 6 }}>Nothing connected</div>
              <div style={{ fontSize: 13, color: 'var(--ink3)', lineHeight: 1.65, marginBottom: 22 }}>Connect a Shopify store to begin syncing products into the merchant workspace.</div>
              <button type="button" onClick={() => router.push('/onboarding')} style={{ padding: '10px 22px', background: 'var(--m-green)', color: 'var(--bg-white)', border: 'none', borderRadius: 30, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                Connect Shopify store
              </button>
            </div>
          )}
        </div>

        <div style={{ padding: isMobile ? '10px 20px' : '13px 24px', borderTop: '1px solid var(--m-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button type="button" onClick={() => router.push('/onboarding')} style={{ fontSize: 12, color: 'var(--m-green-mid)', cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'var(--sans)', display: 'flex', alignItems: 'center', gap: 5 }}>
            Connect new
          </button>
          <button type="button" onClick={() => signOut({ callbackUrl: '/merchant' })} style={{ fontSize: 11.5, color: 'var(--ink3)', cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'var(--sans)' }}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}

export default function StorePicker() {
  return <Suspense><StorePickerInner /></Suspense>
}
