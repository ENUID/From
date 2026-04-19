'use client'

import { Suspense, type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import type { Product } from '@/components/ProductCard'
import { loadProducts, loadStores, type MerchantStore } from '@/lib/merchantClient'

type Store = MerchantStore
type SyncStatus = 'idle' | 'syncing' | 'done' | 'error' | 'token_expired'
type NavPage = 'dashboard' | 'orders' | 'products' | 'analytics' | 'profile' | 'settings'
type ChartTab = 'categories' | 'pricing' | 'inventory'

type UserShape = {
  name: string
  email?: string | null
  image?: string | null
  id: string
}

type ChartPoint = {
  label: string
  primary: number
  secondary: number
}

type ChartDataset = {
  id: ChartTab
  label: string
  totalLabel: string
  totalValue: string
  primaryLabel: string
  secondaryLabel: string
  yearLabel: string
  points: ChartPoint[]
}

const buttonOutlineStyle: CSSProperties = {
  border: '1px solid var(--m-border)',
  background: 'transparent',
  borderRadius: 30,
  padding: '7px 16px',
  fontFamily: 'var(--sans)',
  fontSize: 12.5,
  color: 'var(--ink)',
  cursor: 'pointer',
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
}

const buttonPrimaryStyle: CSSProperties = {
  background: 'var(--m-green)',
  color: 'var(--bg-white)',
  border: 'none',
  borderRadius: 30,
  padding: '8px 18px',
  fontFamily: 'var(--sans)',
  fontSize: 12.5,
  fontWeight: 500,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  textDecoration: 'none',
}

const fieldLabelStyle: CSSProperties = {
  display: 'block',
  fontSize: 10,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'var(--ink3)',
  marginBottom: 8,
}

const fieldInputStyle: CSSProperties = {
  width: '100%',
  background: 'var(--bg)',
  border: '1px solid var(--m-border)',
  borderRadius: 8,
  padding: '11px 14px',
  fontFamily: 'var(--sans)',
  fontSize: 13.5,
  color: 'var(--ink)',
  outline: 'none',
}

const NAV_ITEMS: Array<{ id: NavPage; label: string; icon: ReactNode }> = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="7" height="7" rx="1.5" /><rect x="11" y="2" width="7" height="7" rx="1.5" /><rect x="2" y="11" width="7" height="7" rx="1.5" /><rect x="11" y="11" width="7" height="7" rx="1.5" /></svg>,
  },
  {
    id: 'orders',
    label: 'Orders',
    icon: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 5h14M3 10h14M3 15h8" /></svg>,
  },
  {
    id: 'products',
    label: 'Products',
    icon: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 2l8 4-8 4-8-4 8-4z" /><path d="M2 10l8 4 8-4" /><path d="M2 15l8 4 8-4" /></svg>,
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 16l4-5 4 3 4-7 2 9" /></svg>,
  },
  {
    id: 'profile',
    label: 'Store profile',
    icon: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="10" cy="7" r="3" /><path d="M4 17c0-3.314 2.686-6 6-6s6 2.686 6 6" /></svg>,
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="10" cy="10" r="3" /><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42" /></svg>,
  },
]

function formatCurrency(value: number, currency = 'USD') {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value)
  } catch {
    return `$${value.toFixed(2)}`
  }
}

function normalizeDomain(value?: string) {
  return (value ?? '').trim().replace(/^https?:\/\//, '').replace(/\/$/, '')
}

function getProductType(product: Product) {
  return product.product_type?.trim() || 'Uncategorized'
}

function getVariantInventory(product: Product) {
  return product.variants.reduce((total, variant) => total + Math.max(variant.inventory_quantity, 0), 0)
}

function hasDescription(product: Product) {
  return Boolean(product.description?.trim())
}

function hasTags(product: Product) {
  return product.tags.some(tag => tag.trim())
}

function hasStoreLink(product: Product) {
  return Boolean(product.store_url && product.store_url !== '#')
}

function isSearchReady(product: Product) {
  return hasDescription(product) && hasTags(product) && hasStoreLink(product)
}

function getLowStockProducts(products: Product[]) {
  return products.filter(product => product.in_stock && getVariantInventory(product) <= 3)
}

function getOutOfStockProducts(products: Product[]) {
  return products.filter(product => !product.in_stock)
}

function getMissingStoreLinks(products: Product[]) {
  return products.filter(product => !hasStoreLink(product))
}

function getProductsNeedingAttention(products: Product[]) {
  return products.filter(product => !isSearchReady(product) || !product.in_stock)
}

function getAverageStartingPrice(products: Product[]) {
  if (!products.length) return 0
  return products.reduce((total, product) => total + Number(product.price || 0), 0) / products.length
}

function getTopCategories(products: Product[]) {
  const counts = new Map<string, number>()
  for (const product of products) {
    const category = getProductType(product)
    counts.set(category, (counts.get(category) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count)
}

function getTopTags(products: Product[]) {
  const counts = new Map<string, number>()
  for (const product of products) {
    for (const tag of product.tags) {
      const normalized = tag.trim()
      if (!normalized) continue
      counts.set(normalized, (counts.get(normalized) ?? 0) + 1)
    }
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count)
}

function getPriceBands(products: Product[]) {
  const bands = [
    { label: 'Under 25', min: 0, max: 25, count: 0, ready: 0, unready: 0 },
    { label: '25-50', min: 25, max: 50, count: 0, ready: 0, unready: 0 },
    { label: '50-100', min: 50, max: 100, count: 0, ready: 0, unready: 0 },
    { label: '100+', min: 100, max: Number.POSITIVE_INFINITY, count: 0, ready: 0, unready: 0 },
  ]

  for (const product of products) {
    const price = Number(product.price || 0)
    const band = bands.find(item => price >= item.min && price < item.max) ?? bands[bands.length - 1]
    band.count += 1
    if (product.in_stock) band.ready += 1
    else band.unready += 1
  }

  return bands
}

function percent(part: number, total: number) {
  if (!total) return 0
  return Math.round((part / total) * 100)
}

function formatPercent(part: number, total: number) {
  return `${percent(part, total)}%`
}

function initials(value?: string) {
  const source = value?.trim()
  if (!source) return 'S'
  const parts = source.split(/\s+/).slice(0, 2)
  return parts.map(part => part.charAt(0).toUpperCase()).join('')
}

function getStockTone(product: Product) {
  if (!product.in_stock) return 'out'
  if (getVariantInventory(product) <= 3) return 'low'
  return 'live'
}

function getChartDatasets(products: Product[]): Record<ChartTab, ChartDataset> {
  const topCategories = getTopCategories(products).slice(0, 6)
  const categoryPoints = topCategories.map(item => {
    const bucket = products.filter(product => getProductType(product) === item.name)
    return {
      label: item.name.slice(0, 10).toUpperCase(),
      primary: bucket.filter(isSearchReady).length,
      secondary: bucket.filter(product => !isSearchReady(product)).length,
    }
  })

  const pricingPoints = getPriceBands(products).map(item => ({
    label: item.label.toUpperCase(),
    primary: item.ready,
    secondary: item.unready,
  }))

  const inventoryRanges = [
    { label: '0', min: 0, max: 0 },
    { label: '1-3', min: 1, max: 3 },
    { label: '4-10', min: 4, max: 10 },
    { label: '11-25', min: 11, max: 25 },
    { label: '25+', min: 26, max: Number.POSITIVE_INFINITY },
  ]
  const inventoryPoints = inventoryRanges.map(range => {
    const bucket = products.filter(product => {
      const inventory = getVariantInventory(product)
      return inventory >= range.min && inventory <= range.max
    })
    return {
      label: range.label,
      primary: bucket.filter(product => product.in_stock).length,
      secondary: bucket.filter(product => !product.in_stock).length,
    }
  })

  return {
    categories: {
      id: 'categories',
      label: 'Category',
      totalLabel: 'Catalog coverage',
      totalValue: `${products.filter(isSearchReady).length}/${products.length || 0}`,
      primaryLabel: 'Search ready',
      secondaryLabel: 'Needs work',
      yearLabel: 'Current sync',
      points: categoryPoints.length ? categoryPoints : [{ label: 'EMPTY', primary: 0, secondary: 0 }],
    },
    pricing: {
      id: 'pricing',
      label: 'Pricing',
      totalLabel: 'Products by price',
      totalValue: String(products.length),
      primaryLabel: 'In stock',
      secondaryLabel: 'Out of stock',
      yearLabel: 'Current sync',
      points: pricingPoints.length ? pricingPoints : [{ label: 'EMPTY', primary: 0, secondary: 0 }],
    },
    inventory: {
      id: 'inventory',
      label: 'Inventory',
      totalLabel: 'Inventory buckets',
      totalValue: String(products.length),
      primaryLabel: 'Live inventory',
      secondaryLabel: 'Unavailable',
      yearLabel: 'Current sync',
      points: inventoryPoints,
    },
  }
}

function getStoreProfileTags(products: Product[]) {
  const categories = getTopCategories(products).slice(0, 3).map(item => item.name)
  const tags = getTopTags(products).slice(0, 3).map(item => item.name)
  return [...categories, ...tags].slice(0, 6)
}

function PageHeader({
  title,
  subtitle,
  controls,
}: {
  title: ReactNode
  subtitle: string
  controls?: ReactNode
}) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: isMobile ? 18 : 28, flexWrap: 'wrap' }}>
      <div>
        <div style={{ fontFamily: 'var(--serif)', fontSize: isMobile ? 26 : 34, fontWeight: 400, lineHeight: 1.08 }}>{title}</div>
        <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink3)', marginTop: 4 }}>{subtitle}</div>
      </div>
      {controls}
    </div>
  )
}

