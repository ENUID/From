'use client'

import { KeyboardEvent, useEffect, useRef, useState } from 'react'
import ProductCard, { Product } from '@/components/ProductCard'

interface Message {
  role: 'user' | 'assistant'
  content: string
  products?: Product[]
}

type ConversationTurn = Pick<Message, 'role' | 'content'>
type View = 'discover' | 'history' | 'saved'

type SearchHistoryEntry = {
  id: string
  query: string
  createdAt: number
  resultCount: number
}

const SAVED_KEY = 'fluid-orbit:saved-products'
const HISTORY_KEY = 'fluid-orbit:search-history'

const INITIAL_MESSAGE: Message = {
  role: 'assistant',
  content: 'Search across connected independent stores in plain language. Describe the item, budget, material, or intended use to get started.',
}

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp))
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE])
  const [history, setHistory] = useState<ConversationTurn[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeView, setActiveView] = useState<View>('discover')
  const [savedProducts, setSavedProducts] = useState<Product[]>([])
  const [searchHistory, setSearchHistory] = useState<SearchHistoryEntry[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, activeView])

  useEffect(() => {
    try {
      const savedRaw = window.localStorage.getItem(SAVED_KEY)
      const historyRaw = window.localStorage.getItem(HISTORY_KEY)
      if (savedRaw) setSavedProducts(JSON.parse(savedRaw) as Product[])
      if (historyRaw) setSearchHistory(JSON.parse(historyRaw) as SearchHistoryEntry[])
    } catch {
      window.localStorage.removeItem(SAVED_KEY)
      window.localStorage.removeItem(HISTORY_KEY)
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem(SAVED_KEY, JSON.stringify(savedProducts))
  }, [savedProducts])

  useEffect(() => {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(searchHistory))
  }, [searchHistory])

  const savedIds = new Set(savedProducts.map(product => product.id))
  const hasConversation = messages.some(message => message.role === 'user')

  function resetConversation() {
    if (loading) return
    setMessages([INITIAL_MESSAGE])
    setHistory([])
    setInput('')
    setActiveView('discover')
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function rememberSearch(query: string, resultCount: number) {
    const entry: SearchHistoryEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      query,
      createdAt: Date.now(),
      resultCount,
    }
    setSearchHistory(previous => [entry, ...previous.filter(item => item.query !== query)].slice(0, 20))
  }

  function toggleSaved(product: Product) {
    setSavedProducts(previous => {
      const exists = previous.some(item => item.id === product.id)
      if (exists) {
        return previous.filter(item => item.id !== product.id)
      }
      return [product, ...previous]
    })
  }

  async function sendMessage(text?: string) {
    const messageText = text ?? input.trim()
    if (!messageText || loading) return

    setActiveView('discover')
    setInput('')
    setLoading(true)
    setMessages(previous => [...previous, { role: 'user', content: messageText }])

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText, history }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Request failed')

      const products = Array.isArray(data.products) ? (data.products as Product[]) : []
      rememberSearch(messageText, products.length)
      setMessages(previous => [...previous, { role: 'assistant', content: data.text, products }])
      setHistory(previous => [
        ...previous,
        { role: 'user', content: messageText },
        { role: 'assistant', content: data.text },
      ])
    } catch {
      setMessages(previous => [
        ...previous,
        {
          role: 'assistant',
          content: 'The search request did not complete. Please try again in a moment.',
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  function renderDiscoverView() {
    const suggestions = [
      'Eco-friendly denim',
      'Handmade leather wallet',
      'Minimalist ceramics',
      'Linen shirts under $80',
    ]

    return (
      <>
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px', display: 'flex', flexDirection: 'column', gap: 24 }}>
          {!hasConversation && (
            <div
              style={{
                flex: 1,
                display: 'grid',
                alignContent: 'center',
                gap: 40,
                maxWidth: 800,
                margin: '0 auto',
                padding: '40px 0',
                textAlign: 'center',
              }}
            >
              <div className="fade-in">
                <div style={{ fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--m-green)', fontWeight: 600, marginBottom: 16 }}>
                  Buyer workspace
                </div>
                <h1 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(42px, 6vw, 76px)', lineHeight: 0.96, fontWeight: 300, color: 'var(--ink)', marginBottom: 20, letterSpacing: '-0.04em' }}>
                  Search by intent,
                  <br />
                  not by ads.
                </h1>
                <p style={{ maxWidth: 540, fontSize: 15.5, color: 'var(--ink3)', lineHeight: 1.8, fontWeight: 300, margin: '0 auto' }}>
                  Fluid Orbit matches items from verified independent stores. Describe what you need—context, budget, or style—and discover unique finds.
                </p>
              </div>

              <div className="fade-in" style={{ animationDelay: '0.1s' }}>
                <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink3)', marginBottom: 14 }}>Try searching for</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {suggestions.map(text => (
                    <button
                      key={text}
                      type="button"
                      onClick={() => sendMessage(text)}
                      style={{
                        background: 'transparent',
                        border: '1px solid var(--m-border)',
                        borderRadius: 30,
                        padding: '8px 18px',
                        fontSize: 13,
                        color: 'var(--ink2)',
                        cursor: 'pointer',
                        transition: 'all 0.15s cubic-bezier(0.23, 1, 0.32, 1)',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = 'var(--m-green-mid)'
                        e.currentTarget.style.color = 'var(--m-green)'
                        e.currentTarget.style.background = 'var(--m-green-light)'
                        e.currentTarget.style.transform = 'translateY(-1px)'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = 'var(--m-border)'
                        e.currentTarget.style.color = 'var(--ink2)'
                        e.currentTarget.style.background = 'transparent'
                        e.currentTarget.style.transform = 'translateY(0)'
                      }}
                    >
                      {text}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
                {[
                  {
                    title: 'Describe the need',
                    body: 'Search using plain language instead of exact keywords.',
                  },
                  {
                    title: 'Refine quickly',
                    body: 'Keep the conversation going to narrow by budget or use case.',
                  },
                  {
                    title: 'Save products',
                    body: 'Keep promising finds in one place during your session.',
                  },
                ].map((card, i) => (
                  <div
                    key={card.title}
                    className="fade-in"
                    style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--m-border)',
                      borderRadius: 18,
                      padding: '24px 22px 22px',
                      animationDelay: `${0.2 + i * 0.1}s`,
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>{card.title}</div>
                    <div style={{ fontSize: 13, color: 'var(--ink3)', lineHeight: 1.7 }}>{card.body}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {hasConversation && messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className="fade-in"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: message.role === 'user' ? 'flex-end' : 'flex-start',
                gap: 14,
              }}
            >
              <div
                style={{
                  maxWidth: '64%',
                  padding: '12px 18px',
                  fontSize: 13.5,
                  lineHeight: 1.72,
                  borderRadius: message.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  background: message.role === 'user' ? 'var(--m-green)' : 'var(--bg-card)',
                  color: message.role === 'user' ? 'var(--bg-white)' : 'var(--ink)',
                  border: message.role === 'assistant' ? '1px solid var(--m-border)' : 'none',
                }}
              >
                {message.content}
              </div>

              {message.products && message.products.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10, width: '100%' }}>
                  {message.products.map((product, offset) => (
                    <ProductCard
                      key={product.id || `${index}-${offset}`}
                      product={product}
                      isBest={offset === 0}
                      saved={savedIds.has(product.id)}
                      onToggleSave={toggleSaved}
                    />
                  ))}
                </div>
              ) : message.role === 'assistant' && index > 0 && !loading && (
                <div
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--m-border)',
                    borderRadius: 16,
                    padding: '20px 24px',
                    maxWidth: 480,
                    fontSize: 13,
                    color: 'var(--ink3)',
                    lineHeight: 1.7,
                  }}
                >
                  <div style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="7" cy="7" r="6" />
                      <path d="M7 4v3l2 1" />
                    </svg>
                    Search Tips
                  </div>
                  <ul style={{ paddingLeft: 16, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <li>Try broader terms (e.g., "boots" instead of "size 10 vintage boots")</li>
                    <li>Search by material or use case (e.g., "waterproof", "gift for runner")</li>
                    <li>Check if the stores have been synced recently in the Merchant dashboard</li>
                  </ul>
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div
              style={{
                display: 'flex',
                gap: 5,
                padding: '12px 18px',
                background: 'var(--bg-card)',
                border: '1px solid var(--m-border)',
                borderRadius: '18px 18px 18px 4px',
                width: 'fit-content',
              }}
            >
              {[0, 0.18, 0.36].map(delay => (
                <div
                  key={delay}
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: 'var(--ink3)',
                    animation: `bounce 1.1s ${delay}s ease-in-out infinite`,
                  }}
                />
              ))}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <footer style={{ padding: '14px 28px 20px', borderTop: '1px solid var(--m-border)', background: 'var(--bg)', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', background: 'var(--bg-card)', border: '1px solid var(--m-border)', borderRadius: 20, padding: '10px 10px 10px 20px' }}>
            <input
              ref={inputRef}
              value={input}
              onChange={event => setInput(event.target.value)}
              onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => event.key === 'Enter' && !event.shiftKey && sendMessage()}
              placeholder="Search by product, material, budget, or intended use"
              style={{ flex: 1, border: 'none', background: 'none', fontSize: 13.5, color: 'var(--ink)' }}
            />
            <button
              type="button"
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                flexShrink: 0,
                border: 'none',
                background: loading || !input.trim() ? 'var(--m-border)' : 'var(--m-green)',
                cursor: loading || !input.trim() ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.15s',
              }}
            >
              {loading ? (
                <div
                  style={{
                    width: 12,
                    height: 12,
                    border: '1.5px solid rgba(255,255,255,0.3)',
                    borderTopColor: 'white',
                    borderRadius: '50%',
                    animation: 'spin 0.65s linear infinite',
                  }}
                />
              ) : (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M1 7h12M7 1l6 6-6 6" stroke={input.trim() ? 'white' : 'var(--ink3)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          </div>
          <p style={{ marginTop: 7, fontSize: 10.5, letterSpacing: '0.08em', color: 'var(--ink3)', textAlign: 'center', textTransform: 'uppercase' }}>
            Enter to send
          </p>
        </footer>
      </>
    )
  }

  function renderHistoryView() {
    return (
      <div style={{ flex: 1, overflowY: 'auto', padding: '32px 36px' }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 34, lineHeight: 1.08, marginBottom: 6 }}>Search history</div>
          <p style={{ fontSize: 13, color: 'var(--ink3)', lineHeight: 1.7 }}>
            Re-run recent searches and continue refining them in the chat.
          </p>
        </div>

        {searchHistory.length === 0 ? (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--m-border)', borderRadius: 16, padding: '32px 28px', color: 'var(--ink3)', fontSize: 13, lineHeight: 1.8 }}>
            No searches yet. Your recent queries will appear here after you run them.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {searchHistory.map(entry => (
              <button
                key={entry.id}
                type="button"
                onClick={() => sendMessage(entry.query)}
                style={{
                  textAlign: 'left',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--m-border)',
                  borderRadius: 16,
                  padding: '18px 18px 16px',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 6 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{entry.query}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink3)', whiteSpace: 'nowrap' }}>{formatTime(entry.createdAt)}</div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink3)' }}>
                  {entry.resultCount} result{entry.resultCount === 1 ? '' : 's'} returned
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  function renderSavedView() {
    return (
      <div style={{ flex: 1, overflowY: 'auto', padding: '32px 36px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, marginBottom: 24 }}>
          <div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 34, lineHeight: 1.08, marginBottom: 6 }}>Saved products</div>
            <p style={{ fontSize: 13, color: 'var(--ink3)', lineHeight: 1.7 }}>
              Keep promising products here while you compare stores and decide what to open next.
            </p>
          </div>
          {savedProducts.length > 0 && (
            <button
              type="button"
              onClick={() => setSavedProducts([])}
              style={{
                border: '1px solid var(--m-border)',
                background: 'transparent',
                borderRadius: 30,
                padding: '8px 16px',
                fontSize: 12,
                color: 'var(--ink)',
                cursor: 'pointer',
              }}
            >
              Clear saved
            </button>
          )}
        </div>

        {savedProducts.length === 0 ? (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--m-border)', borderRadius: 16, padding: '32px 28px', color: 'var(--ink3)', fontSize: 13, lineHeight: 1.8 }}>
            No saved products yet. Use the save action on any search result to keep it here.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
            {savedProducts.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                saved
                onToggleSave={toggleSaved}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg)', overflow: 'hidden' }}>
      <aside
        style={{
          width: 72,
          background: 'var(--m-green)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '22px 0',
          flexShrink: 0,
          gap: 8,
        }}
      >
        <div style={{ marginBottom: 14 }}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="12" stroke="#c8d5b5" strokeWidth="1.5" />
            <circle cx="14" cy="14" r="5" fill="#c8d5b5" />
            <ellipse cx="14" cy="14" rx="12" ry="5" stroke="#c8d5b5" strokeWidth="1" strokeDasharray="2 2" fill="none" />
          </svg>
        </div>

        {[
          {
            id: 'discover' as View,
            title: 'Discover',
            icon: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 9l7-7 7 7v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9z" /><path d="M8 19v-7h4v7" /></svg>,
          },
          {
            id: 'history' as View,
            title: 'History',
            icon: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="10" cy="10" r="8" /><path d="M10 6v4l3 2" /></svg>,
          },
          {
            id: 'saved' as View,
            title: 'Saved',
            icon: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 3.5A1.5 1.5 0 0 1 6.5 2h7A1.5 1.5 0 0 1 15 3.5V18l-5-3-5 3V3.5z" /></svg>,
          },
        ].map(item => {
          const active = activeView === item.id
          return (
            <button
              key={item.id}
              type="button"
              title={item.title}
              onClick={() => setActiveView(item.id)}
              style={{
                width: 42,
                height: 42,
                borderRadius: 11,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: active ? 'rgba(200,213,181,0.18)' : 'transparent',
                color: active ? '#c8d5b5' : 'rgba(200,213,181,0.45)',
                transition: 'background 0.12s, color 0.12s',
              }}
            >
              <span style={{ width: 18, height: 18, display: 'flex' }}>{item.icon}</span>
            </button>
          )
        })}

        <div style={{ width: 28, height: 1, background: 'rgba(200,213,181,0.15)', margin: '8px 0' }} />
      </aside>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header
          style={{
            height: 58,
            borderBottom: '1px solid var(--m-border)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 28px',
            justifyContent: 'space-between',
            background: 'var(--bg)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, letterSpacing: '0.12em', color: 'var(--ink3)', textTransform: 'uppercase' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#5a9a5a', display: 'inline-block' }} />
            Fluid Orbit
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ border: '1px solid var(--m-border)', background: 'var(--bg-card)', borderRadius: 30, padding: '6px 14px', fontSize: 12, color: 'var(--ink3)' }}>
              {savedProducts.length} saved
            </div>
            {hasConversation && (
              <button
                type="button"
                onClick={resetConversation}
                style={{
                  border: '1px solid var(--m-border)',
                  background: 'transparent',
                  borderRadius: 30,
                  padding: '6px 16px',
                  fontSize: 12,
                  color: 'var(--ink2)',
                  cursor: 'pointer',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-card)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                New search
              </button>
            )}
          </div>
        </header>

        {activeView === 'discover' && renderDiscoverView()}
        {activeView === 'history' && renderHistoryView()}
        {activeView === 'saved' && renderSavedView()}
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes bounce { 0%,60%,100% { transform: translateY(0); } 30% { transform: translateY(-4px); } }
      `}</style>
    </div>
  )
}
