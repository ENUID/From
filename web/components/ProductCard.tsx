'use client'

import { formatMoney } from '@/lib/currency'

export interface Product {
  id: string
  title: string
  vendor: string
  handle: string
  store_url: string
  price: number
  currency?: string
  base_currency?: string
  tags: string[]
  in_stock: boolean
  merchant_id?: string
  description?: string
  product_type?: string
  variants: Array<{
    shopify_variant_id: string
    price: number
    title: string
    inventory_quantity: number
  }>
}

interface Props {
  product: Product
  isBest?: boolean
  saved?: boolean
  onToggleSave?: (product: Product) => void
  ctaLabel?: string
}

export default function ProductCard({
  product,
  isBest,
  saved = false,
  onToggleSave,
  ctaLabel = 'View in store',
}: Props) {
  const tags = (product.tags || []).slice(0, 3).join(' / ')
  const hasUrl = product.store_url && product.store_url !== '#'
  const meta = [product.product_type, tags].filter(Boolean).join(' / ')

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${isBest ? 'rgba(42,59,42,0.3)' : 'var(--m-border)'}`,
        borderRadius: 12,
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
        transition: 'box-shadow 0.15s, transform 0.12s',
        position: 'relative',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = '0 4px 16px rgba(42,59,42,0.09)'
        e.currentTarget.style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.transform = 'none'
      }}
    >
      {isBest && (
        <div
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            fontSize: 9,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--m-green)',
            background: 'var(--m-green-light)',
            padding: '2px 8px',
            borderRadius: 20,
            fontWeight: 500,
          }}
        >
          Best match
        </div>
      )}

      <div
        style={{
          fontSize: 9.5,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--ink3)',
          marginBottom: 1,
        }}
      >
        {product.vendor}
      </div>
      <div
        style={{
          fontSize: 13.5,
          fontWeight: 500,
          color: 'var(--ink)',
          lineHeight: 1.3,
          paddingRight: isBest ? 60 : 0,
        }}
      >
        {product.title}
      </div>
      <div style={{ fontSize: 14, color: 'var(--ink)', fontFamily: 'var(--serif)', marginTop: 2 }}>
        {formatMoney(Number(product.price), product.currency, product.base_currency)}
      </div>

      {meta && <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 1 }}>{meta}</div>}

      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
        <div
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            flexShrink: 0,
            background: product.in_stock ? '#5a9a5a' : 'var(--ink3)',
          }}
        />
        <span style={{ fontSize: 11, color: product.in_stock ? '#5a9a5a' : 'var(--ink3)' }}>
          {product.in_stock ? 'In stock' : 'Contact store'}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <a
          href={hasUrl ? product.store_url : undefined}
          target="_blank"
          rel="noopener"
          style={{
            flex: 1,
            display: 'block',
            padding: '8px',
            textAlign: 'center',
            textDecoration: 'none',
            border: '1px solid var(--m-border)',
            borderRadius: 8,
            fontSize: 12,
            color: 'var(--ink2)',
            fontWeight: 500,
            cursor: hasUrl ? 'pointer' : 'default',
            opacity: hasUrl ? 1 : 0.4,
            transition: 'background 0.12s, border-color 0.12s',
            background: 'transparent',
          }}
          onMouseEnter={e => {
            if (!hasUrl) return
            e.currentTarget.style.background = 'var(--m-green-light)'
            e.currentTarget.style.borderColor = 'var(--m-green-mid)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.borderColor = 'var(--m-border)'
          }}
        >
          {ctaLabel}
        </a>

        {onToggleSave && (
          <button
            type="button"
            onClick={() => onToggleSave(product)}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: `1px solid ${saved ? 'var(--m-green)' : 'var(--m-border)'}`,
              background: saved ? 'var(--m-green-light)' : 'transparent',
              color: saved ? 'var(--m-green)' : 'var(--ink3)',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {saved ? 'Saved' : 'Save'}
          </button>
        )}
      </div>
    </div>
  )
}
