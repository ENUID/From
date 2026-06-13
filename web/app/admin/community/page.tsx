'use client'

import { useState, useEffect } from 'react'

interface Entry {
  _id: string
  email: string
  note?: string
  grantedAt: number
}

export default function AdminCommunityPage() {
  const [secret, setSecret] = useState('')
  const [authed, setAuthed] = useState(false)
  const [list, setList] = useState<Entry[]>([])
  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  async function load(s: string) {
    const r = await fetch('/api/admin/community-access', {
      headers: { 'x-admin-secret': s },
    })
    if (r.status === 401) { setMsg('Wrong password'); return false }
    const data = await r.json()
    setList(data.list ?? [])
    return true
  }

  async function login() {
    setLoading(true)
    const ok = await load(secret)
    if (ok) setAuthed(true)
    setLoading(false)
  }

  async function grant() {
    if (!email.trim()) return
    setLoading(true)
    setMsg('')
    const r = await fetch('/api/admin/community-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
      body: JSON.stringify({ email: email.trim(), note: note.trim() || undefined }),
    })
    const data = await r.json()
    if (data.ok) {
      setEmail('')
      setNote('')
      setMsg(`✓ ${data.email} added`)
      await load(secret)
    } else {
      setMsg(data.error ?? 'Error')
    }
    setLoading(false)
  }

  async function revoke(em: string) {
    setLoading(true)
    await fetch('/api/admin/community-access', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
      body: JSON.stringify({ email: em }),
    })
    setMsg(`Removed ${em}`)
    await load(secret)
    setLoading(false)
  }

  if (!authed) {
    return (
      <div style={{ minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', padding: '24px' }}>
        <div style={{ background: '#1a1a1a', borderRadius: '16px', padding: '32px 24px', width: '100%', maxWidth: '360px' }}>
          <div style={{ color: '#fff', fontFamily: 'system-ui', fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>FROM Admin</div>
          <div style={{ color: '#888', fontFamily: 'system-ui', fontSize: '13px', marginBottom: '24px' }}>Community access manager</div>
          <input
            type="password"
            placeholder="Admin secret"
            value={secret}
            onChange={e => setSecret(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && login()}
            style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #333', background: '#111', color: '#fff', fontFamily: 'system-ui', fontSize: '15px', boxSizing: 'border-box', outline: 'none' }}
          />
          {msg && <div style={{ color: '#f66', fontFamily: 'system-ui', fontSize: '13px', marginTop: '8px' }}>{msg}</div>}
          <button
            onClick={login}
            disabled={loading}
            style={{ marginTop: '16px', width: '100%', padding: '13px', borderRadius: '10px', border: 'none', background: '#fff', color: '#000', fontFamily: 'system-ui', fontSize: '15px', fontWeight: 600, cursor: 'pointer' }}
          >
            {loading ? '…' : 'Enter'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100svh', background: '#0a0a0a', padding: '24px 16px', fontFamily: 'system-ui' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>
        <div style={{ color: '#fff', fontSize: '18px', fontWeight: 600, marginBottom: '4px' }}>Community Access</div>
        <div style={{ color: '#666', fontSize: '13px', marginBottom: '28px' }}>{list.length} member{list.length !== 1 ? 's' : ''}</div>

        {/* Add form */}
        <div style={{ background: '#1a1a1a', borderRadius: '14px', padding: '20px', marginBottom: '20px' }}>
          <div style={{ color: '#aaa', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>Add member</div>
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={{ width: '100%', padding: '11px 13px', borderRadius: '9px', border: '1px solid #333', background: '#111', color: '#fff', fontSize: '15px', boxSizing: 'border-box', outline: 'none', marginBottom: '10px' }}
          />
          <input
            type="text"
            placeholder="Note (optional)"
            value={note}
            onChange={e => setNote(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && grant()}
            style={{ width: '100%', padding: '11px 13px', borderRadius: '9px', border: '1px solid #333', background: '#111', color: '#fff', fontSize: '15px', boxSizing: 'border-box', outline: 'none', marginBottom: '14px' }}
          />
          {msg && <div style={{ color: msg.startsWith('✓') ? '#4c4' : '#f66', fontSize: '13px', marginBottom: '10px' }}>{msg}</div>}
          <button
            onClick={grant}
            disabled={loading || !email.trim()}
            style={{ width: '100%', padding: '12px', borderRadius: '9px', border: 'none', background: email.trim() ? '#fff' : '#333', color: email.trim() ? '#000' : '#666', fontSize: '15px', fontWeight: 600, cursor: email.trim() ? 'pointer' : 'default' }}
          >
            {loading ? '…' : 'Grant access'}
          </button>
        </div>

        {/* List */}
        {list.length > 0 && (
          <div style={{ background: '#1a1a1a', borderRadius: '14px', overflow: 'hidden' }}>
            {list.map((entry, i) => (
              <div key={entry._id} style={{ padding: '14px 16px', borderTop: i > 0 ? '1px solid #222' : 'none', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#fff', fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.email}</div>
                  {entry.note && <div style={{ color: '#666', fontSize: '12px', marginTop: '2px' }}>{entry.note}</div>}
                  <div style={{ color: '#555', fontSize: '11px', marginTop: '2px' }}>{new Date(entry.grantedAt).toLocaleDateString()}</div>
                </div>
                <button
                  onClick={() => revoke(entry.email)}
                  style={{ padding: '6px 12px', borderRadius: '7px', border: '1px solid #333', background: 'transparent', color: '#888', fontSize: '13px', cursor: 'pointer', flexShrink: 0 }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
