'use client'
import { useEffect, useState, useRef } from 'react'
import type { DiscoverProduct } from './types'

type Props = {
  product: DiscoverProduct | null
  onClose: () => void
  onFindSimilar?: (product: DiscoverProduct) => void
  saved: boolean
  onSave: () => void
}

export default function ProductSheet({ product, onClose, onFindSimilar, saved, onSave }: Props) {
  const [imgIdx, setImgIdx]   = useState(0)
  const [visible, setVisible] = useState(false)
  const touchX = useRef<number | null>(null)

  useEffect(() => {
    if (product) {
      setImgIdx(0)
      requestAnimationFrame(() => setVisible(true))
    } else {
      setVisible(false)
    }
  }, [product])

  if (!product) return null

  const images = product.images?.length > 0 ? product.images : [product.image_url]
  const hasOptions = product.options?.some(o => o.values.length > 1)

  const prev = () => setImgIdx(i => (i - 1 + images.length) % images.length)
  const next = () => setImgIdx(i => (i + 1) % images.length)

  const onTouchStart = (e: React.TouchEvent) => { touchX.current = e.touches[0].clientX }
  const onTouchEnd   = (e: React.TouchEvent) => {
    if (touchX.current === null) return
    const delta = e.changedTouches[0].clientX - touchX.current
    if (Math.abs(delta) > 40) delta < 0 ? next() : prev()
    touchX.current = null
  }

  const close = () => {
    setVisible(false)
    setTimeout(onClose, 280)
  }

  const price = new Intl.NumberFormat('en-US', {
    style: 'currency', currency: product.currency || 'USD',
    maximumFractionDigits: product.currency === 'JPY' || product.currency === 'KRW' ? 0 : 2,
  }).format(product.price_min)

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={close}
        style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(0,0,0,0.55)',
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.28s ease',
        }}
      />

      {/* Sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 51,
        background: 'var(--bg-raised)',
        borderRadius: '24px 24px 0 0',
        maxHeight: '90dvh',
        overflowY: 'auto',
        transform: visible ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.30s cubic-bezier(0.16,1,0.3,1)',
        WebkitOverflowScrolling: 'touch',
      }}>
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border-hi)' }} />
        </div>

        {/* Image gallery */}
        <div
          style={{ position: 'relative', width: '100%', aspectRatio: '3/4', background: 'var(--bg)', userSelect: 'none' }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <img
            src={images[imgIdx]}
            alt={product.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={e => { (e.target as HTMLImageElement).src = images[0] }}
          />

          {images.length > 1 && (
            <>
              <button onClick={prev} style={arrowBtn('left')}>‹</button>
              <button onClick={next} style={arrowBtn('right')}>›</button>
              <div style={{
                position: 'absolute', bottom: 12, left: 0, right: 0,
                display: 'flex', justifyContent: 'center', gap: 6,
              }}>
                {images.map((_, i) => (
                  <div key={i} onClick={() => setImgIdx(i)} style={{
                    width: i === imgIdx ? 18 : 6, height: 6,
                    borderRadius: 3, background: i === imgIdx ? '#fff' : 'rgba(255,255,255,0.5)',
                    transition: 'all 0.2s ease', cursor: 'pointer',
                  }} />
                ))}
              </div>
            </>
          )}

          {/* Save button */}
          <button onClick={onSave} style={{
            position: 'absolute', top: 12, right: 12,
            width: 40, height: 40, borderRadius: '50%',
            background: 'rgba(0,0,0,0.35)', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: 20,
            transition: 'transform 0.15s ease',
          }}>
            {saved ? '❤️' : '🤍'}
          </button>
        </div>

        {/* Details */}
        <div style={{ padding: '20px 20px 8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div>
              <p style={{ fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--body)', fontWeight: 400, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {product.vendor}
              </p>
              <h2 style={{ fontSize: 18, fontFamily: 'var(--serif)', fontWeight: 400, color: 'var(--ink)', lineHeight: 1.25 }}>
                {product.title}
              </h2>
            </div>
            <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)', fontFamily: 'var(--body)', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {price}
            </span>
          </div>

          {/* Tags */}
          {product.tags?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
              {product.tags.slice(0, 6).map(t => (
                <span key={t} style={{
                  fontSize: 11, padding: '3px 9px', borderRadius: 99,
                  background: 'var(--accent-bg)', color: 'var(--accent)',
                  fontFamily: 'var(--body)', textTransform: 'lowercase',
                }}>
                  {t}
                </span>
              ))}
            </div>
          )}

          {/* Description */}
          {product.description && (
            <p style={{
              marginTop: 14, fontSize: 13.5, lineHeight: 1.6,
              color: 'var(--ink-2)', fontFamily: 'var(--body)', fontWeight: 300,
              display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}>
              {product.description}
            </p>
          )}

          {/* Options */}
          {hasOptions && product.options.map(opt => (
            <div key={opt.name} style={{ marginTop: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink-3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {opt.name}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {opt.values.map(v => (
                  <span key={v} style={{
                    padding: '6px 14px', borderRadius: 8,
                    border: '1px solid var(--border)',
                    fontSize: 13, color: 'var(--ink)',
                    fontFamily: 'var(--body)',
                    cursor: 'pointer',
                  }}>
                    {v}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div style={{ padding: '16px 20px 32px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <a
            href={product.store_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'block', textAlign: 'center',
              padding: '15px', borderRadius: 14,
              background: 'var(--ink)', color: 'var(--bg)',
              fontFamily: 'var(--body)', fontSize: 15, fontWeight: 500,
              textDecoration: 'none', letterSpacing: '0.02em',
            }}
          >
            Shop at {product.vendor} →
          </a>

          {onFindSimilar && (
            <button
              onClick={() => { onFindSimilar(product); close() }}
              style={{
                width: '100%', padding: '14px', borderRadius: 14,
                border: '1.5px solid var(--border)', background: 'transparent',
                color: 'var(--ink)', fontFamily: 'var(--body)', fontSize: 15,
                fontWeight: 400, cursor: 'pointer',
              }}
            >
              Find more like this
            </button>
          )}
        </div>
      </div>
    </>
  )
}

function arrowBtn(side: 'left' | 'right'): React.CSSProperties {
  return {
    position: 'absolute', top: '50%', [side]: 12,
    transform: 'translateY(-50%)',
    width: 36, height: 36, borderRadius: '50%',
    background: 'rgba(0,0,0,0.30)', border: 'none',
    color: '#fff', fontSize: 22, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'var(--serif)',
  }
}
