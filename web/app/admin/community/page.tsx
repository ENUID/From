'use client'

import { useState, useEffect } from 'react'

interface Entry {
  _id: string
  email: string
  note?: string
  grantedAt: number
}

const STORAGE_KEY = 'from_admin_secret'

export default function AdminCommunityPage() {
  const [view, setView] = useState<'loading' | 'login' | 'admin'>('loading')
  const [secret, setSecret] = useState('')
  const [list, setList] = useState<Entry[]>([])
  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')
  const [working, setWorking] = useState(false)
  const [loginErr, setLoginErr] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    if (stored) {
      verifyAndLoad(stored).then(ok => {
        setView(ok ? 'admin' : 'login')
      })
    } else {
      setView('login')
    }
  }, [])

  async function verifyAndLoad(s: string): Promise<boolean> {
    try {
      const r = await fetch('/api/admin/community-access', {
        headers: { 'x-admin-secret': s },
      })
      if (!r.ok) return false
      const d = await r.json()
      setList(d.list ?? [])
      return true
    } catch {
      return false
    }
  }

  async function login() {
    if (!secret.trim() || working) return
    setWorking(true)
    setLoginErr('')
    try {
      const r = await fetch('/api/admin/community-access', {
        headers: { 'x-admin-secret': secret.trim() },
      })
      if (r.status === 401) {
        const d = await r.json().catch(() => ({}))
        setLoginErr(d.reason === 'not_configured' ? 'ADMIN_SECRET not set in Vercel env' : 'Wrong password')
        setWorking(false)
        return
      }
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        setLoginErr(d.detail ?? d.error ?? `Error ${r.status}`)
        setWorking(false)
        return
      }
      await r.json()
      sessionStorage.setItem(STORAGE_KEY, secret.trim())
      window.location.reload()
    } catch (e: any) {
      setLoginErr('Network error: ' + (e?.message ?? 'unknown'))
    }
    setWorking(false)
  }

  async function grant() {
    if (!email.trim() || working) return
    setWorking(true)
    setMsg('')
    try {
      const s = sessionStorage.getItem(STORAGE_KEY) ?? ''
      const r = await fetch('/api/admin/community-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': s },
        body: JSON.stringify({ email: email.trim(), note: note.trim() || undefined }),
      })
      const d = await r.json()
      if (d.ok) {
        setEmail('')
        setNote('')
        setMsg('✓ ' + d.email + ' added')
        await verifyAndLoad(s)
      } else {
        setMsg(d.error ?? 'Error')
      }
    } catch {
      setMsg('Network error')
    }
    setWorking(false)
  }

  async function revoke(em: string) {
    if (working) return
    setWorking(true)
    try {
      const s = sessionStorage.getItem(STORAGE_KEY) ?? ''
      await fetch('/api/admin/community-access', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': s },
        body: JSON.stringify({ email: em }),
      })
      setMsg('Removed ' + em)
      await verifyAndLoad(s)
    } catch {
      setMsg('Network error')
    }
    setWorking(false)
  }

  const s: Record<string, any> = {
    page: { minHeight: '100svh', background: '#0a0a0a', padding: '24px 16px', fontFamily: 'system-ui' },
    center: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
    card: { background: '#1a1a1a', borderRadius: '16px', padding: '32px 24px', width: '100%', maxWidth: '360px' },
    title: { color: '#fff', fontSize: '18px', fontWeight: 600, marginBottom: '4px' },
    sub: { color: '#888', fontSize: '13px', marginBottom: '24px' },
    input: { width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #333', background: '#111', color: '#fff', fontSize: '15px', boxSizing: 'border-box', outline: 'none', display: 'block' },
    btn: (active: boolean) => ({ width: '100%', padding: '13px', borderRadius: '10px', border: 'none', background: active ? '#fff' : '#333', color: active ? '#000' : '#888', fontSize: '15px', fontWeight: 600, cursor: active ? 'pointer' : 'default', marginTop: '16px' }),
  }

  if (view === 'loading') {
    return <div style={{ ...s.page, ...s.center }}><div style={{ color: '#555', fontSize: '14px' }}>Loading…</div></div>
  }

  if (view === 'login') {
    return (
      <div style={{ ...s.page, ...s.center }}>
        <div style={s.card}>
          <div style={s.title}>FROM Admin</div>
          <div style={s.sub}>Community access manager</div>
          <input
            type="password"
            placeholder="Admin secret"
            value={secret}
            onChange={e => setSecret(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && login()}
            style={s.input}
            autoFocus
          />
          {loginErr && <div style={{ color: '#f66', fontSize: '13px', marginTop: '10px' }}>{loginErr}</div>}
          <button onClick={login} disabled={working} style={s.btn(!working && !!secret.trim())}>
            {working ? 'Checking…' : 'Enter'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={s.page}>
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <div style={{ color: '#fff', fontSize: '20px', fontWeight: 700 }}>Community Access</div>
          <button onClick={() => { sessionStorage.removeItem(STORAGE_KEY); setView('login') }} style={{ background: 'none', border: 'none', color: '#555', fontSize: '13px', cursor: 'pointer' }}>Sign out</button>
        </div>
        <div style={{ color: '#666', fontSize: '13px', marginBottom: '28px' }}>{list.length} member{list.length !== 1 ? 's' : ''}</div>

        <div style={{ background: '#1a1a1a', borderRadius: '14px', padding: '20px', marginBottom: '20px' }}>
          <div style={{ color: '#aaa', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>Add member</div>
          <input type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)}
            style={{ ...s.input, marginBottom: '10px' }} />
          <input type="text" placeholder="Note (optional)" value={note} onChange={e => setNote(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && grant()}
            style={{ ...s.input, marginBottom: '14px' }} />
          {msg && <div style={{ color: msg.startsWith('✓') ? '#4c4' : '#f66', fontSize: '13px', marginBottom: '10px' }}>{msg}</div>}
          <button onClick={grant} disabled={working || !email.trim()}
            style={{ ...s.btn(!working && !!email.trim()), marginTop: 0 }}>
            {working ? '…' : 'Grant access'}
          </button>
        </div>

        {list.length > 0 ? (
          <div style={{ background: '#1a1a1a', borderRadius: '14px', overflow: 'hidden' }}>
            {list.map((entry, i) => (
              <div key={entry._id} style={{ padding: '14px 16px', borderTop: i > 0 ? '1px solid #222' : 'none', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#fff', fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.email}</div>
                  {entry.note && <div style={{ color: '#666', fontSize: '12px', marginTop: '2px' }}>{entry.note}</div>}
                  <div style={{ color: '#555', fontSize: '11px', marginTop: '2px' }}>{new Date(entry.grantedAt).toLocaleDateString()}</div>
                </div>
                <button onClick={() => revoke(entry.email)}
                  style={{ padding: '6px 12px', borderRadius: '7px', border: '1px solid #333', background: 'transparent', color: '#888', fontSize: '13px', cursor: 'pointer', flexShrink: 0 }}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: '#444', fontSize: '14px', textAlign: 'center', paddingTop: '12px' }}>No members yet</div>
        )}
      </div>
    </div>
  )
}
