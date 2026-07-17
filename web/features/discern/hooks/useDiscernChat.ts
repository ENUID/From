'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { Product } from '@/components/ProductCard'
import type { ShopperContext } from '@/lib/shopperContext'
import { ExchangeRates } from '@/lib/exchangeRates'
import { useSubscription } from '@/hooks/useSubscription'
import { useConvexAuthProof } from '@/hooks/useConvexAuthProof'

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
  const authProof = useConvexAuthProof(userEmail)

  const convexSavedProducts = useQuery(api.shop.getSavedProducts, userEmail && authProof ? { userEmail, authProof } : "skip")
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

  // Once we know the account's Convex bag, reconcile the local one into it.
  const reconciledSavesOnLogin = useRef(false)
  useEffect(() => {
    if (!convexSavedProducts) return
    const convexClean = convexSavedProducts.filter(p => !removedSavedIds.current.has(p.id))
    if (userEmail && authProof && !reconciledSavesOnLogin.current) {
      // FIRST authenticated load: items saved on this device while logged out
      // exist only in localStorage. Upload the ones the account doesn't have yet
      // (toggle inserts when absent) so they persist to the account and show up
      // on every other device signed into the same email — then MERGE rather
      // than replace, so nothing local is dropped on sign-in.
      reconciledSavesOnLogin.current = true
      setSavedProducts(prev => {
        const convexIds = new Set(convexClean.map(p => p.id))
        const localOnly = prev.filter(p => !convexIds.has(p.id) && !removedSavedIds.current.has(p.id))
        for (const p of localOnly) toggleConvexSaved({ userEmail, product: p, authProof }).catch(() => {})
        const seen = new Set<string>()
        const merged: Product[] = []
        for (const p of [...localOnly, ...convexClean]) {
          if (seen.has(p.id)) continue
          seen.add(p.id)
          merged.push(normalizeProductForCurrency(p, shopperContext.currency))
        }
        return merged
      })
    } else {
      // After the initial reconcile, Convex is the source of truth — a save or
      // unsave on ANY device flows here through the live query.
      setSavedProducts(normalizeProductsForCurrency(convexClean, shopperContext.currency))
    }
  }, [convexSavedProducts, shopperContext.currency, userEmail, authProof])

  // Always persist to localStorage regardless of login state — deletions must
  // survive refresh even when the user is signed in and Convex is slow/unavailable.
  useEffect(() => {
    try { window.localStorage.setItem(SAVED_KEY, JSON.stringify(savedProducts)) } catch {}
  }, [savedProducts])

  const savedIds = new Set(savedProducts.map(product => product.id))

  function toggleSaved(product: Product, query?: string) {
    const isRemoving = savedProducts.some(item => item.id === product.id)
    if (isRemoving) removedSavedIds.current.add(product.id)
    else removedSavedIds.current.delete(product.id)
    if (userEmail && authProof) {
      toggleConvexSaved({ userEmail, product, authProof, query }).catch(() => {})
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