function MetricSquareCard({
  label,
  value,
  note,
  accent,
}: {
  label: string
  value: string
  note: string
  accent?: 'up' | 'down'
}) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--m-border)', borderRadius: 'var(--m-radius)', padding: isMobile ? '16px 16px 14px' : '22px 20px 20px', aspectRatio: '1 / 1', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 18 }}>
      <div style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink3)' }}>{label}</div>
      <div style={{ fontFamily: 'var(--serif)', fontSize: value.length > 7 ? (isMobile ? 24 : 30) : (isMobile ? 32 : 38), fontWeight: 400, lineHeight: 1, color: 'var(--ink)' }}>{value}</div>
      <div style={{ fontSize: 11, color: accent === 'down' ? '#b05555' : '#5a9a5a', lineHeight: 1.5 }}>{note}</div>
    </div>
  )
}

function CardFrame({
  title,
  subtitle,
  action,
  children,
}: {
  title: string
  subtitle?: ReactNode
  action?: ReactNode
  children: ReactNode
}) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--m-border)', borderRadius: 'var(--m-radius)', padding: isMobile ? '14px 14px 12px' : '22px 22px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: isMobile ? 12 : 18, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink3)' }}>{title}</div>
          {subtitle && <div style={{ fontSize: isMobile ? 10.5 : 11, color: 'var(--ink3)', marginTop: isMobile ? 3 : 6, lineHeight: 1.5 }}>{subtitle}</div>}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

