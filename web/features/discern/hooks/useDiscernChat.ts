'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { Product } from '@/components/ProductCard'
import type { ShopperContext } from '@/lib/shopperContext'
import { ExchangeRates } from '@/lib/exchangeRates'
import { useSubscription } from '@/hooks/useSubscription'

// Kept only so web/features/discern/components/DiscoverView.tsx (unmounted,
// dead component) keeps compiling — the search-history feature itself now
// lives in web/features/discern/hooks/_parked/useLegacySearch.ts.
export type SearchHistoryEntry = {
  id: string
  query: string
  createdAt: number
  resultCount: number
}

const SAVED_KEY = 'discern:saved-products'

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

export function useDiscernChat(initialShopperContext: ShopperContext, initialRates: ExchangeRates) {
  const { data: session } = useSession()
  const userEmail = session?.user?.email ?? undefined

  const convexSavedProducts = useQuery(api.shop.getSavedProducts, userEmail ? { userEmail } : "skip")
  const toggleConvexSaved = useMutation(api.shop.toggleSavedProduct)

  // Track locally-deleted IDs so any Convex re-sync cannot resurrect them this session.
  const removedSavedIds   = useRef<Set<string>>(new Set())

  const { isPremium, canSearch, dailySearchesRemaining } = useSubscription()

  const [input, setInput] = useState('')
  const [savedProducts, setSavedProducts] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [shopperContext] = useState(initialShopperContext)
  const [rates] = useState(initialRates)
  const [showUpgradeSheet, setShowUpgradeSheet] = useState(false)

  useEffect(() => {
    try {
      const savedRaw = window.localStorage.getItem(SAVED_KEY)
      if (savedRaw) {
        const saved = JSON.parse(savedRaw) as Product[]
        setSavedProducts(normalizeProductsForCurrency(saved, shopperContext.currency))
      }
    } catch {
      window.localStorage.removeItem(SAVED_KEY)
    }
  }, [shopperContext.currency])

  useEffect(() => {
    if (convexSavedProducts) {
      const filtered = convexSavedProducts.filter(p => !removedSavedIds.current.has(p.id))
      setSavedProducts(normalizeProductsForCurrency(filtered, shopperContext.currency))
    }
  }, [convexSavedProducts, shopperContext.currency])

  // Always persist to localStorage regardless of login state — deletions must
  // survive refresh even when the user is signed in and Convex is slow/unavailable.
  useEffect(() => {
    try { window.localStorage.setItem(SAVED_KEY, JSON.stringify(savedProducts)) } catch {}
  }, [savedProducts])

  const savedIds = new Set(savedProducts.map(product => product.id))

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
  }

  return {
    input,
    setInput,
    savedProducts,
    selectedProduct,
    setSelectedProduct,
    shopperContext,
    rates,
    savedIds,
    toggleSaved,
    clearSavedProducts,
    isPremium,
    dailySearchesRemaining,
    showUpgradeSheet,
    setShowUpgradeSheet,
  }
}
