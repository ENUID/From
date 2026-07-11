// ── PARKED, NOT LIVE ──────────────────────────────────────────────────────
// This was the home page's grid-search state/actions (`sendMessage`,
// `loadMoreProducts`, search history) before FROM unified onto a single
// conversational surface (Fabrics). Nothing in the live app imports this
// file — it is not wired up, not reachable, not running. Kept verbatim (as
// a self-contained hook) because it's a complete, working grid-search +
// pagination + history pipeline that may be useful groundwork for a future,
// different feature. Its backend counterpart is
// `web/lib/_parked/ai-chat-route.ts` (also parked, also not live) — to
// resurrect this pairing, move that file back under `app/api/<name>/route.ts`
// and import this hook from a live component.
// ─────────────────────────────────────────────────────────────────────────
'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@convex/_generated/api'
import { Product } from '@/components/ProductCard'
import type { ShopperContext } from '@/lib/shopperContext'
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
  productsLoading?: boolean   // true while SSE products event hasn't arrived yet
}

export type ConversationTurn = Pick<
  Message,
  'role' | 'content' | 'products' | 'searchQuery' | 'budgetMax' | 'budgetCurrency' | 'isClothing' | 'sort' | 'suggestions'
>

export type SearchHistoryEntry = {
  id: string
  query: string
  createdAt: number
  resultCount: number
}

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