function ChartTabs({
  active,
  onChange,
}: {
  active: ChartTab
  onChange: (tab: ChartTab) => void
}) {
  const tabs: Array<{ id: ChartTab; label: string }> = [
    { id: 'categories', label: 'Category' },
    { id: 'pricing', label: 'Pricing' },
    { id: 'inventory', label: 'Inventory' },
  ]

  return (
    <div style={{ display: 'flex', gap: 2, background: 'var(--bg)', borderRadius: 20, padding: 3 }}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          style={{
            fontSize: 11,
            padding: '4px 12px',
            borderRadius: 16,
            border: 'none',
            background: active === tab.id ? 'var(--m-green)' : 'transparent',
            color: active === tab.id ? 'var(--bg-white)' : 'var(--ink3)',
            cursor: 'pointer',
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

function PixelChart({
  datasets,
  initialTab = 'categories',
}: {
  datasets: Record<ChartTab, ChartDataset>
  initialTab?: ChartTab
}) {
  const [activeTab, setActiveTab] = useState<ChartTab>(initialTab)
  const [hovered, setHovered] = useState<string | null>(null)
  const active = datasets[activeTab]
  const maxValue = Math.max(1, ...active.points.map(point => Math.max(point.primary, point.secondary)))
  const yStep = Math.max(1, Math.ceil(maxValue / 5))
  const maxBlocks = 14

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: 'var(--ink3)' }}>{active.totalLabel}</span>
            <span style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 400 }}>{active.totalValue}</span>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--ink3)' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--m-green)' }} />
                {active.primaryLabel}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--ink3)' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#c4c9c4', border: '1px solid #aaa' }} />
                {active.secondaryLabel}
              </span>
            </div>
          </div>
        </div>
        <ChartTabs active={activeTab} onChange={setActiveTab} />
      </div>

      <div style={{ display: 'flex', gap: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', paddingBottom: 22, paddingRight: 8, height: 152 }}>
          {Array.from({ length: 6 }, (_, index) => {
            const value = yStep * (5 - index)
            return (
              <div key={value} style={{ fontSize: 9, color: 'var(--ink3)', textAlign: 'right', lineHeight: 1 }}>
                {value}
              </div>
            )
          })}
        </div>

        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: '0 0 auto 0', height: 130, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pointerEvents: 'none' }}>
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} style={{ width: '100%', height: 1, background: 'var(--m-border)' }} />
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 130, position: 'relative' }}>
            {active.points.map(point => {
              const primaryBlocks = Math.round((point.primary / (yStep * 5 || 1)) * maxBlocks)
              const secondaryBlocks = Math.round((point.secondary / (yStep * 5 || 1)) * maxBlocks)
              const isHovered = hovered === point.label

              return (
                <div
                  key={point.label}
                  onMouseEnter={() => setHovered(point.label)}
                  onMouseLeave={() => setHovered(null)}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, position: 'relative', minWidth: 22 }}
                >
                  <div style={{ position: 'absolute', top: -130, left: '50%', transform: 'translateX(-50%)', width: 1, height: 130, borderLeft: '1.5px dashed var(--ink3)', opacity: isHovered ? 1 : 0, pointerEvents: 'none' }} />
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 130 }}>
                    {[
                      ['primary', primaryBlocks] as const,
                      ['secondary', secondaryBlocks] as const,
                    ].map(([tone, count]) => (
                      <div key={tone} style={{ display: 'flex', flexDirection: 'column-reverse', gap: 1, width: 8 }}>
                        {Array.from({ length: Math.max(0, count) }).map((_, index) => (
                          <div
                            key={`${point.label}-${tone}-${index}`}
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: 1,
                              background: tone === 'primary' ? 'var(--m-green)' : '#c4c9c4',
                            }}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                  <span style={{ fontSize: 8.5, color: 'var(--ink3)', letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{point.label}</span>
                  {isHovered && (
                    <div style={{ position: 'absolute', top: -2, left: '50%', transform: 'translate(-50%, -100%)', background: 'white', border: '1px solid var(--m-border)', borderRadius: 8, padding: '9px 12px', fontSize: 11.5, boxShadow: '0 4px 16px rgba(0,0,0,0.08)', whiteSpace: 'nowrap', minWidth: 160, zIndex: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 500, marginBottom: 6, color: 'var(--ink)' }}>{point.label} · {active.yearLabel}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, color: 'var(--ink3)' }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--m-green)', flexShrink: 0 }} />
                        {active.primaryLabel} <strong style={{ color: 'var(--ink)' }}>{point.primary}</strong>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink3)' }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#c4c9c4', border: '1px solid #aaa', flexShrink: 0 }} />
                        {active.secondaryLabel} <strong style={{ color: 'var(--ink)' }}>{point.secondary}</strong>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function ProductMiniList({
  products,
  currency,
  subtitle,
  isMobile,
}: {
  products: Product[]
  currency: string
  subtitle: string
  isMobile: boolean
}) {
  return (
    <CardFrame title="Top products" subtitle={subtitle}>
      {products.length === 0 ? (
        <div style={{ fontSize: isMobile ? 12 : 13, color: 'var(--ink3)', lineHeight: 1.8 }}>No products available in the current sync.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 4 : 10 }}>
          {products.map((product, index) => {
            const inventory = getVariantInventory(product)
            const maxInventory = Math.max(1, ...products.map(item => getVariantInventory(item)))
            return (
              <div key={product.id} style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12, padding: isMobile ? '6px 8px' : '10px 12px', borderRadius: 8 }}>
                <div style={{ fontFamily: 'var(--serif)', fontSize: isMobile ? 14 : 18, color: 'var(--ink3)', width: 18, textAlign: 'center' }}>{index + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: isMobile ? 12 : 13, fontWeight: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.title}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--ink3)', marginTop: 1 }}>{getProductType(product)} · {inventory} unit{inventory === 1 ? '' : 's'}</div>
                </div>
                <div style={{ textAlign: 'right', minWidth: isMobile ? 64 : 86 }}>
                  <div style={{ fontSize: isMobile ? 12 : 13, fontWeight: 500 }}>{formatCurrency(Number(product.price || 0), currency)}</div>
                  {!isMobile && (
                    <div style={{ width: 60, height: 3, background: 'var(--m-border)', borderRadius: 2, marginLeft: 'auto', marginTop: 5, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${percent(inventory, maxInventory)}%`, background: 'var(--m-green-mid)', borderRadius: 2 }} />
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </CardFrame>
  )
}

function ProductCatalogCard({ product, currency }: { product: Product; currency: string }) {
  const tone = getStockTone(product)
  const domain = normalizeDomain(product.store_url)
  const sublabel = [getProductType(product), product.vendor].filter(Boolean).join(' · ')

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  return (
    <a
      href={hasStoreLink(product) ? product.store_url : undefined}
      target="_blank"
      rel="noreferrer"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--m-border)', borderRadius: 'var(--m-radius)', overflow: 'hidden', cursor: hasStoreLink(product) ? 'pointer' : 'default', textDecoration: 'none', color: 'inherit', display: 'block' }}
    >
      <div style={{ width: '100%', aspectRatio: '1 / 1', display: 'flex', alignItems: 'center', justifyContent: 'center', background: tone === 'out' ? '#ece8e0' : tone === 'low' ? '#f0ede6' : '#e8ede6' }}>
        <svg width="24" height="24" viewBox="0 0 28 28" fill="none" stroke="#2a3b2a" strokeWidth="1" opacity="0.35">
          <path d="M4 7l5-3h10l5 3-4 4v12H8V11L4 7z" />
        </svg>
      </div>
      <div style={{ padding: isMobile ? '8px 10px 10px' : '12px 14px 14px' }}>
        <div style={{ fontSize: 8.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink3)', marginBottom: 2 }}>{sublabel || 'Catalog item'}</div>
        <div style={{ fontSize: isMobile ? 12 : 13, fontWeight: 400, lineHeight: 1.3, marginBottom: 3 }}>{product.title}</div>
        <div style={{ fontFamily: 'var(--serif)', fontSize: isMobile ? 16 : 18, fontWeight: 400, marginBottom: 6 }}>{formatCurrency(Number(product.price || 0), currency)}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ fontSize: 10, color: 'var(--ink3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{domain || 'No link'}</span>
          <span style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4, color: tone === 'out' ? '#b05555' : tone === 'low' ? '#8a6a2a' : '#5a9a5a', flexShrink: 0 }}>
            <span style={{ width: 4, height: 4, borderRadius: '50%', display: 'inline-block', background: 'currentColor' }} />
            {tone === 'out' ? 'Out' : tone === 'low' ? 'Low' : 'Live'}
          </span>
        </div>
      </div>
    </a>
  )
}

function CatalogGrid({
  products,
  currency,
}: {
  products: Product[]
  currency: string
}) {
  if (products.length === 0) {
    return (
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--m-border)', borderRadius: 'var(--m-radius)', padding: '28px 24px', color: 'var(--ink3)', fontSize: 13, lineHeight: 1.8 }}>
        No products are available for the current selection.
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
      {products.map(product => (
        <ProductCatalogCard key={product.id} product={product} currency={currency} />
      ))}
    </div>
  )
}

function DashboardPage({
  store,
  products,
  loadingProducts,
  onViewProducts,
}: {
  store: Store | null
  products: Product[]
  loadingProducts: boolean
  onViewProducts: () => void
}) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
  const currency = store?.currency ?? 'USD'
  const searchReady = products.filter(isSearchReady)
  const lowStock = getLowStockProducts(products)
  const attention = getProductsNeedingAttention(products)
  const chartDatasets = getChartDatasets(products)
  const featuredProducts = [...products].sort((left, right) => Number(right.price || 0) - Number(left.price || 0)).slice(0, 4)

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '16px 20px' : '32px 36px' }}>
      <PageHeader
        title={<>Good morning, <em style={{ fontStyle: 'italic', color: 'var(--ink3)' }}>{store?.shop_name ?? 'Store'}</em></>}
        subtitle="Overview · Current sync"
        controls={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--m-border)', borderRadius: 30, padding: '7px 14px', fontSize: 12, color: 'var(--ink3)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="2" width="10" height="9" rx="1.5" /><path d="M4 1v2M8 1v2M1 5h10" /></svg>
              Catalog snapshot
            </div>
            <button type="button" onClick={onViewProducts} style={buttonOutlineStyle}>View catalog</button>
          </div>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14, marginBottom: 22 }}>
        <MetricSquareCard label="Live products" value={loadingProducts ? '...' : String(products.length)} note={loadingProducts ? 'Loading catalog' : `${products.filter(product => product.in_stock).length} currently purchasable`} />
        <MetricSquareCard label="Search ready" value={loadingProducts ? '...' : formatPercent(searchReady.length, products.length)} note={loadingProducts ? 'Loading catalog' : `${searchReady.length} products have description, tags, and link`} />
        <MetricSquareCard label="Low stock" value={loadingProducts ? '...' : String(lowStock.length)} note={loadingProducts ? 'Loading catalog' : `${attention.length} products still need cleanup`} accent={lowStock.length ? 'down' : 'up'} />
        <MetricSquareCard label="Avg start price" value={loadingProducts ? '...' : formatCurrency(getAverageStartingPrice(products), currency)} note={loadingProducts ? 'Loading catalog' : `${store?.currency ?? 'USD'} across synced products`} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) minmax(280px, 340px)', gap: 14, marginBottom: 20 }}>
        <CardFrame title="Catalog spread">
          <PixelChart datasets={chartDatasets} />
        </CardFrame>
        <ProductMiniList products={featuredProducts} currency={currency} subtitle="By price" isMobile={isMobile} />
      </div>

      <CardFrame title="Catalog handoff" subtitle="This workspace does not mirror real order rows yet. The table below shows the products most likely to receive traffic safely.">
        {products.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--ink3)', lineHeight: 1.8 }}>Sync Shopify products to populate the merchant workspace.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['Product', 'Category', 'Link', 'Status', 'Inventory', 'Price', 'Readiness'].map(label => (
                    <th key={label} style={{ fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink3)', fontWeight: 400, padding: isMobile ? '0 10px 10px' : '0 12px 12px', textAlign: 'left', borderBottom: '1px solid var(--m-border)', whiteSpace: 'nowrap' }}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.slice(0, 6).map(product => {
                  const inventory = getVariantInventory(product)
                  const ready = isSearchReady(product)
                  const tone = getStockTone(product)
                  return (
                    <tr key={product.id} style={{ borderBottom: '1px solid var(--m-border)' }}>
                      <td style={{ padding: isMobile ? '10px 8px' : '13px 12px', color: 'var(--ink)' }}>{product.title}</td>
                      <td style={{ padding: isMobile ? '10px 8px' : '13px 12px', color: 'var(--ink)' }}>{getProductType(product)}</td>
                      <td style={{ padding: isMobile ? '10px 8px' : '13px 12px', color: 'var(--ink3)' }}>{hasStoreLink(product) ? 'Live' : 'No'}</td>
                      <td style={{ padding: isMobile ? '10px 8px' : '13px 12px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, padding: '2px 8px', borderRadius: 20, background: tone === 'out' ? '#f5eaea' : tone === 'low' ? '#f5f0e6' : '#eaf4ea', color: tone === 'out' ? '#8a3a3a' : tone === 'low' ? '#8a6a2a' : '#3d8a3d' }}>
                          <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'currentColor' }} />
                          {tone === 'out' ? 'Out' : tone === 'low' ? 'Low' : 'Live'}
                        </span>
                      </td>
                      <td style={{ padding: isMobile ? '10px 8px' : '13px 12px', color: 'var(--ink)' }}>{inventory}</td>
                      <td style={{ padding: isMobile ? '10px 8px' : '13px 12px', color: 'var(--ink)' }}>{formatCurrency(Number(product.price || 0), currency)}</td>
                      <td style={{ padding: isMobile ? '10px 8px' : '13px 12px', color: ready ? '#3d8a3d' : 'var(--ink3)', fontWeight: 500 }}>{ready ? 'Ready' : 'N/A'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardFrame>
    </div>
  )
}

function OrdersPage({ store, products }: { store: Store | null; products: Product[] }) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
  const readyProducts = products.filter(isSearchReady)
  const missingLinks = getMissingStoreLinks(products)
  const outOfStock = getOutOfStockProducts(products)
  const currency = store?.currency ?? 'USD'

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '20px 24px' : '32px 36px' }}>
      <PageHeader title={<em style={{ fontStyle: 'italic' }}>Orders</em>} subtitle="Traffic handoff status" />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14, marginBottom: 22 }}>
        <MetricSquareCard label="Storefront linked" value={normalizeDomain(store?.public_store_domain ?? store?.shop_domain) ? 'Yes' : 'No'} note={normalizeDomain(store?.public_store_domain ?? store?.shop_domain) || 'Add public domain in settings'} />
        <MetricSquareCard label="Ready for handoff" value={String(readyProducts.length)} note={`${products.length} synced products available`} />
        <MetricSquareCard label="Missing links" value={String(missingLinks.length)} note="Products without storefront destination" accent={missingLinks.length ? 'down' : 'up'} />
        <MetricSquareCard label="Out of stock" value={String(outOfStock.length)} note="Products that should not take traffic" accent={outOfStock.length ? 'down' : 'up'} />
      </div>

      <CardFrame title="Order source of truth" subtitle="Real order history is not imported into this workspace yet. Until that exists, this view tracks whether each product is safe to hand off to Shopify.">
        {products.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--ink3)', lineHeight: 1.8 }}>No products available yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['Product', 'Vendor', 'Inventory', 'Storefront', 'Discovery', 'Price', 'Action'].map(label => (
                    <th key={label} style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink3)', fontWeight: 400, padding: '0 12px 12px', textAlign: 'left', borderBottom: '1px solid var(--m-border)' }}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.slice(0, 10).map(product => {
                  const ready = isSearchReady(product)
                  return (
                    <tr key={product.id} style={{ borderBottom: '1px solid var(--m-border)' }}>
                      <td style={{ padding: isMobile ? '10px 8px' : '13px 12px' }}>{product.title}</td>
                      <td style={{ padding: isMobile ? '10px 8px' : '13px 12px', color: 'var(--ink3)' }}>{product.vendor || 'Unknown'}</td>
                      <td style={{ padding: isMobile ? '10px 8px' : '13px 12px' }}>{getVariantInventory(product)}</td>
                      <td style={{ padding: isMobile ? '10px 8px' : '13px 12px', color: hasStoreLink(product) ? '#3d8a3d' : '#8a3a3a' }}>{hasStoreLink(product) ? 'Yes' : 'No'}</td>
                      <td style={{ padding: isMobile ? '10px 8px' : '13px 12px', color: ready ? '#3d8a3d' : 'var(--ink3)' }}>{ready ? 'Ready' : 'N/A'}</td>
                      <td style={{ padding: isMobile ? '10px 8px' : '13px 12px' }}>{formatCurrency(Number(product.price || 0), currency)}</td>
                      <td style={{ padding: isMobile ? '10px 8px' : '13px 12px' }}>
                        {hasStoreLink(product) ? (
                          <a href={product.store_url} target="_blank" rel="noreferrer" style={{ ...buttonOutlineStyle, padding: '5px 12px', fontSize: 11 }}>Open</a>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--ink3)' }}>Fix</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardFrame>
    </div>
  )
}

function ProductsPage({
  store,
  products,
  loadingProducts,
  onSync,
  syncStatus,
}: {
  store: Store | null
  products: Product[]
  loadingProducts: boolean
  onSync: () => void
  syncStatus: SyncStatus
}) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
  const [query, setQuery] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const categories = ['all', ...getTopCategories(products).map(item => item.name)]
  const currency = store?.currency ?? 'USD'

  const filteredProducts = products.filter(product => {
    const matchesQuery = !query.trim() || [
      product.title,
      product.vendor,
      product.product_type,
      product.description,
      product.tags.join(' '),
    ].join(' ').toLowerCase().includes(query.trim().toLowerCase())

    const matchesTab = activeTab === 'all' || getProductType(product) === activeTab
    return matchesQuery && matchesTab
  })

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '20px 24px' : '32px 36px' }}>
      <PageHeader
        title={<em style={{ fontStyle: 'italic' }}>Products</em>}
        subtitle={`${products.length} synced`}
        controls={
          <button type="button" onClick={onSync} disabled={syncStatus === 'syncing'} style={{ ...buttonPrimaryStyle, opacity: syncStatus === 'syncing' ? 0.7 : 1, cursor: syncStatus === 'syncing' ? 'not-allowed' : 'pointer' }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6.5 1v11M1 6.5h11" /></svg>
            {syncStatus === 'syncing' ? 'Syncing...' : 'Refresh catalog'}
          </button>
        }
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--m-border)', flexWrap: 'wrap' }}>
        {categories.map(category => (
          <button
            key={category}
            type="button"
            onClick={() => setActiveTab(category)}
            style={{ fontSize: 12.5, color: activeTab === category ? 'var(--ink)' : 'var(--ink3)', background: 'transparent', border: 'none', padding: '9px 14px', cursor: 'pointer', borderBottom: activeTab === category ? '2px solid var(--m-green)' : '2px solid transparent', marginBottom: -1, fontWeight: activeTab === category ? 500 : 400 }}
          >
            {category === 'all' ? 'All' : category}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, marginBottom: 18, alignItems: 'center' }}>
        <input
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Search products, vendor, category, or tags"
          style={fieldInputStyle}
        />
        <div style={{ fontSize: 12.5, color: 'var(--ink3)', textAlign: 'right' }}>
          {loadingProducts ? 'Loading products...' : `${filteredProducts.length} shown`}
        </div>
      </div>

      <CatalogGrid products={filteredProducts} currency={currency} />
    </div>
  )
}

function AnalyticsPage({ products }: { products: Product[] }) {
  const chartDatasets = getChartDatasets(products)
  const topCategories = getTopCategories(products).slice(0, 5)
  const topTags = getTopTags(products).slice(0, 7)
  const ready = products.filter(isSearchReady).length
  const described = products.filter(hasDescription).length
  const tagged = products.filter(hasTags).length
  const inStock = products.filter(product => product.in_stock).length
  const lowStock = getLowStockProducts(products).length
  const missingLinks = getMissingStoreLinks(products).length
  const avgInventory = products.length ? Math.round(products.reduce((total, product) => total + getVariantInventory(product), 0) / products.length) : 0

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '32px 36px' }}>
      <PageHeader title={<>Store <em style={{ fontStyle: 'italic', color: 'var(--ink3)' }}>Analytics</em></>} subtitle="Current catalog health" />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14, marginBottom: 22 }}>
        <MetricSquareCard label="Search ready" value={String(ready)} note={`${formatPercent(ready, products.length)} of syncable catalog`} />
        <MetricSquareCard label="Descriptions" value={formatPercent(described, products.length)} note={`${described} products with body copy`} />
        <MetricSquareCard label="Tags" value={formatPercent(tagged, products.length)} note={`${tagged} products with taxonomy tags`} />
        <MetricSquareCard label="In stock" value={formatPercent(inStock, products.length)} note={`${inStock} products can receive traffic`} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14, marginBottom: 22 }}>
        <MetricSquareCard label="Avg inventory" value={String(avgInventory)} note="Units per product across variants" />
        <MetricSquareCard label="Low stock" value={String(lowStock)} note="Products under the low-stock threshold" accent={lowStock ? 'down' : 'up'} />
        <MetricSquareCard label="Missing links" value={String(missingLinks)} note="Products without storefront URL" accent={missingLinks ? 'down' : 'up'} />
        <MetricSquareCard label="Categories" value={String(getTopCategories(products).length)} note="Distinct product types in the sync" />
      </div>

      <CardFrame title="Catalog distribution">
        <PixelChart datasets={chartDatasets} initialTab="categories" />
      </CardFrame>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 340px)', gap: 14, marginTop: 22 }}>
        <CardFrame title="Category share" subtitle="Largest groups in the current catalog">
          {topCategories.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--ink3)' }}>No category data available.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {topCategories.map(item => (
                <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 13, width: 110, flexShrink: 0 }}>{item.name}</span>
                  <div style={{ flex: 1, height: 5, background: 'var(--m-border)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${percent(item.count, products.length)}%`, background: 'var(--m-green-mid)', borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--ink3)', width: 30, textAlign: 'right', flexShrink: 0 }}>{percent(item.count, products.length)}%</span>
                  <span style={{ fontSize: 12, color: 'var(--ink)', width: 32, textAlign: 'right', flexShrink: 0 }}>{item.count}</span>
                </div>
              ))}
            </div>
          )}
        </CardFrame>

        <CardFrame title="Top catalog tags" subtitle="Most common metadata currently synced">
          {topTags.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--ink3)' }}>No tags have been synced yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {topTags.map(tag => (
                <div key={tag.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 10px', borderRadius: 7 }}>
                  <span style={{ fontSize: 14, color: 'var(--ink)', fontFamily: 'var(--serif)', fontStyle: 'italic' }}>{tag.name}</span>
                  <span style={{ fontSize: 11.5, color: 'var(--ink3)', background: 'var(--bg)', padding: '2px 8px', borderRadius: 10 }}>{tag.count}</span>
                </div>
              ))}
            </div>
          )}
        </CardFrame>
      </div>
    </div>
  )
}

