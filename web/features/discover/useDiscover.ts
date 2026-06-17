'use client'
import { useState, useCallback, useRef } from 'react'
import type { DiscoverProduct, Gender } from './types'

const PAGE_SIZE = 24

export function useDiscover(style: string, gender: Gender) {
  const [products, setProducts]   = useState<DiscoverProduct[]>([])
  const [loading, setLoading]     = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [empty, setEmpty]         = useState(false)
  const offsetRef = useRef(0)
  const activeKey = useRef('')

  const load = useCallback(async (reset = false) => {
    const key = `${style}|${gender}`

    if (reset) {
      activeKey.current = key
      offsetRef.current = 0
      setProducts([])
      setHasMore(true)
      setError(null)
      setEmpty(false)
      setLoading(true)
    } else {
      if (!hasMore || loadingMore) return
      setLoadingMore(true)
    }

    const offset = reset ? 0 : offsetRef.current
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) })
    if (style) params.set('style', style)
    if (gender !== 'all') params.set('gender', gender)

    try {
      const res = await fetch(`/api/v2/discover?${params}`)
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json() as { products: DiscoverProduct[]; meta: { mode: string } }

      if (activeKey.current !== key && !reset) return

      const fresh = data.products ?? []
      setProducts(prev => reset ? fresh : [...prev, ...fresh])
      offsetRef.current = offset + fresh.length
      setHasMore(fresh.length === PAGE_SIZE)
      setEmpty(fresh.length === 0 && offset === 0)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [style, gender, hasMore, loadingMore])

  const loadMore = useCallback(() => load(false), [load])
  const refresh  = useCallback(() => load(true),  [load])

  return { products, loading, loadingMore, hasMore, error, empty, refresh, loadMore }
}
