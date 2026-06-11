'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { Product } from '@/components/ProductCard'
import type { ShopperContext } from '@/lib/shopperContext'
import { ExchangeRates } from '@/lib/exchangeRates'
import { useSubscription } from '@/hooks/useSubscription'

export interface Message {
  role: 'user' | 'assistant'
  content: string
  products?: Product[]
  loadingMore?: boolean
  hasNoMore?: boolean
  searchQuery?: string
  budgetMax?: number | null
  budgetCurrency?: string
  isClothing?: boolean
  sort?: 'price_asc' | 'price_desc' | 'relevance'
  suggestions?: string[]
}

export type ConversationTurn = Pick<
  Message,
  'role' | 'content' | 'products' | 'searchQuery' | 'budgetMax' | 'budgetCurrency' | 'isClothing' | 'sort' | 'suggestions'
>

export type View = 'discover' | 'history' | 'saved'

export type SearchHistoryEntry = {
  id: string
  query: string
  createdAt: number
  resultCount: number
}

const SAVED_KEY = 'from:saved-products'
const HISTORY_KEY = 'from:search-history'
const CHAT_REQUEST_TIMEOUT_MS = 28_000

const INITIAL_MESSAGE: Message = {
  role: 'assistant',
  content: 'Search across connected independent stores in plain language. Describe the item, budget, material, or intended use to get started.',
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

function buildApiHistory(history: ConversationTurn[]) {
  return history.map(turn => ({
    role: turn.role,
    content: turn.content,
    products: (turn.products || []).map(product => ({
      id: product.id,
      title: product.title,
      vendor: product.vendor,
      price: product.price,
      currency: product.currency || product.base_currency,
    })),
  }))
}

export function useFromChat(initialShopperContext: ShopperContext, initialRates: ExchangeRates) {
  const { data: session } = useSession()
  const userEmail = session?.user?.email ?? undefined

  const convexSavedProducts = useQuery(api.shop.getSavedProducts, userEmail ? { userEmail } : "skip")
  const convexSearchHistory = useQuery(api.shop.getSearchHistory, userEmail ? { userEmail } : "skip")
  const toggleConvexSaved = useMutation(api.shop.toggleSavedProduct)
  const saveConvexHistory = useMutation(api.shop.saveSearchHistory)

  // Track locally-deleted IDs so any Convex re-sync cannot resurrect them this session.
  const deletedHistoryIds = useRef<Set<string>>(new Set())
  const removedSavedIds   = useRef<Set<string>>(new Set())

  const { isPremium, canSearch, dailySearchesRemaining } = useSubscription()

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
  const [shopperContext] = useState(initialShopperContext)
  const [rates] = useState(initialRates)
  const [showUpgradeSheet, setShowUpgradeSheet] = useState(false)

  const hasConversation = messages.some(message => message.role === 'user')

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    try {
      const savedRaw = window.localStorage.getItem(SAVED_KEY)
      const historyRaw = window.localStorage.getItem(HISTORY_KEY)
      if (savedRaw) {
        const saved = JSON.parse(savedRaw) as Product[]
        setSavedProducts(normalizeProductsForCurrency(saved, shopperContext.currency))
      }
      if (historyRaw) setSearchHistory(JSON.parse(historyRaw) as SearchHistoryEntry[])
    } catch {
      window.localStorage.removeItem(SAVED_KEY)
      window.localStorage.removeItem(HISTORY_KEY)
    }
  }, [shopperContext.currency])

  useEffect(() => {
    if (convexSavedProducts) {
      const filtered = convexSavedProducts.filter(p => !removedSavedIds.current.has(p.id))
      setSavedProducts(normalizeProductsForCurrency(filtered, shopperContext.currency))
    }
  }, [convexSavedProducts, shopperContext.currency])

  useEffect(() => {
    if (convexSearchHistory) {
      setSearchHistory(convexSearchHistory.filter(h => !deletedHistoryIds.current.has(h.id)))
    }
  }, [convexSearchHistory])

  // Always persist to localStorage regardless of login state — deletions must
  // survive refresh even when the user is signed in and Convex is slow/unavailable.
  useEffect(() => {
    try { window.localStorage.setItem(SAVED_KEY, JSON.stringify(savedProducts)) } catch {}
  }, [savedProducts])

  useEffect(() => {
    try { window.localStorage.setItem(HISTORY_KEY, JSON.stringify(searchHistory)) } catch {}
  }, [searchHistory])

  const savedIds = new Set(savedProducts.map(product => product.id))

  function resetConversation() {
    if (loading) return
    setMessages([INITIAL_MESSAGE])
    setHistory([])
    setInput('')
    setActiveView('discover')
    setIsSidebarOpen(false)
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

  function deleteHistoryEntry(id: string) {
    deletedHistoryIds.current.add(id)
    setSearchHistory(prev => prev.filter(item => item.id !== id))
  }

  function renameHistoryEntry(id: string, newQuery: string) {
    setSearchHistory(prev => prev.map(item => item.id === id ? { ...item, query: newQuery } : item))
  }

  function toggleSaved(product: Product) {
    const isRemoving = savedProducts.some(item => item.id === product.id)
    if (isRemoving) removedSavedIds.current.add(product.id)
    else removedSavedIds.current.delete(product.id)
    if (userEmail) {
      toggleConvexSaved({ userEmail, product })
    }
    setSavedProducts(previous => {
      const normalizedProduct = normalizeProductForCurrency(product, shopperContext.currency)
      const exists = previous.some(item => item.id === product.id)
      if (exists) return previous.filter(item => item.id !== product.id)
      return [normalizedProduct, ...previous]
    })
  }

  function clearSavedProducts() {
    setSavedProducts([])
    if (userEmail) {
      // Handle clearing convex saved products if necessary, but for now just local clear
    }
  }

  async function sendMessage(text?: string, opts?: { skipHistory?: boolean }) {
    const messageText = text ?? input.trim()
    if (!messageText || loading) return

    // Paywall gate: block free-tier users who have hit their daily limit
    const isFirstMessage = !messages.some(m => m.role === 'user')
    if (isFirstMessage && !canSearch) {
      setShowUpgradeSheet(true)
      return
    }

    setActiveView('discover')
    setInput('')
    setLoading(true)
    setMessages(previous => [...previous, { role: 'user', content: messageText }])

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText,
          history: buildApiHistory(history),
          savedProducts,
          buyerCurrency: shopperContext.currency,
          userName: typeof window !== 'undefined' ? (window.localStorage.getItem('from_user_name') || undefined) : undefined,
          recentSearches: searchHistory.slice(0, 8).map(entry => entry.query),
        }),
        signal: AbortSignal.timeout(CHAT_REQUEST_TIMEOUT_MS),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Request failed')

      let products = Array.isArray(data.products)
        ? normalizeProductsForCurrency(data.products as Product[], shopperContext.currency)
        : []

      if (!opts?.skipHistory && isFirstMessage) rememberSearch(messageText, products.length)
      setMessages(previous => [
        ...previous,
        {
          role: 'assistant',
          content: data.text,
          products,
          searchQuery: data.searchQuery,
          budgetMax: data.budgetMax,
          budgetCurrency: data.budgetCurrency,
          isClothing: data.isClothing,
          sort: data.sort,
          suggestions: data.suggestions,
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
          budgetCurrency: data.budgetCurrency,
          isClothing: data.isClothing,
          sort: data.sort,
          suggestions: data.suggestions,
        },
      ])
    } catch (error: unknown) {
      const timedOut = error instanceof Error && error.name === 'TimeoutError'
      setMessages(previous => [
        ...previous,
        {
          role: 'assistant',
          content: timedOut
            ? 'Yêu cầu mất quá nhiều thời gian. Vui lòng thử lại — lần sau thường nhanh hơn nhờ cache.'
            : 'The search request did not complete. Please try again in a moment.',
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  async function loadMoreProducts(messageIndex: number) {
    const msg = messages[messageIndex]
    if (!msg || loading || msg.loadingMore || msg.hasNoMore || !msg.searchQuery) return

    setMessages(prev => prev.map((m, idx) => idx === messageIndex ? { ...m, loadingMore: true } : m))

    try {
      const currentExcludeIds = (msg.products || []).map(p => p.id)

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'more',
          searchQuery: msg.searchQuery,
          budgetMax: msg.budgetMax,
          budgetCurrency: msg.budgetCurrency,
          buyerCurrency: shopperContext.currency,
          isClothing: msg.isClothing,
          sort: msg.sort,
          history: buildApiHistory(history),
          currentExcludeIds,
          savedProducts,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Request failed')

      let newProducts = Array.isArray(data.products)
        ? normalizeProductsForCurrency(data.products as Product[], shopperContext.currency)
        : []

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

      const historyIndex = messageIndex - 1
      setHistory(prev => prev.map((h, idx) => {
        if (idx === historyIndex) {
          const existingIds = new Set((h.products || []).map(p => p.id))
          const uniqueNew = newProducts.filter(p => !existingIds.has(p.id))
          return {
            ...h,
            products: [...(h.products || []), ...uniqueNew]
          }
        }
        return h
      }))

    } catch (e) {
      console.error('Error loading more products:', e)
      setMessages(prev => prev.map((m, idx) => idx === messageIndex ? { ...m, loadingMore: false } : m))
    }
  }

  return {
    messages,
    input,
    setInput,
    loading,
    activeView,
    setActiveView,
    savedProducts,
    selectedProduct,
    setSelectedProduct,
    searchHistory,
    isSidebarOpen,
    setIsSidebarOpen,
    isMobile,
    shopperContext,
    rates,
    hasConversation,
    savedIds,
    resetConversation,
    toggleSaved,
    clearSavedProducts,
    sendMessage,
    loadMoreProducts,
    deleteHistoryEntry,
    renameHistoryEntry,
    isPremium,
    dailySearchesRemaining,
    showUpgradeSheet,
    setShowUpgradeSheet,
  }
}
