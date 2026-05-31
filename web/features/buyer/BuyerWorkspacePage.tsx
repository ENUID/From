'use client'

import { KeyboardEvent, useEffect, useRef, useState } from 'react'
import ProductCard, { Product } from '@/components/ProductCard'
import ProductModal from '@/components/ProductModal'
import type { BuyerContext } from '@/lib/buyerContext'
import { ExchangeRates } from '@/lib/exchangeRates'

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

const SAVED_KEY = 'from:saved-products'
const HISTORY_KEY = 'from:search-history'

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

function normalizeProductForCurrency(product: Product, currency: string): Product {
  return {
    ...product,
    base_currency: product.base_currency ?? product.currency ?? 'USD',
    currency,
  }
}

function normalizeProductsForCurrency(products: Product[], currency: string) {
  return products.map(product => normalizeProductForCurrency(product, currency))
}

export default function Home({
  initialBuyerContext,
  initialRates,
}: {
  initialBuyerContext: BuyerContext
  initialRates: ExchangeRates
}) {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE])
  const [history, setHistory] = useState<ConversationTurn[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeView, setActiveView] = useState<View>('discover')
  const [savedProducts, setSavedProducts] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [searchHistory, setSearchHistory] = useState<SearchHistoryEntry[]>([])
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [buyerContext] = useState(initialBuyerContext)
  const [rates] = useState(initialRates)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])


  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, activeView])

  useEffect(() => {
    try {
      const savedRaw = window.localStorage.getItem(SAVED_KEY)
      const historyRaw = window.localStorage.getItem(HISTORY_KEY)
      if (savedRaw) {
        const saved = JSON.parse(savedRaw) as Product[]
        setSavedProducts(normalizeProductsForCurrency(saved, buyerContext.currency))
      }
      if (historyRaw) setSearchHistory(JSON.parse(historyRaw) as SearchHistoryEntry[])
    } catch {
      window.localStorage.removeItem(SAVED_KEY)
      window.localStorage.removeItem(HISTORY_KEY)
    }
  }, [buyerContext.currency])

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
    setIsSidebarOpen(false)
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
      const normalizedProduct = normalizeProductForCurrency(product, buyerContext.currency)
      const exists = previous.some(item => item.id === product.id)
      if (exists) {
        return previous.filter(item => item.id !== product.id)
      }
      return [normalizedProduct, ...previous]
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

      const products = Array.isArray(data.products)
        ? normalizeProductsForCurrency(data.products as Product[], buyerContext.currency)
        : []
      rememberSearch(messageText, products.length)
      setMessages(previous => [...previous, { role: 'assistant', content: data.text, products }])
      setHistory(previous => [
        ...previous,
        { role: 'user', content: messageText },
        { role: 'assistant', content: data.text, products },
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
        <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '16px 20px' : '32px 40px', display: 'flex', flexDirection: 'column', gap: isMobile ? 16 : 24 }}>
          {!hasConversation && (
            <div
              style={{
                flex: 1,
                display: 'grid',
                alignContent: 'center',
                gap: isMobile ? 24 : 40,
                maxWidth: 800,
                margin: '0 auto',
                padding: isMobile ? '20px 0' : '40px 0',
                textAlign: 'center',
              }}
            >
              <div className="fade-in">
                <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--m-green)', fontWeight: 600, marginBottom: isMobile ? 10 : 16 }}>
                  Buyer workspace
                </div>
                <h1 style={{ fontFamily: 'var(--serif)', fontSize: isMobile ? '42px' : 'clamp(42px, 6vw, 76px)', lineHeight: 0.96, fontWeight: 300, color: 'var(--ink)', marginBottom: isMobile ? 14 : 20, letterSpacing: '-0.04em' }}>
                  Search by intent,
                  <br />
                  not by ads.
                </h1>
                <p style={{ maxWidth: 540, fontSize: isMobile ? 14 : 15.5, color: 'var(--ink3)', lineHeight: 1.7, fontWeight: 300, margin: '0 auto' }}>
                  From matches items from verified independent stores. Describe what you need, the context, budget, or style, and discover unique finds.
                </p>
                <p style={{ marginTop: 12, fontSize: isMobile ? 12.5 : 13, color: 'var(--m-green)', letterSpacing: '0.04em' }}>
                  Prices shown in {buyerContext.currency} for shoppers in {buyerContext.country}.
                </p>
              </div>

              <div className="fade-in" style={{ animationDelay: '0.1s' }}>
                <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink3)', marginBottom: 14 }}>Try searching for</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', padding: isMobile ? '0 10px' : '0' }}>
                  {suggestions.map(text => (
                    <button
                      key={text}
                      type="button"
                      onClick={() => sendMessage(text)}
                      style={{
                        background: 'transparent',
                        border: '1px solid var(--m-border)',
                        borderRadius: 30,
                        padding: isMobile ? '10px 20px' : '8px 18px',
                        fontSize: isMobile ? 14 : 13,
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

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', gap: 16 }}>
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
                  maxWidth: isMobile ? '88%' : '64%',
                  padding: isMobile ? '10px 14px' : '12px 18px',
                  fontSize: isMobile ? 12.5 : 13.5,
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(240px, 100%), 1fr))', gap: 10, width: '100%' }}>
                  {message.products.map((product, offset) => (
                    <ProductCard
                      key={product.id || `${index}-${offset}`}
                      product={product}
                      rates={rates}
                      isBest={offset === 0}
                      saved={savedIds.has(product.id)}
                      onToggleSave={toggleSaved}
                      onClick={() => setSelectedProduct(product)}
                    />
                  ))}
                </div>
              ) : null}
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

        <footer style={{ 
          padding: isMobile ? '8px 10px 18px' : '14px 28px 20px', 
          borderTop: '1px solid var(--m-border)', 
          background: isMobile ? 'rgba(255,255,255,0.85)' : 'var(--bg)', 
          backdropFilter: isMobile ? 'blur(12px)' : 'none',
          flexShrink: 0,
          paddingBottom: isMobile ? 'max(16px, env(safe-area-inset-bottom))' : '20px'
        }}>
          <div style={{ 
            display: 'flex', 
            gap: isMobile ? 8 : 12, 
            alignItems: 'center', 
            background: 'var(--bg-card)', 
            border: '1px solid var(--m-border)', 
            borderRadius: 24, 
            padding: isMobile ? '8px 8px 8px 14px' : '10px 10px 10px 20px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
            maxWidth: 900,
            margin: '0 auto',
            width: '100%'
          }}>
            <input
              ref={inputRef}
              value={input}
              onChange={event => setInput(event.target.value)}
              onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => event.key === 'Enter' && !event.shiftKey && sendMessage()}
              placeholder={isMobile ? "Search products..." : "Search by product, material, budget, or intended use"}
              style={{ flex: 1, minWidth: 0, border: 'none', background: 'none', fontSize: isMobile ? 16 : 14, color: 'var(--ink)', outline: 'none' }}
            />
            <button
              type="button"
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              style={{
                width: isMobile ? 48 : 42,
                height: isMobile ? 48 : 42,
                borderRadius: 18,
                flexShrink: 0,
                border: 'none',
                background: loading || !input.trim() ? 'var(--m-border)' : 'var(--m-green)',
                cursor: loading || !input.trim() ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                boxShadow: loading || !input.trim() ? 'none' : '0 4px 10px rgba(90,154,90,0.3)',
              }}
            >
              {loading ? (
                <div
                  style={{
                    width: 14,
                    height: 14,
                    border: '1.5px solid rgba(255,255,255,0.3)',
                    borderTopColor: 'white',
                    borderRadius: '50%',
                    animation: 'spin 0.65s linear infinite',
                  }}
                />
              ) : (
                <svg width="20" height="20" viewBox="0 0 14 14" fill="none">
                  <path d="M1 7h12M7 1l6 6-6 6" stroke={input.trim() ? 'white' : 'rgba(255,255,255,0.5)'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          </div>
        </footer>
      </>
    )
  }

  function renderHistoryView() {
    return (
      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '20px 24px' : '32px 36px' }}>
        <div style={{ marginBottom: isMobile ? 18 : 24 }}>
          <div style={{ fontFamily: 'var(--serif)', fontSize: isMobile ? 28 : 34, lineHeight: 1.08, marginBottom: 6 }}>Search history</div>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 6, alignItems: 'flex-start' }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)', minWidth: 0 }}>{entry.query}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink3)', whiteSpace: 'nowrap', flexShrink: 0 }}>{formatTime(entry.createdAt)}</div>
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
      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '20px 24px' : '32px 36px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, marginBottom: isMobile ? 18 : 24 }}>
          <div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: isMobile ? 28 : 34, lineHeight: 1.08, marginBottom: 6 }}>Saved products</div>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', gap: 12 }}>
            {savedProducts.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                rates={rates}
                saved
                onToggleSave={toggleSaved}
                onClick={() => setSelectedProduct(product)}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100dvh', maxWidth: '100%', background: 'var(--bg)', overflow: 'hidden' }}>
      {/* Mobile Drawer Overlay */}
      {isMobile && isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.3)',
            backdropFilter: 'blur(2px)',
            zIndex: 100,
          }}
        />
      )}

      <aside
        style={{
          width: isMobile ? 280 : 72,
          background: 'var(--m-green)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: isMobile ? 'stretch' : 'center',
          padding: '22px 0',
          flexShrink: 0,
          gap: 8,
          position: isMobile ? 'fixed' : 'relative',
          height: '100dvh',
          left: isMobile && !isSidebarOpen ? -300 : 0,
          top: 0,
          transition: 'left 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          zIndex: 1000,
          boxShadow: isMobile && isSidebarOpen ? '20px 0 50px rgba(0,0,0,0.15)' : 'none',
        }}
      >
        <div style={{ marginBottom: 24, padding: isMobile ? '0 24px' : '0', display: 'flex', alignItems: 'center', justifyContent: isMobile ? 'space-between' : 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/logo.png" alt="From Logo" style={{ width: 28, height: 28, objectFit: 'contain' }} />
            {isMobile && <span style={{ fontFamily: 'var(--serif)', fontSize: 18, color: 'var(--bg-white)' }}>From</span>}
          </div>
          {isMobile && (
            <button
              type="button"
              onClick={() => setIsSidebarOpen(false)}
              style={{ background: 'none', border: 'none', color: 'var(--bg-white)', cursor: 'pointer', padding: 4 }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {[
          { id: 'discover', label: 'Discover', icon: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 9l7-7 7 7v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9z" /><path d="M8 19v-7h4v7" /></svg> },
          { id: 'history', label: 'History', icon: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="10" cy="10" r="8" /><path d="M10 6v4l3 2" /></svg> },
          { id: 'saved', label: 'Saved', icon: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 3.5A1.5 1.5 0 0 1 6.5 2h7A1.5 1.5 0 0 1 15 3.5V18l-5-3-5 3V3.5z" /></svg> },
        ].map(item => {
          const isActive = activeView === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setActiveView(item.id as View)
                setIsSidebarOpen(false)
              }}
              style={{
                width: isMobile ? 'auto' : 44,
                height: 44,
                borderRadius: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: isMobile ? 'flex-start' : 'center',
                gap: 12,
                padding: isMobile ? '0 24px' : '0',
                cursor: 'pointer',
                color: isActive ? 'var(--m-green)' : 'var(--bg-white)',
                border: 'none',
                background: isActive ? 'var(--bg-white)' : 'transparent',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                opacity: isActive ? 1 : 0.7,
                margin: isMobile ? '0 12px' : '0',
              }}
              onMouseEnter={e => !isActive && (e.currentTarget.style.opacity = '1')}
              onMouseLeave={e => !isActive && (e.currentTarget.style.opacity = '0.7')}
            >
              <span style={{ width: 20, height: 20, display: 'flex', flexShrink: 0 }}>{item.icon}</span>
              {isMobile && <span style={{ fontSize: 15, fontWeight: 500 }}>{item.label}</span>}
            </button>
          )
        })}

        <div style={{ marginTop: 'auto', padding: isMobile ? '0 24px' : '0', display: 'flex', flexDirection: 'column', alignItems: isMobile ? 'flex-start' : 'center', gap: 20 }}>
          <div style={{ textAlign: isMobile ? 'left' : 'center' }}>
            <div style={{ fontSize: 10, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', marginBottom: 4 }}>Region</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--bg-white)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6edba8' }} />
              {buyerContext.country}
            </div>
          </div>
        </div>
      </aside>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', minWidth: 0 }}>
        {isMobile && (
          <header style={{ height: 56, display: 'flex', alignItems: 'center', padding: '0 16px', borderBottom: '1px solid var(--m-border)', background: 'var(--bg)', flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              style={{ background: 'none', border: 'none', color: 'var(--ink)', padding: 8, marginLeft: -8, cursor: 'pointer' }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12h18M3 6h18M3 18h18" />
              </svg>
            </button>
            <div style={{ marginLeft: 8, fontFamily: 'var(--serif)', fontSize: 17, fontWeight: 500 }}>From</div>
            {hasConversation && (
              <button
                type="button"
                onClick={resetConversation}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--m-green)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
              >
                New search
              </button>
            )}
          </header>
        )}

        {!isMobile && hasConversation && (
          <header style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 64, display: 'flex', alignItems: 'center', padding: '0 32px', zIndex: 10, pointerEvents: 'none' }}>
            <button
              type="button"
              onClick={resetConversation}
              style={{
                pointerEvents: 'auto',
                marginLeft: 'auto',
                background: 'var(--bg-card)',
                border: '1px solid var(--m-border)',
                borderRadius: 30,
                padding: '8px 20px',
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--ink2)',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              }}
            >
              New search
            </button>
          </header>
        )}

        {activeView === 'discover' && renderDiscoverView()}
        {activeView === 'history' && renderHistoryView()}
        {activeView === 'saved' && renderSavedView()}

        {selectedProduct && (
          <ProductModal
            product={selectedProduct}
            rates={rates}
            onClose={() => setSelectedProduct(null)}
          />
        )}
      </main>
    </div>
  )
}