function ProfilePage({
  store,
  products,
}: {
  store: Store | null
  products: Product[]
}) {
  const [activeTab, setActiveTab] = useState('all')
  const currency = store?.currency ?? 'USD'
  const categories = ['all', ...getTopCategories(products).map(item => item.name)]
  const visibleProducts = products.filter(product => activeTab === 'all' || getProductType(product) === activeTab)
  const profileTags = getStoreProfileTags(products)
  const storefront = normalizeDomain(store?.public_store_domain ?? store?.shop_domain)
  const ready = products.filter(isSearchReady).length
  const lowStock = getLowStockProducts(products).length

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '32px 36px' }}>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--m-border)', borderRadius: 'var(--m-radius)', padding: '28px 28px 24px', display: 'flex', alignItems: 'flex-start', gap: 24, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--m-green)', color: 'var(--bg-white)', fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {initials(store?.shop_name)}
          </div>
          <div style={{ position: 'absolute', bottom: 0, right: 0, width: 20, height: 20, borderRadius: '50%', background: '#5a9a5a', border: '2px solid var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 5l2 2 4-4" /></svg>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 400, lineHeight: 1 }}>{store?.shop_name ?? 'Store profile'}</div>
            <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 20, background: '#eaf4ea', color: '#3d8a3d', fontWeight: 500 }}>Live on Orbit</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink3)', lineHeight: 1.55, marginTop: 6, maxWidth: 420 }}>
            {store?.shop_name
              ? `${store.shop_name} is synced into Fluid Orbit with a curated product catalog, storefront links, and merchant-ready inventory signals.`
              : 'Connect a store to generate a merchant profile.'}
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--m-green-mid)', marginTop: 8 }}>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4.5 2H2a1 1 0 00-1 1v6a1 1 0 001 1h6a1 1 0 001-1V6.5M7 1h3m0 0v3m0-3L4.5 6.5" /></svg>
            {storefront || 'No public storefront domain'}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            {profileTags.length ? profileTags.map(tag => (
              <span key={tag} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'var(--bg)', border: '1px solid var(--m-border)', color: 'var(--ink3)' }}>{tag}</span>
            )) : (
              <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'var(--bg)', border: '1px solid var(--m-border)', color: 'var(--ink3)' }}>No tags yet</span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 0, flexShrink: 0, background: 'var(--bg)', borderRadius: 8, padding: '16px 20px', border: '1px solid var(--m-border)', alignSelf: 'center', flexWrap: 'wrap' }}>
          {[
            ['Products', String(products.length)],
            ['Ready', String(ready)],
            ['Low stock', String(lowStock)],
            ['Avg price', formatCurrency(getAverageStartingPrice(products), currency)],
          ].map(([label, value], index) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center' }}>
              {index > 0 && <div style={{ width: 1, height: 30, background: 'var(--m-border)', margin: '0 20px' }} />}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 400, lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink3)', marginTop: 4 }}>{label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--m-border)', flexWrap: 'wrap' }}>
        {categories.map(category => (
          <button
            key={category}
            type="button"
            onClick={() => setActiveTab(category)}
            style={{ fontSize: 12.5, color: activeTab === category ? 'var(--ink)' : 'var(--ink3)', background: 'transparent', border: 'none', padding: '9px 14px', cursor: 'pointer', borderBottom: activeTab === category ? '2px solid var(--m-green)' : '2px solid transparent', marginBottom: -1, fontWeight: activeTab === category ? 500 : 400 }}
          >
            {category === 'all' ? 'All' : category}
          </button>
        ))}
      </div>

      <CatalogGrid products={visibleProducts} currency={currency} />
    </div>
  )
}

