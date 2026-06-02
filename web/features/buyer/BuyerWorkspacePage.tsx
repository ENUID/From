'use client'

import { KeyboardEvent, useEffect, useLayoutEffect, useRef, useState } from 'react'
import ProductCard, { Product } from '@/components/ProductCard'
import ProductDrawer from '@/components/ProductDrawer'
import DiscoverView from '@/features/buyer/components/DiscoverView'
import type { BuyerContext } from '@/lib/buyerContext'
import { ExchangeRates } from '@/lib/exchangeRates'
import { convertCurrencyAmount } from '@/lib/currency'
import { useSession } from 'next-auth/react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

interface Message {
  role: 'user' | 'assistant'
  content: string
  products?: Product[]
  loadingMore?: boolean
  hasNoMore?: boolean
  searchQuery?: string
  budgetMax?: number | null
  isClothing?: boolean
}

type ConversationTurn = Pick<
  Message,
  | 'role'
  | 'content'
  | 'products'
  | 'searchQuery'
  | 'budgetMax'
  | 'isClothing'
>
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
  const { data: session } = useSession()
  const userEmail = session?.user?.email ?? undefined

  const convexSavedProducts = useQuery(api.buyer.getSavedProducts, userEmail ? { userEmail } : "skip")
  const convexSearchHistory = useQuery(api.buyer.getSearchHistory, userEmail ? { userEmail } : "skip")
  const toggleConvexSaved = useMutation(api.buyer.toggleSavedProduct)
  const saveConvexHistory = useMutation(api.buyer.saveSearchHistory)
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE])
  const hasConversation = messages.some(message => message.role === 'user')
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
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const prevMessagesLengthRef = useRef(messages.length)
  const prevScrollTopRef = useRef<number | null>(null)

  useIsomorphicLayoutEffect(() => {
    if (containerRef.current && prevScrollTopRef.current !== null) {
      console.log('[SCROLL PRESERVE] Restoring scrollTop to:', prevScrollTopRef.current)
      containerRef.current.scrollTop = prevScrollTopRef.current
      prevScrollTopRef.current = null
    }
  }, [messages])

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])


  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current

    // Only apply chat auto-scrolling in discover view with active conversation
    if (activeView !== 'discover' || !hasConversation) {
      container.scrollTop = 0
      prevMessagesLengthRef.current = messages.length
      return
    }

    // Only auto-scroll if message count changed OR if loading state changed
    const lengthChanged = messages.length !== prevMessagesLengthRef.current
    prevMessagesLengthRef.current = messages.length

    if (!lengthChanged && !loading) {
      // Do nothing! We are just loading more products inline or updating states!
      return
    }

    // If currently loading, scroll to bottom to show typing indicator
    if (loading) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'auto'
      })
      return
    }

    // When search is done, scroll to the top of the newly added assistant message
    const lastMessage = messages[messages.length - 1]
    if (lastMessage && lastMessage.role === 'assistant') {
      const latestElement = container.querySelector('#latest-message') as HTMLElement
      if (latestElement) {
        const targetScrollTop = latestElement.offsetTop - container.offsetTop - 16
        container.scrollTo({
          top: Math.max(0, targetScrollTop),
          behavior: 'auto'
        })
        return
      }
    }

    // Default fallback (e.g. user message sent): scroll to bottom
    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'auto'
    })
  }, [messages.length, loading, activeView, hasConversation])

  useEffect(() => {
    const container = containerRef.current
    if (!container || loading) return

    const handleScroll = () => {
      // Find the last assistant message index that has products
      const lastMessageIndex = messages
        .map((m, i) => ({ m, i }))
        .filter(({ m }) => m.role === 'assistant' && m.products && m.products.length > 0)
        .pop()?.i

      if (lastMessageIndex === undefined) return
      const lastMsg = messages[lastMessageIndex]
      if (lastMsg.loadingMore || lastMsg.hasNoMore) return

      // Trigger load more if we are scrolled close to the bottom (within 1200px)
      const threshold = 1200
      const scrollBottomDiff = container.scrollHeight - container.scrollTop - container.clientHeight
      const isCloseToBottom = scrollBottomDiff < threshold

      if (isCloseToBottom) {
        loadMoreProducts(lastMessageIndex)
      }
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [messages, loading, history, savedProducts])

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
    if (convexSavedProducts) {
      setSavedProducts(normalizeProductsForCurrency(convexSavedProducts, buyerContext.currency))
    }
  }, [convexSavedProducts, buyerContext.currency])

  useEffect(() => {
    if (convexSearchHistory) {
      setSearchHistory(convexSearchHistory)
    }
  }, [convexSearchHistory])

  useEffect(() => {
    if (!userEmail) {
      window.localStorage.setItem(SAVED_KEY, JSON.stringify(savedProducts))
    }
  }, [savedProducts, userEmail])

  useEffect(() => {
    if (!userEmail) {
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(searchHistory))
    }
  }, [searchHistory, userEmail])

  const savedIds = new Set(savedProducts.map(product => product.id))

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
    if (userEmail) {
      saveConvexHistory({ userEmail, query, resultCount })
    }
    const entry: SearchHistoryEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      query,
      createdAt: Date.now(),
      resultCount,
    }
    setSearchHistory(previous => [entry, ...previous.filter(item => item.query !== query)].slice(0, 20))
  }

  function toggleSaved(product: Product) {
    if (userEmail) {
      toggleConvexSaved({ userEmail, product })
    }
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
        body: JSON.stringify({ message: messageText, history, savedProducts }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Request failed')

      let products = Array.isArray(data.products)
        ? normalizeProductsForCurrency(data.products as Product[], buyerContext.currency)
        : []

      // Sort products by converted price ascending (lowest to highest)
      if (products.length > 0) {
        products = [...products].sort((a, b) => {
          const priceA = convertCurrencyAmount(
            Number(a.price),
            a.base_currency || a.currency || 'USD',
            buyerContext.currency,
            rates
          )
          const priceB = convertCurrencyAmount(
            Number(b.price),
            b.base_currency || b.currency || 'USD',
            buyerContext.currency,
            rates
          )
          return priceA - priceB
        })
      }

      rememberSearch(messageText, products.length)
      setMessages(previous => [
        ...previous,
        {
          role: 'assistant',
          content: data.text,
          products,
          searchQuery: data.searchQuery,
          budgetMax: data.budgetMax,
          isClothing: data.isClothing,
        },
      ])
      setHistory(previous => [
        ...previous,
        { role: 'user', content: messageText },
        {
          role: 'assistant',
          content: data.text,
          products,
          searchQuery: data.searchQuery,
          budgetMax: data.budgetMax,
          isClothing: data.isClothing,
        },
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

  async function loadMoreProducts(messageIndex: number) {
    const msg = messages[messageIndex]
    if (!msg || loading) return

    // Set loading state for this message
    if (containerRef.current) {
      prevScrollTopRef.current = containerRef.current.scrollTop
    }
    setMessages(prev => prev.map((m, idx) => idx === messageIndex ? { ...m, loadingMore: true } : m))

    try {
      // Re-create history up to this message's turn
      const historyUpToMessage = history.slice(0, messageIndex)

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'more',
          searchQuery: msg.searchQuery,
          budgetMax: msg.budgetMax,
          isClothing: msg.isClothing,
          history: historyUpToMessage,
          savedProducts,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Request failed')

      let newProducts = Array.isArray(data.products)
        ? normalizeProductsForCurrency(data.products as Product[], buyerContext.currency)
        : []

      // Sort products by price
      if (newProducts.length > 0) {
        newProducts = [...newProducts].sort((a, b) => {
          const priceA = convertCurrencyAmount(Number(a.price), a.base_currency || a.currency || 'USD', buyerContext.currency, rates)
          const priceB = convertCurrencyAmount(Number(b.price), b.base_currency || b.currency || 'USD', buyerContext.currency, rates)
          return priceA - priceB
        })
      }

      // Record scroll position before state update to prevent scroll jump
      if (containerRef.current) {
        prevScrollTopRef.current = containerRef.current.scrollTop
      }

      // Append new products to this message and turn off loading
      setMessages(prev => prev.map((m, idx) => {
        if (idx === messageIndex) {
          const existingIds = new Set((m.products || []).map(p => p.id))
          const uniqueNew = newProducts.filter(p => !existingIds.has(p.id))
          return {
            ...m,
            products: [...(m.products || []), ...uniqueNew],
            loadingMore: false,
            hasNoMore: uniqueNew.length === 0
          }
        }
        return m
      }))

      // Also update history to keep it synced (history index is messageIndex - 1)
      const historyIndex = messageIndex - 1;
      setHistory(prev => prev.map((h, idx) => {
        if (idx === historyIndex) {
          const existingIds = new Set((h.products || []).map(p => p.id))
          const uniqueNew = newProducts.filter(p => !existingIds.has(p.id))
          return {
            ...h,
            products: [...(h.products || []), ...uniqueNew]
          } as any
        }
        return h
      }))

    } catch (e) {
      console.error('Error loading more products:', e)
      if (containerRef.current) {
        prevScrollTopRef.current = containerRef.current.scrollTop
      }
      setMessages(prev => prev.map((m, idx) => idx === messageIndex ? { ...m, loadingMore: false } : m))
    }
  }

  function renderDiscoverView() {
    return (
      <>
        <div ref={containerRef} className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-10 flex flex-col gap-4 md:gap-6">
          {!hasConversation && (
            <DiscoverView buyerContext={buyerContext} sendMessage={sendMessage} />
          )}

          {hasConversation && messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              id={index === messages.length - 1 ? 'latest-message' : undefined}
              className={`fade-in flex flex-col gap-[14px] ${
                message.role === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div
                className={`max-w-[88%] md:max-w-[64%] p-[10px_14px] md:p-[12px_18px] text-[12.5px] md:text-[13.5px] leading-[1.72] ${
                  message.role === 'user'
                    ? 'rounded-[18px_18px_4px_18px] bg-[var(--m-green)] text-[var(--bg-white)]'
                    : 'rounded-[18px_18px_18px_4px] bg-[var(--bg-card)] text-[var(--ink)] border border-[var(--m-border)]'
                }`}
              >
                {message.content}
              </div>

              {message.products && message.products.length > 0 ? (
                <div className="flex flex-col gap-4 w-full">
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(min(240px,100%),1fr))] gap-[10px] w-full">
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
                  {message.loadingMore && (
                    <div className="flex gap-[5px] p-[12px_18px] bg-[var(--bg-card)] border border-[var(--m-border)] rounded-[18px_18px_18px_4px] w-fit mt-2">
                      {[0, 0.18, 0.36].map(delay => (
                        <div
                          key={delay}
                          className="w-[5px] h-[5px] rounded-full bg-[var(--ink3)]"
                          style={{
                            animation: `bounce 1.1s ${delay}s ease-in-out infinite`,
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          ))}

          {loading && (
            <div className="flex gap-[5px] p-[12px_18px] bg-[var(--bg-card)] border border-[var(--m-border)] rounded-[18px_18px_18px_4px] w-fit">
              {[0, 0.18, 0.36].map(delay => (
                <div
                  key={delay}
                  className="w-[5px] h-[5px] rounded-full bg-[var(--ink3)]"
                  style={{
                    animation: `bounce 1.1s ${delay}s ease-in-out infinite`,
                  }}
                />
              ))}
            </div>
          )}
        </div>

        <footer className="flex-shrink-0 border-t border-[var(--m-border)] p-[8px_10px_18px] md:p-[14px_28px_20px] bg-[rgba(255,255,255,0.85)] md:bg-[var(--bg)] backdrop-blur-[12px] md:backdrop-blur-none pb-[max(16px,env(safe-area-inset-bottom))] md:pb-[20px]">
          <div className="flex items-center gap-2 md:gap-3 bg-[var(--bg-card)] border border-[var(--m-border)] rounded-[24px] p-[8px_8px_8px_14px] md:p-[10px_10px_10px_20px] shadow-[0_4px_12px_rgba(0,0,0,0.03)] w-full max-w-[900px] mx-auto">
            <input
              ref={inputRef}
              value={input}
              onChange={event => setInput(event.target.value)}
              onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => event.key === 'Enter' && !event.shiftKey && sendMessage()}
              placeholder={isMobile ? "Search products..." : "Search by product, material, budget, or intended use"}
              className="flex-1 min-w-0 border-none bg-transparent text-[16px] md:text-[14px] text-[var(--ink)] outline-none"
            />
            <button
              type="button"
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              className={`flex-shrink-0 flex items-center justify-center w-[48px] h-[48px] md:w-[42px] md:h-[42px] rounded-[18px] border-none transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                loading || !input.trim()
                  ? 'bg-[var(--m-border)] cursor-default shadow-none'
                  : 'bg-[var(--m-green)] cursor-pointer shadow-[0_4px_10px_rgba(90,154,90,0.3)]'
              }`}
            >
              {loading ? (
                <div className="w-[14px] h-[14px] rounded-full border-[1.5px] border-[rgba(255,255,255,0.3)] border-t-white animate-spin" />
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
      <div className="flex-1 overflow-y-auto p-[20px_24px] md:p-[32px_36px]">
        <div className="mb-[18px] md:mb-[24px]">
          <div className="font-[var(--serif)] text-[28px] md:text-[34px] leading-[1.08] mb-[6px]">Search history</div>
          <p className="text-[13px] text-[var(--ink3)] leading-[1.7]">
            Re-run recent searches and continue refining them in the chat.
          </p>
        </div>

        {searchHistory.length === 0 ? (
          <div className="bg-[var(--bg-card)] border border-[var(--m-border)] rounded-[16px] p-[32px_28px] text-[var(--ink3)] text-[13px] leading-[1.8]">
            No searches yet. Your recent queries will appear here after you run them.
          </div>
        ) : (
          <div className="grid gap-[12px]">
            {searchHistory.map(entry => (
              <button
                key={entry.id}
                type="button"
                onClick={() => sendMessage(entry.query)}
                className="text-left bg-[var(--bg-card)] border border-[var(--m-border)] rounded-[16px] p-[18px_18px_16px] cursor-pointer hover:bg-[rgba(0,0,0,0.02)] transition-colors"
              >
                <div className="flex justify-between gap-[16px] mb-[6px] items-start">
                  <div className="text-[14px] font-medium text-[var(--ink)] min-w-0">{entry.query}</div>
                  <div className="text-[11px] text-[var(--ink3)] whitespace-nowrap shrink-0">{formatTime(entry.createdAt)}</div>
                </div>
                <div className="text-[12px] text-[var(--ink3)]">
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
      <div className="flex-1 overflow-y-auto p-[20px_24px] md:p-[32px_36px]">
        <div className="flex justify-between items-end gap-[16px] mb-[18px] md:mb-[24px]">
          <div>
            <div className="font-[var(--serif)] text-[28px] md:text-[34px] leading-[1.08] mb-[6px]">Saved products</div>
            <p className="text-[13px] text-[var(--ink3)] leading-[1.7]">
              Keep promising products here while you compare stores and decide what to open next.
            </p>
          </div>
          {savedProducts.length > 0 && (
            <button
              type="button"
              onClick={() => setSavedProducts([])}
              className="border border-[var(--m-border)] bg-transparent rounded-[30px] p-[8px_16px] text-[12px] text-[var(--ink)] cursor-pointer hover:bg-[rgba(0,0,0,0.02)] transition-colors"
            >
              Clear saved
            </button>
          )}
        </div>

        {savedProducts.length === 0 ? (
          <div className="bg-[var(--bg-card)] border border-[var(--m-border)] rounded-[16px] p-[32px_28px] text-[var(--ink3)] text-[13px] leading-[1.8]">
            No saved products yet. Use the save action on any search result to keep it here.
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] gap-[12px]">
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
    <div className="flex h-[100dvh] max-w-full bg-[var(--bg)] overflow-hidden">
      {/* Mobile Drawer Overlay */}
      {isMobile && isSidebarOpen && (
        <button
          type="button"
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-[rgba(0,0,0,0.35)] border-none outline-none cursor-pointer"
          style={{ zIndex: 900, cursor: 'pointer' }}
        />
      )}

      <aside
        className={`bg-[var(--m-green)] flex flex-col shrink-0 gap-[8px] h-[100dvh] top-0 py-[22px] transition-transform duration-300 ease-in-out ${
          isMobile
            ? `fixed w-[280px] items-stretch left-0 ${isSidebarOpen ? 'translate-x-0 shadow-[20px_0_50px_rgba(0,0,0,0.15)]' : 'translate-x-[-110%]'}`
            : 'relative w-[72px] items-center'
        }`}
        style={{ zIndex: 1000 }}
      >
        <div className={`mb-[24px] flex items-center ${isMobile ? 'px-[24px] justify-between' : 'justify-center'}`}>
          <div className="flex items-center gap-[10px]">
            <img src="/logo.png" alt="From Logo" className="w-[28px] h-[28px] object-contain" />
            {isMobile && <span className="font-[var(--serif)] text-[18px] text-[var(--bg-white)]">From</span>}
          </div>
          {isMobile && (
            <button
              type="button"
              onClick={() => setIsSidebarOpen(false)}
              className="bg-transparent border-none text-[var(--bg-white)] cursor-pointer p-[12px] -mr-[12px]"
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
              className={`h-[44px] rounded-[14px] flex items-center gap-[12px] cursor-pointer border-none transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:opacity-100 ${
                isMobile ? 'w-auto justify-start px-[24px] mx-[12px]' : 'w-[44px] justify-center px-0 mx-0'
              } ${
                isActive ? 'text-[var(--m-green)] bg-[var(--bg-white)] opacity-100' : 'text-[var(--bg-white)] bg-transparent opacity-70'
              }`}
            >
              <span className="w-[20px] h-[20px] flex shrink-0">{item.icon}</span>
              {isMobile && <span className="text-[15px] font-medium">{item.label}</span>}
            </button>
          )
        })}

        <div className={`mt-auto flex flex-col gap-[20px] ${isMobile ? 'px-[24px] items-start' : 'px-0 items-center'}`}>
          <div className={isMobile ? 'text-left' : 'text-center'}>
            <div className="text-[10px] tracking-[0.1em] text-[rgba(255,255,255,0.5)] uppercase mb-[4px]">Region</div>
            <div className="text-[12px] font-semibold text-[var(--bg-white)] flex items-center gap-[6px]">
              <span className="w-[6px] h-[6px] rounded-full bg-[#6edba8]" />
              {buyerContext.country}
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative min-w-0">
        {isMobile && (
          <header className="h-[56px] flex items-center px-[16px] border-b border-[var(--m-border)] bg-[var(--bg)] shrink-0">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="bg-transparent border-none text-[var(--ink)] p-[12px] -ml-[12px] cursor-pointer"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12h18M3 6h18M3 18h18" />
              </svg>
            </button>
            <div className="ml-[8px] font-[var(--serif)] text-[17px] font-medium">From</div>
            {hasConversation && (
              <button
                type="button"
                onClick={resetConversation}
                className="ml-auto bg-transparent border-none text-[var(--m-green)] text-[13px] font-medium cursor-pointer"
              >
                New search
              </button>
            )}
          </header>
        )}

        {!isMobile && hasConversation && (
          <header className="absolute top-0 left-0 right-0 h-[64px] flex items-center px-[32px] z-[10] pointer-events-none">
            <button
              type="button"
              onClick={resetConversation}
              className="pointer-events-auto ml-auto bg-[var(--bg-card)] border border-[var(--m-border)] rounded-[30px] p-[8px_20px] text-[12px] font-medium text-[var(--ink2)] cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:bg-[rgba(0,0,0,0.02)] transition-colors"
            >
              New search
            </button>
          </header>
        )}

        {activeView === 'discover' && renderDiscoverView()}
        {activeView === 'history' && renderHistoryView()}
        {activeView === 'saved' && renderSavedView()}

        {selectedProduct && (
          <ProductDrawer
            product={selectedProduct}
            rates={rates}
            onClose={() => setSelectedProduct(null)}
          />
        )}
      </main>
    </div>
  )
}
