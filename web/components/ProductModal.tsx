import { useEffect, useState } from 'react'
import { formatMoney } from '@/lib/currency'
import { ExchangeRates } from '@/lib/exchangeRates'
import type { Product } from './ProductCard'

interface Props {
  product: Product
  rates: ExchangeRates
  onClose: () => void
  ctaLabel?: string
}

export default function ProductModal({
  product,
  rates,
  onClose,
  ctaLabel = 'View in store'
}: Props) {
  const [isMounted, setIsMounted] = useState(false)
  
  useEffect(() => {
    setIsMounted(true)
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  const tags = (product.tags || []).slice(0, 3).join(' / ')
  const meta = [product.product_type, tags].filter(Boolean).join(' / ')
  const hasUrl = product.store_url && product.store_url !== '#'

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        background: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(4px)',
        opacity: isMounted ? 1 : 0,
        transition: 'opacity 0.2s ease',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)',
          borderRadius: 16,
          width: '100%',
          maxWidth: 800,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'row',
          overflow: 'hidden',
          boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
          transform: isMounted ? 'translateY(0) scale(1)' : 'translateY(10px) scale(0.98)',
          transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            width: 32,
            height: 32,
            borderRadius: 16,
            background: 'var(--bg)',
            border: '1px solid var(--m-border)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--ink)',
            zIndex: 10,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M1 1l12 12M13 1L1 13" />
          </svg>
        </button>

        {/* Left Column: Image */}
        <div style={{ flex: '0 0 45%', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {product.image_url ? (
            <img 
              src={product.image_url} 
              alt={product.title} 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
            />
          ) : (
            <svg width="40" height="40" viewBox="0 0 28 28" fill="none" stroke="#2a3b2a" strokeWidth="1" opacity="0.2">
              <path d="M4 7l5-3h10l5 3-4 4v12H8V11L4 7z" />
            </svg>
          )}
        </div>

        {/* Right Column: Details */}
        <div style={{ flex: 1, padding: '32px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink3)', marginBottom: 6 }}>
            {product.vendor}
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 500, color: 'var(--ink)', lineHeight: 1.2, marginBottom: 8, paddingRight: 20 }}>
            {product.title}
          </h2>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 22, color: 'var(--ink)', marginBottom: 4 }}>
            {formatMoney(Number(product.price), product.currency, product.base_currency, rates)}
          </div>
          {meta && <div style={{ fontSize: 13, color: 'var(--ink3)', marginBottom: 24 }}>{meta}</div>}

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 24, paddingBottom: 24, borderBottom: '1px solid var(--m-border)' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: product.in_stock ? '#5a9a5a' : 'var(--ink3)' }} />
            <span style={{ fontSize: 13, color: product.in_stock ? '#5a9a5a' : 'var(--ink3)' }}>
              {product.in_stock ? 'In stock' : 'Contact store for availability'}
            </span>
          </div>

          {product.options && product.options.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
              {product.options.map((opt, idx) => (
                <div key={idx}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink2)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {opt.name}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {opt.values.map((val, vIdx) => (
                      <div key={vIdx} style={{ fontSize: 13, background: 'var(--bg)', border: '1px solid var(--m-border)', padding: '6px 14px', borderRadius: 6, color: 'var(--ink)' }}>
                        {val}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {product.description && (
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink2)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Description</div>
              <div style={{ fontSize: 14, color: 'var(--ink2)', lineHeight: 1.6 }}>
                {product.description}
              </div>
            </div>
          )}

          <div style={{ marginTop: 'auto', paddingTop: 20 }}>
            <a
              href={hasUrl ? product.store_url : undefined}
              target="_blank"
              rel="noopener"
              style={{
                display: 'block',
                width: '100%',
                padding: '14px',
                textAlign: 'center',
                textDecoration: 'none',
                background: hasUrl ? 'var(--m-green)' : 'var(--m-border)',
                color: hasUrl ? 'var(--bg-white)' : 'var(--ink3)',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                cursor: hasUrl ? 'pointer' : 'default',
                pointerEvents: hasUrl ? 'auto' : 'none',
                transition: 'background 0.2s',
              }}
            >
              {ctaLabel}
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