function SettingsPage({
  store,
  products,
  stores,
  user,
  syncStatus,
  reconnectUrl,
  onStoreSaved,
  showToast,
  onConnectStore,
}: {
  store: Store | null
  products: Product[]
  stores: Store[]
  user: UserShape
  syncStatus: SyncStatus
  reconnectUrl: string | null
  onStoreSaved: (store: Store) => Promise<void>
  showToast: (message: string, ok?: boolean) => void
  onConnectStore: () => void
}) {
  const [shopName, setShopName] = useState(store?.shop_name ?? '')
  const [publicStoreDomain, setPublicStoreDomain] = useState(store?.public_store_domain ?? '')
  const [currency, setCurrency] = useState(store?.currency ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setShopName(store?.shop_name ?? '')
    setPublicStoreDomain(store?.public_store_domain ?? '')
    setCurrency(store?.currency ?? '')
  }, [store?._id, store?.shop_name, store?.public_store_domain, store?.currency])

  const dirty = Boolean(
    store
    && (shopName !== (store.shop_name ?? '')
      || publicStoreDomain !== (store.public_store_domain ?? '')
      || currency !== (store.currency ?? ''))
  )

  async function handleSave() {
    if (!store || saving) return
    if (!shopName.trim()) {
      showToast('Store name is required.', false)
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/merchant/stores', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantId: store._id,
          shop_name: shopName.trim(),
          public_store_domain: publicStoreDomain.trim(),
          currency: currency.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.store) throw new Error(data.error ?? 'Unable to update store')
      await onStoreSaved(data.store as Store)
      showToast('Store profile updated.')
    } catch {
      showToast('Store profile could not be updated.', false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '32px 36px' }}>
      <PageHeader
        title={<em style={{ fontStyle: 'italic' }}>Settings</em>}
        subtitle="Store identity and workspace controls"
        controls={
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => {
                setShopName(store?.shop_name ?? '')
                setPublicStoreDomain(store?.public_store_domain ?? '')
                setCurrency(store?.currency ?? '')
              }}
              style={buttonOutlineStyle}
            >
              Reset
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty || saving}
              style={{ ...buttonPrimaryStyle, opacity: !dirty || saving ? 0.7 : 1, cursor: !dirty || saving ? 'not-allowed' : 'pointer' }}
            >
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 340px)', gap: 16 }}>
        <CardFrame title="Store details" subtitle="Editable fields for the current merchant record.">
          <div style={{ display: 'grid', gap: 16 }}>
            <div>
              <label style={fieldLabelStyle}>Store name</label>
              <input value={shopName} onChange={event => setShopName(event.target.value)} style={fieldInputStyle} />
            </div>
            <div>
              <label style={fieldLabelStyle}>Shopify domain</label>
              <div style={{ ...fieldInputStyle, color: 'var(--ink3)' }}>{normalizeDomain(store?.shop_domain) || 'Not set'}</div>
            </div>
            <div>
              <label style={fieldLabelStyle}>Public storefront domain</label>
              <input value={publicStoreDomain} onChange={event => setPublicStoreDomain(event.target.value)} placeholder="your-store-domain.com" style={fieldInputStyle} />
            </div>
            <div>
              <label style={fieldLabelStyle}>Currency</label>
              <input value={currency} onChange={event => setCurrency(event.target.value.toUpperCase())} placeholder="USD" style={fieldInputStyle} />
            </div>
          </div>
        </CardFrame>

        <div style={{ display: 'grid', gap: 16 }}>
          <CardFrame title="Workspace status" subtitle="Current merchant signals">
            <div style={{ display: 'grid', gap: 12 }}>
              {[
                ['Connected stores', String(stores.length)],
                ['Synced products', String(products.length)],
                ['Search-ready', String(products.filter(isSearchReady).length)],
                ['Sync status', syncStatus === 'idle' ? 'Idle' : syncStatus === 'done' ? 'Up to date' : syncStatus === 'token_expired' ? 'Reconnect required' : syncStatus === 'error' ? 'Needs retry' : 'Syncing'],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 14, paddingBottom: 12, borderBottom: '1px solid var(--m-border)' }}>
                  <span style={{ fontSize: 12.5, color: 'var(--ink3)' }}>{label}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 500 }}>{value}</span>
                </div>
              ))}
            </div>
          </CardFrame>

          <CardFrame title="Workspace actions" subtitle="Controls that affect the merchant account.">
            <div style={{ display: 'grid', gap: 10 }}>
              <button type="button" onClick={onConnectStore} style={{ ...buttonOutlineStyle, width: '100%', justifyContent: 'center' }}>Connect another store</button>
              {syncStatus === 'token_expired' && reconnectUrl && (
                <a href={reconnectUrl} style={{ ...buttonOutlineStyle, width: '100%', justifyContent: 'center' }}>Reconnect Shopify</a>
              )}
              <button type="button" onClick={() => signOut({ callbackUrl: '/merchant' })} style={{ ...buttonPrimaryStyle, width: '100%', justifyContent: 'center' }}>Sign out</button>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink3)', lineHeight: 1.7, marginTop: 14 }}>
              Signed in as {user.email ?? user.name}.
            </div>
          </CardFrame>
        </div>
      </div>
    </div>
  )
}

