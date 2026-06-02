'use client'

import { useState } from 'react'
import { formatMoney } from '@/lib/currency'
import { ExchangeRates } from '@/lib/exchangeRates'

export interface Product {
  id: string
  title: string
  vendor: string
  handle?: string
  store_url: string
  price: number
  currency?: string
  base_currency?: string
  tags: string[]
  in_stock: boolean
  merchant_id?: string
  image_url?: string
  description?: string
  product_type?: string
  options?: { name: string; values: string[] }[]
  variants?: Array<{
    id: string
    title: string
    price: number
    availability: boolean
    options: Array<{ name: string; label: string }>
    media?: Array<{ url: string }>
  }>
  media?: Array<{ type: string; url: string }>
}

interface Props {
  product: Product
  rates: ExchangeRates
  isBest?: boolean
  saved?: boolean
  onToggleSave?: (product: Product) => void
  ctaLabel?: string
  onClick?: () => void
}

export default function ProductCard({
  product,
  rates,
  isBest,
  saved = false,
  onToggleSave,
  ctaLabel = 'Quick View',
  onClick,
}: Props) {
  const [imageError, setImageError] = useState(false)
  const hasUrl = product.store_url && product.store_url !== '#'
  const shortDesc = product.description ? (product.description.length > 55 ? `${product.description.substring(0, 55).trim()}...` : product.description) : ''

  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${isBest ? 'var(--m-green-mid)' : 'var(--m-border)'}`,
        borderRadius: 16,
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        gap: 8,
        cursor: 'pointer',
        transition: 'border-color 0.15s ease',
        position: 'relative',
        boxShadow: isBest ? '0 4px 12px rgba(90, 154, 90, 0.08)' : '0 2px 8px rgba(0, 0, 0, 0.02)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--m-green-mid)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = isBest ? 'var(--m-green-mid)' : 'var(--m-border)'
      }}
    >
      {isBest && (
        <div
          style={{
            position: 'absolute',
            top: 20,
            left: 20,
            fontSize: 9,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--bg-white)',
            background: 'var(--m-green)',
            padding: '4px 10px',
            borderRadius: 20,
            fontWeight: 600,
            zIndex: 10,
            boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
          }}
        >
          Best Match
        </div>
      )}

      <div
        style={{
          width: '100%',
          height: '240px',
          borderRadius: 12,
          overflow: 'hidden',
          position: 'relative',
          border: '1px solid rgba(0,0,0,0.03)',
          background: '#F9F9FB',
        }}
      >
        {product.image_url && !imageError ? (
          <img
            src={product.image_url}
            alt={product.title}
            loading="lazy"
            onError={() => setImageError(true)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : (
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg)',
            color: 'var(--ink3)'
          }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.4">
              <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '4px 4px 0 4px' }}>
        <div
          style={{
            fontSize: 10,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--ink3)',
            fontWeight: 600,
            marginBottom: 2,
          }}
        >
          {product.vendor}
        </div>
        
        <h3
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--ink)',
            lineHeight: 1.3,
            marginBottom: 4,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            height: '36px',
          }}
        >
          {product.title}
        </h3>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: 8 }}>
          <div style={{ 
            fontSize: 16, 
            color: 'var(--ink)', 
            fontWeight: 700,
            fontFamily: '"Inter", var(--sans)'
          }}>
            {formatMoney(Number(product.price), product.currency, product.base_currency, rates)}
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span
              style={{
                display: 'inline-block',
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: product.in_stock ? '#5a9a5a' : '#d9534f',
              }}
            />
            <span style={{ fontSize: 11, color: 'var(--ink3)', fontWeight: 500 }}>
              {product.in_stock ? 'In Stock' : 'Out of Stock'}
            </span>
          </div>
        </div>

        {shortDesc && (
          <p style={{ fontSize: 11.5, color: 'var(--ink3)', marginTop: 8, lineHeight: 1.4, height: '32px', overflow: 'hidden' }}>
            {shortDesc}
          </p>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, width: '100%', marginTop: 8 }} onClick={e => e.stopPropagation()}>
        <button
          onClick={onClick}
          style={{
            flex: 1,
            padding: '9px',
            textAlign: 'center',
            background: 'var(--bg)',
            border: '1px solid var(--m-border)',
            borderRadius: 10,
            fontSize: 12,
            color: 'var(--ink2)',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'var(--m-green-light)'
            e.currentTarget.style.borderColor = 'var(--m-green-mid)'
            e.currentTarget.style.color = 'var(--m-green)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'var(--bg)'
            e.currentTarget.style.borderColor = 'var(--m-border)'
            e.currentTarget.style.color = 'var(--ink2)'
          }}
        >
          {ctaLabel}
        </button>

        {onToggleSave && (
          <button
            type="button"
            onClick={() => onToggleSave(product)}
            style={{
              padding: '9px 12px',
              borderRadius: 10,
              border: `1px solid ${saved ? 'var(--m-green)' : 'var(--m-border)'}`,
              background: saved ? 'var(--m-green-light)' : 'var(--bg)',
              color: saved ? 'var(--m-green)' : 'var(--ink3)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => {
              if (!saved) {
                e.currentTarget.style.borderColor = 'var(--m-green-mid)'
                e.currentTarget.style.color = 'var(--m-green)'
              }
            }}
            onMouseLeave={e => {
              if (!saved) {
                e.currentTarget.style.borderColor = 'var(--m-border)'
                e.currentTarget.style.color = 'var(--ink3)'
              }
            }}
          >
            {saved ? 'Saved' : 'Save'}
          </button>
        )}
      </div>
    </div>
  )
}
