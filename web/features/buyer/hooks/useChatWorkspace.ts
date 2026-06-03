'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { Product } from '@/components/ProductCard'
import type { BuyerContext } from '@/lib/buyerContext'
import { ExchangeRates } from '@/lib/exchangeRates'

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

export function useChatWorkspace(initialBuyerContext: BuyerContext, initialRates: ExchangeRates) {
  const { data: session } = useSession()
  const userEmail = session?.user?.email ?? undefined

  const convexSavedProducts = useQuery(api.buyer.getSavedProducts, userEmail ? { userEmail } : "skip")
  const convexSearchHistory = useQuery(api.buyer.getSearchHistory, userEmail ? { userEmail } : "skip")
  const toggleConvexSaved = useMutation(api.buyer.toggleSavedProduct)
  const saveConvexHistory = useMutation(api.buyer.saveSearchHistory)

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

  function clearSavedProducts() {
    setSavedProducts([])
    if (userEmail) {
      // Handle clearing convex saved products if necessary, but for now just local clear
    }
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
        body: JSON.stringify({
          message: messageText,
          history: buildApiHistory(history),
          savedProducts,
          buyerCurrency: buyerContext.currency,
        }),
        signal: AbortSignal.timeout(CHAT_REQUEST_TIMEOUT_MS),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Request failed')

      let products = Array.isArray(data.products)
        ? normalizeProductsForCurrency(data.products as Product[], buyerContext.currency)
        : []

      rememberSearch(messageText, products.length)
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
          buyerCurrency: buyerContext.currency,
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
        ? normalizeProductsForCurrency(data.products as Product[], buyerContext.currency)
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
    buyerContext,
    rates,
    hasConversation,
    savedIds,
    resetConversation,
    toggleSaved,
    clearSavedProducts,
    sendMessage,
    loadMoreProducts,
  }
}