function Sidebar({ active, onNav }: { active: NavPage; onNav: (page: NavPage) => void }) {
  const mainItems = NAV_ITEMS.slice(0, 4)
  const bottomItems = NAV_ITEMS.slice(4)

  return (
    <aside style={{ width: 68, background: 'var(--bg)', borderRight: '1px solid var(--m-border)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0', gap: 6, flexShrink: 0 }}>
      <div style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
        <svg viewBox="0 0 28 28" fill="none" width="28" height="28">
          <circle cx="14" cy="14" r="12" stroke="var(--m-green)" strokeWidth="1.5" />
          <circle cx="14" cy="14" r="5" fill="var(--m-green)" />
          <ellipse cx="14" cy="14" rx="12" ry="5" stroke="var(--m-green)" strokeWidth="1" strokeDasharray="2 2" fill="none" />
        </svg>
      </div>

      {mainItems.map(item => {
        const isActive = item.id === active
        return (
          <button
            key={item.id}
            type="button"
            title={item.label}
            onClick={() => onNav(item.id)}
            style={{ width: 42, height: 42, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: isActive ? '#f7f5f1' : 'var(--ink3)', border: 'none', background: isActive ? 'var(--m-green)' : 'transparent' }}
          >
            <span style={{ width: 18, height: 18, display: 'flex' }}>{item.icon}</span>
          </button>
        )
      })}

      <div style={{ width: 28, height: 1, background: 'var(--m-border)', margin: '6px 0' }} />

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        {bottomItems.map(item => {
          const isActive = item.id === active
          return (
            <button
              key={item.id}
              type="button"
              title={item.label}
              onClick={() => onNav(item.id)}
              style={{ width: 42, height: 42, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: isActive ? '#f7f5f1' : 'var(--ink3)', border: 'none', background: isActive ? 'var(--m-green)' : 'transparent' }}
            >
              <span style={{ width: 18, height: 18, display: 'flex' }}>{item.icon}</span>
            </button>
          )
        })}
      </div>
    </aside>
  )
}