export function useLegacySearch(initialShopperContext: ShopperContext, initialRates: ExchangeRates, savedProducts: Product[]) {
  const { data: session } = useSession()
  const userEmail = session?.user?.email ?? undefined

  const convexSearchHistory = useQuery(api.shop.getSearchHistory, userEmail ? { userEmail } : "skip")
  const saveConvexHistory = useMutation(api.shop.saveSearchHistory)
  const deleteConvexHistory = useMutation(api.shop.deleteSearchHistory)

  const deletedHistoryIds = useRef<Set<string>>(new Set())

  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE])
  const [history, setHistory] = useState<ConversationTurn[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [searchHistory, setSearchHistory] = useState<SearchHistoryEntry[]>([])
  const [shopperContext] = useState(initialShopperContext)
  const [rates] = useState(initialRates)

  const hasConversation = messages.some(message => message.role === 'user')

  useEffect(() => {
    try {
      const historyRaw = window.localStorage.getItem(HISTORY_KEY)
      if (historyRaw) setSearchHistory(JSON.parse(historyRaw) as SearchHistoryEntry[])
    } catch {
      window.localStorage.removeItem(HISTORY_KEY)
    }
  }, [])

  useEffect(() => {
    if (convexSearchHistory) {
      setSearchHistory(convexSearchHistory.filter(h => !deletedHistoryIds.current.has(h.id)))
    }
  }, [convexSearchHistory])

  useEffect(() => {
    try { window.localStorage.setItem(HISTORY_KEY, JSON.stringify(searchHistory)) } catch {}
  }, [searchHistory])

  function resetConversation() {
    if (loading) return
    setMessages([INITIAL_MESSAGE])
    setHistory([])
    setInput('')
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
    if (userEmail) deleteConvexHistory({ userEmail, id }).catch(() => {})
  }

  function renameHistoryEntry(id: string, newQuery: string) {
    setSearchHistory(prev => prev.map(item => item.id === id ? { ...item, query: newQuery } : item))
  }

  async function sendMessage(text?: string, opts?: { skipHistory?: boolean }) {
    const messageText = text ?? input.trim()
    if (!messageText || loading) return

    setInput('')
    setLoading(true)
    setMessages(previous => [...previous, { role: 'user', content: messageText }])

    const lastSearchQuery = [...messages].reverse()
      .find(m => m.role === 'assistant' && typeof m.searchQuery === 'string' && m.searchQuery.trim())?.searchQuery

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText,
          history: buildApiHistory(history),
          savedProducts,
          buyerCurrency: shopperContext.currency,
          buyerCountry: shopperContext.country,
          userName: typeof window !== 'undefined' ? (window.localStorage.getItem('from_user_name') || undefined) : undefined,
          recentSearches: searchHistory.slice(0, 8).map(entry => entry.query),
          lastSearchQuery,
        }),
        signal: AbortSignal.timeout(CHAT_REQUEST_TIMEOUT_MS),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error((errData as any).error ?? 'Request failed')
      }

      const contentType = res.headers.get('content-type') ?? ''

      if (contentType.includes('text/event-stream') && res.body) {
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buf = ''
        let assistantMsgAdded = false
        let isFirstMsg = messages.filter(m => m.role === 'user').length === 1

        const handleEvent = (data: any) => {
          if (data.type === 'text') {
            setLoading(false)
            assistantMsgAdded = true
            setMessages(prev => [
              ...prev,
              {
                role: 'assistant' as const,
                content: data.text ?? '',
                products: [],
                suggestions: data.suggestions ?? [],
                productsLoading: true,
              },
            ])
          } else if (data.type === 'products') {
            const products = Array.isArray(data.products)
              ? normalizeProductsForCurrency(data.products as Product[], shopperContext.currency)
              : []

            if (!opts?.skipHistory && isFirstMsg) rememberSearch(messageText, products.length)

            if (assistantMsgAdded) {
              setMessages(prev => {
                const idx = prev.reduceRight((found: number, m: Message, i: number) => found === -1 && m.role === 'assistant' ? i : found, -1)
                if (idx === -1) return prev
                return prev.map((m, i) => i === idx ? {
                  ...m,
                  content: data.text ?? m.content,
                  products,
                  searchQuery: data.searchQuery,
                  budgetMax: data.budgetMax,
                  budgetCurrency: data.budgetCurrency,
                  isClothing: data.isClothing,
                  sort: data.sort,
                  suggestions: data.suggestions ?? m.suggestions ?? [],
                  productsLoading: false,
                } : m)
              })
              setHistory(prev => [
                ...prev,
                { role: 'user', content: messageText },
                {
                  role: 'assistant',
                  content: data.text ?? '',
                  products,
                  searchQuery: data.searchQuery,
                  budgetMax: data.budgetMax,
                  budgetCurrency: data.budgetCurrency,
                  isClothing: data.isClothing,
                  sort: data.sort,
                  suggestions: data.suggestions ?? [],
                },
              ])
            } else {
              setLoading(false)
              assistantMsgAdded = true
              setMessages(prev => [
                ...prev,
                {
                  role: 'assistant' as const,
                  content: data.text ?? '',
                  products,
                  searchQuery: data.searchQuery,
                  budgetMax: data.budgetMax,
                  budgetCurrency: data.budgetCurrency,
                  isClothing: data.isClothing,
                  sort: data.sort,
                  suggestions: data.suggestions ?? [],
                  productsLoading: false,
                },
              ])
              setHistory(prev => [
                ...prev,
                { role: 'user', content: messageText },
                {
                  role: 'assistant',
                  content: data.text ?? '',
                  products,
                  searchQuery: data.searchQuery,
                  budgetMax: data.budgetMax,
                  budgetCurrency: data.budgetCurrency,
                  isClothing: data.isClothing,
                  sort: data.sort,
                  suggestions: data.suggestions ?? [],
                },
              ])
            }
          } else if (data.type === 'error') {
            setLoading(false)
            if (!assistantMsgAdded) {
              assistantMsgAdded = true
              setMessages(prev => [
                ...prev,
                { role: 'assistant' as const, content: data.message ?? 'Search failed. Please try again.', products: [] },
              ])
            }
          }
        }

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buf += decoder.decode(value, { stream: true })
          const parts = buf.split('\n\n')
          buf = parts.pop() ?? ''
          for (const part of parts) {
            for (const line of part.split('\n')) {
              if (line.startsWith('data: ')) {
                try { handleEvent(JSON.parse(line.slice(6))) } catch {}
              }
            }
          }
        }
        if (buf.trim()) {
          for (const line of buf.split('\n')) {
            if (line.startsWith('data: ')) {
              try { handleEvent(JSON.parse(line.slice(6))) } catch {}
            }
          }
        }
      } else {
        const data = await res.json()
        const products = Array.isArray(data.products)
          ? normalizeProductsForCurrency(data.products as Product[], shopperContext.currency)
          : []
        const isFirstMsg = messages.filter(m => m.role === 'user').length === 1
        if (!opts?.skipHistory && isFirstMsg) rememberSearch(messageText, products.length)
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
      }
    } catch (error: unknown) {
      const timedOut = error instanceof Error && error.name === 'TimeoutError'
      setMessages(previous => [
        ...previous,
        {
          role: 'assistant',
          content: timedOut
            ? 'The search timed out. Please try again — it\'s usually faster after the first load.'
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
          buyerCountry: shopperContext.country,
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
    hasConversation,
    searchHistory,
    resetConversation,
    sendMessage,
    loadMoreProducts,
    deleteHistoryEntry,
    renameHistoryEntry,
  }
}