function Topbar({
  stores,
  activeStore,
  dropdownOpen,
  setDropdownOpen,
  onSwitchStore,
  onAddStore,
  onSync,
  reconnectUrl,
  syncStatus,
  isMobile,
}: {
  stores: Store[]
  activeStore: Store | null
  dropdownOpen: boolean
  setDropdownOpen: (value: boolean) => void
  onSwitchStore: (id: string) => void
  onAddStore: () => void
  onSync: () => void
  reconnectUrl: string | null
  syncStatus: SyncStatus
  isMobile: boolean
}) {
  const storefront = normalizeDomain(activeStore?.public_store_domain ?? activeStore?.shop_domain)
  const adminDomain = normalizeDomain(activeStore?.shop_domain)

  return (
    <header style={{ height: isMobile ? 'auto' : 58, minHeight: 58, borderBottom: '1px solid var(--m-border)', display: 'flex', alignItems: 'center', padding: isMobile ? '12px 16px' : '0 28px', gap: 12, background: 'var(--bg)', flexShrink: 0, flexWrap: 'wrap' }}>
      {!isMobile && (
        <div style={{ fontSize: 11, letterSpacing: '0.12em', color: 'var(--ink3)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#5a9a5a' }} />
          Fluid Orbit — Merchant
        </div>
      )}

      <div style={{ marginLeft: isMobile ? 0 : 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', width: isMobile ? '100%' : 'auto' }}>
        {syncStatus === 'token_expired' && reconnectUrl && (
          <a href={reconnectUrl} style={{ fontSize: 12, color: 'var(--red)', background: 'var(--red-bg)', padding: '6px 12px', borderRadius: 8, textDecoration: 'none', fontWeight: 500 }}>
            Reconnect Shopify
          </a>
        )}

        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            style={{ ...buttonOutlineStyle, padding: '7px 12px', background: 'var(--bg-card)' }}
          >
            <span style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--m-green)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: 'var(--bg-white)', flexShrink: 0 }}>
              {initials(activeStore?.shop_name)}
            </span>
            <span style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeStore?.shop_name ?? 'Select store'}</span>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 4l3 3 3-3" /></svg>
          </button>

          {dropdownOpen && (
            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: 'white', border: '1px solid var(--m-border)', borderRadius: 12, minWidth: 260, boxShadow: '0 8px 28px rgba(26,24,20,0.1)', overflow: 'hidden', zIndex: 100 }}>
              <div style={{ padding: '8px 14px', fontSize: 10, color: 'var(--ink3)', letterSpacing: '0.12em', textTransform: 'uppercase', borderBottom: '1px solid var(--m-border)' }}>Stores</div>
              {stores.length === 0 ? (
                <div style={{ padding: 14, fontSize: 12.5, color: 'var(--ink3)', textAlign: 'center' }}>No stores connected</div>
              ) : (
                stores.map(store => (
                  <button
                    key={store._id}
                    type="button"
                    onClick={() => onSwitchStore(store._id)}
                    style={{ width: '100%', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: store._id === activeStore?._id ? 'var(--bg)' : 'white', border: 'none', textAlign: 'left' }}
                  >
                    <span style={{ width: 26, height: 26, borderRadius: 7, background: 'var(--m-green)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: 'var(--bg-white)', flexShrink: 0 }}>
                      {initials(store.shop_name)}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{store.shop_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink3)' }}>{normalizeDomain(store.public_store_domain ?? store.shop_domain)}</div>
                    </div>
                  </button>
                ))
              )}
              <div style={{ borderTop: '1px solid var(--m-border)' }}>
                <button type="button" onClick={onAddStore} style={{ width: '100%', padding: '10px 14px', fontSize: 12.5, color: 'var(--m-green-mid)', cursor: 'pointer', fontWeight: 500, background: 'none', border: 'none', textAlign: 'left' }}>
                  Connect store
                </button>
                <button type="button" onClick={() => signOut({ callbackUrl: '/merchant' })} style={{ width: '100%', padding: '10px 14px', fontSize: 12.5, color: 'var(--ink3)', cursor: 'pointer', background: 'none', border: 'none', textAlign: 'left' }}>
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>

        {storefront && (
          <a href={`https://${storefront}`} target="_blank" rel="noreferrer" style={buttonOutlineStyle}>
            View storefront
          </a>
        )}

        {activeStore ? (
          <button 
            type="button" 
            onClick={onSync} 
            disabled={syncStatus === 'syncing'}
            style={{ 
              ...buttonPrimaryStyle, 
              padding: isMobile ? '8px 14px' : buttonPrimaryStyle.padding,
              opacity: syncStatus === 'syncing' ? 0.7 : 1,
              cursor: syncStatus === 'syncing' ? 'default' : 'pointer'
            }}
          >
            <svg 
              width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              style={{ animation: syncStatus === 'syncing' ? 'spin 2s linear infinite' : 'none' }}
            >
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 12c0-4.4 3.6-8 8-8 3.3 0 6.2 2 7.4 5M22 12c0 4.4-3.6 8-8 8-3.3 0-6.2-2-7.4-5" />
            </svg>
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            {isMobile ? (syncStatus === 'syncing' ? '...' : 'Sync') : (syncStatus === 'syncing' ? 'Syncing...' : 'Sync catalog')}
          </button>
        ) : (
          <button type="button" onClick={onAddStore} style={{ ...buttonPrimaryStyle, padding: isMobile ? '8px 14px' : buttonPrimaryStyle.padding }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6.5 1v11M1 6.5h11" /></svg>
            {isMobile ? 'Connect' : 'Connect store'}
          </button>
        )}
      </div>
    </header>
  )
}

function EmptyStoreState({ onConnect }: { onConnect: () => void }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <div style={{ maxWidth: 460, textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 40, color: 'var(--m-green)', marginBottom: 12 }}>No connected stores</div>
        <p style={{ fontSize: 13.5, color: 'var(--ink3)', lineHeight: 1.8, marginBottom: 22 }}>
          Connect a Shopify store to unlock the merchant dashboard, catalog profile, analytics, and storefront handoff views.
        </p>
        <button type="button" onClick={onConnect} style={buttonPrimaryStyle}>
          Connect Shopify store
        </button>
      </div>
    </div>
  )
}

function DashboardInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status } = useSession()

  const [stores, setStores] = useState<Store[]>([])
  const [loadingStores, setLoadingStores] = useState(true)
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [activeStoreId, setActiveStoreId] = useState<string | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [products, setProducts] = useState<Product[]>([])
  const [activePage, setActivePage] = useState<NavPage>('dashboard')
  const [reconnectUrl, setReconnectUrl] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const toastTimer = useRef<number | null>(null)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const user: UserShape = {
    name: session?.user?.name ?? 'Merchant',
    email: session?.user?.email,
    image: session?.user?.image,
    id: session?.user?.id ?? 'anon',
  }

  function showToast(message: string, ok = true) {
    setToast({ msg: message, ok })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 3200)
  }

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current)
    }
  }, [])

  async function refreshStores(force = false) {
    if (status !== 'authenticated') return
    setLoadingStores(true)
    try {
      const list = await loadStores(user.id, force)
      setStores(list)
      setActiveStoreId(current => {
        if (current && list.some(store => store._id === current)) return current
        const requestedId = searchParams.get('storeId')
        const requestedStore = requestedId ? list.find(store => store._id === requestedId) : null
        return requestedStore?._id ?? list[0]?._id ?? null
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to load stores.'
      showToast(message, false)
    } finally {
      setLoadingStores(false)
    }
  }

  async function refreshProducts(storeId: string, force = false) {
    setLoadingProducts(true)
    try {
      const data = await loadProducts(user.id, storeId, force)
      setProducts(data.products as Product[] ?? [])
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to load products.'
      showToast(message, false)
    } finally {
      setLoadingProducts(false)
    }
  }

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/merchant/login')
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    refreshStores()
  }, [status, user.id])

  useEffect(() => {
    if (!activeStoreId) {
      setProducts([])
      setLoadingProducts(false)
      return
    }
    refreshProducts(activeStoreId)
  }, [activeStoreId])

  const activeStore = stores.find(store => store._id === activeStoreId) ?? null

  function switchStore(id: string) {
    setActiveStoreId(id)
    setDropdownOpen(false)
    setSyncStatus('idle')
    setReconnectUrl(null)
  }

  function handleNav(page: NavPage) {
    setActivePage(page)
    setDrawerOpen(false)
  }

  async function runSync() {
    if (!activeStore || syncStatus === 'syncing') return
    setSyncStatus('syncing')
    setReconnectUrl(null)

    try {
      const res = await fetch('/api/shopify/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchantId: activeStore._id }),
      })
      const data = await res.json()

      if (data.error === 'token_expired' || data.error === 'store_not_found') {
        setSyncStatus('token_expired')
        setReconnectUrl(data.reconnect_url ?? '/onboarding')
        showToast(data.message || 'Please reconnect your Shopify store.', false)
        return
      }

      if (!res.ok) throw new Error(data.error ?? 'Sync failed')

      setSyncStatus('done')
      await refreshStores(true)
      await refreshProducts(activeStore._id, true)
      showToast(`Synced ${data.synced ?? 0} product${data.synced === 1 ? '' : 's'}.`)
    } catch {
      setSyncStatus('error')
      showToast('Sync failed. Please try again.', false)
    }
  }

  async function handleStoreSaved(store: Store) {
    setStores(current => current.map(item => (item._id === store._id ? store : item)))
    await refreshStores(true)
    await refreshProducts(store._id, true)
  }

  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--ink3)', fontSize: 13 }}>
        Loading...
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', height: '100vh', background: 'var(--bg)', overflow: 'hidden' }}>
      {toast && (
        <div style={{ position: 'fixed', top: isMobile ? 70 : 16, left: '50%', transform: 'translateX(-50%)', padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500, boxShadow: '0 4px 24px rgba(0,0,0,0.18)', zIndex: 300, background: toast.ok ? '#0f2d1a' : '#2d0f0f', color: toast.ok ? '#6edba8' : '#ed8080' }}>
          {toast.msg}
        </div>
      )}

      {isMobile ? (
        <header style={{ height: 62, background: 'var(--bg)', borderBottom: '1px solid var(--m-border)', display: 'flex', alignItems: 'center', padding: '0 16px', flexShrink: 0, zIndex: 110 }}>
          <button onClick={() => setDrawerOpen(true)} style={{ background: 'none', border: 'none', color: 'var(--ink)', padding: 8, marginLeft: -8, cursor: 'pointer' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18" /></svg>
          </button>
          <div style={{ marginLeft: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg viewBox="0 0 28 28" fill="none" width="22" height="22">
              <circle cx="14" cy="14" r="12" stroke="var(--m-green)" strokeWidth="1.5" />
              <circle cx="14" cy="14" r="5" fill="var(--m-green)" />
              <ellipse cx="14" cy="14" rx="12" ry="5" stroke="var(--m-green)" strokeWidth="1" strokeDasharray="2 2" fill="none" />
            </svg>
            <span style={{ fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 500 }}>Merchant</span>
          </div>
        </header>
      ) : (
        <Sidebar active={activePage} onNav={handleNav} />
      )}

      {/* Drawer Overlay */}
      {isMobile && drawerOpen && (
        <div 
          onClick={() => setDrawerOpen(false)} 
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)', zIndex: 120, transition: 'opacity 0.25s' }} 
        />
      )}

      {/* Drawer Menu */}
      {isMobile && (
        <aside style={{ 
          position: 'fixed', 
          top: 0, 
          bottom: 0, 
          left: 0, 
          width: 280, 
          background: 'var(--bg)', 
          zIndex: 130, 
          boxShadow: '4px 0 30px rgba(0,0,0,0.1)',
          transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          display: 'flex',
          flexDirection: 'column',
          padding: '24px 20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
            <svg viewBox="0 0 28 28" fill="none" width="26" height="26">
              <circle cx="14" cy="14" r="12" stroke="var(--m-green)" strokeWidth="1.5" />
              <circle cx="14" cy="14" r="5" fill="var(--m-green)" />
              <ellipse cx="14" cy="14" rx="12" ry="5" stroke="var(--m-green)" strokeWidth="1" strokeDasharray="2 2" fill="none" />
            </svg>
            <span style={{ fontFamily: 'var(--serif)', fontSize: 18, color: 'var(--ink)' }}>Fluid Orbit</span>
          </div>

          <div style={{ display: 'grid', gap: 6 }}>
            {NAV_ITEMS.slice(0, 4).map(item => (
              <button
                key={item.id}
                onClick={() => handleNav(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 14px',
                  borderRadius: 12,
                  border: 'none',
                  background: activePage === item.id ? 'var(--m-green-pale)' : 'transparent',
                  color: activePage === item.id ? 'var(--m-green-mid)' : 'var(--ink)',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontWeight: activePage === item.id ? 500 : 400
                }}
              >
                <span style={{ width: 18, height: 18, color: 'currentColor' }}>{item.icon}</span>
                <span style={{ fontSize: 14 }}>{item.label}</span>
              </button>
            ))}
          </div>

          <div style={{ marginTop: 'auto', paddingTop: 20, borderTop: '1px solid var(--m-border)', display: 'grid', gap: 6 }}>
            {NAV_ITEMS.slice(4).map(item => (
              <button
                key={item.id}
                onClick={() => handleNav(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 14px',
                  borderRadius: 12,
                  border: 'none',
                  background: activePage === item.id ? 'var(--m-green-pale)' : 'transparent',
                  color: activePage === item.id ? 'var(--m-green-mid)' : 'var(--ink)',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontWeight: activePage === item.id ? 500 : 400
                }}
              >
                <span style={{ width: 18, height: 18, color: 'currentColor' }}>{item.icon}</span>
                <span style={{ fontSize: 14 }}>{item.label}</span>
              </button>
            ))}
            <button
              onClick={() => signOut({ callbackUrl: '/merchant' })}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, border: 'none', background: 'transparent', color: 'var(--ink3)', textAlign: 'left', cursor: 'pointer' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" /></svg>
              <span style={{ fontSize: 14 }}>Sign out</span>
            </button>
          </div>
        </aside>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Topbar
          stores={stores}
          activeStore={activeStore}
          dropdownOpen={dropdownOpen}
          setDropdownOpen={setDropdownOpen}
          onSwitchStore={switchStore}
          onAddStore={() => router.push('/onboarding')}
          onSync={runSync}
          reconnectUrl={reconnectUrl}
          syncStatus={syncStatus}
          isMobile={isMobile}
        />

        {loadingStores ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink3)', fontSize: 13 }}>
            Loading stores...
          </div>
        ) : stores.length === 0 ? (
          <EmptyStoreState onConnect={() => router.push('/onboarding')} />
        ) : (
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {activePage === 'dashboard' && (
              <DashboardPage
                store={activeStore}
                products={products}
                loadingProducts={loadingProducts}
                onViewProducts={() => setActivePage('products')}
              />
            )}
            {activePage === 'orders' && <OrdersPage store={activeStore} products={products} />}
            {activePage === 'products' && (
              <ProductsPage
                store={activeStore}
                products={products}
                loadingProducts={loadingProducts}
                onSync={runSync}
                syncStatus={syncStatus}
              />
            )}
            {activePage === 'analytics' && <AnalyticsPage products={products} />}
            {activePage === 'profile' && <ProfilePage store={activeStore} products={products} />}
            {activePage === 'settings' && (
              <SettingsPage
                store={activeStore}
                products={products}
                stores={stores}
                user={user}
                syncStatus={syncStatus}
                reconnectUrl={reconnectUrl}
                onStoreSaved={handleStoreSaved}
                showToast={showToast}
                onConnectStore={() => router.push('/onboarding')}
              />
            )}
          </div>
        )}
      </div>

      {dropdownOpen && <div onClick={() => setDropdownOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />}
    </div>
  )
}

export default function MerchantDashboard() {
  return <Suspense><DashboardInner /></Suspense>
}
