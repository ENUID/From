'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import ProductSheet from './ProductSheet'
import { useDiscover } from './useDiscover'
import { AESTHETICS } from './types'
import type { DiscoverProduct, Gender } from './types'

const SAVED_KEY = 'from:saved-v2'

function getSaved(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(SAVED_KEY) || '[]')) } catch { return new Set() }
}
function toggleSaved(id: string): Set<string> {
  const s = getSaved()
  s.has(id) ? s.delete(id) : s.add(id)
  localStorage.setItem(SAVED_KEY, JSON.stringify(Array.from(s)))
  return s
}

// ── Skeleton card ─────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div style={{ borderRadius: 16, overflow: 'hidden', background: 'var(--bg-raised)' }}>
      <div style={{
        aspectRatio: '3/4',
        background: 'linear-gradient(90deg, var(--border) 25%, var(--bg) 50%, var(--border) 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmerSweep 1.4s ease-in-out infinite',
      }} />
      <div style={{ padding: '10px 12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ height: 10, width: '50%', borderRadius: 6, background: 'var(--border)' }} />
        <div style={{ height: 13, width: '80%', borderRadius: 6, background: 'var(--border)' }} />
        <div style={{ height: 11, width: '35%', borderRadius: 6, background: 'var(--border)', marginTop: 2 }} />
      </div>
    </div>
  )
}

// ── Product card ──────────────────────────────────────────────────────────────
type CardProps = {
  product: DiscoverProduct
  saved: boolean
  onSave: (e: React.MouseEvent) => void
  onClick: () => void
}

function ProductCard({ product, saved, onSave, onClick }: CardProps) {
  const [imgLoaded, setImgLoaded] = useState(false)
  const [heartBounce, setHeartBounce] = useState(false)

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation()
    setHeartBounce(true)
    setTimeout(() => setHeartBounce(false), 400)
    onSave(e)
  }

  const price = new Intl.NumberFormat('en-US', {
    style: 'currency', currency: product.currency || 'USD',
    maximumFractionDigits: product.currency === 'JPY' || product.currency === 'KRW' ? 0 : 2,
  }).format(product.price_min)

  return (
    <div
      onClick={onClick}
      style={{ cursor: 'pointer', borderRadius: 16, overflow: 'hidden', background: 'var(--bg-raised)' }}
    >
      {/* Image */}
      <div style={{ position: 'relative', aspectRatio: '3/4', background: 'var(--bg)', overflow: 'hidden' }}>
        {!imgLoaded && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(90deg, var(--border) 25%, var(--bg) 50%, var(--border) 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmerSweep 1.4s ease-in-out infinite',
          }} />
        )}
        <img
          src={product.image_url}
          alt={product.title}
          loading="lazy"
          onLoad={() => setImgLoaded(true)}
          style={{
            width: '100%', height: '100%', objectFit: 'cover',
            opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.3s ease',
          }}
        />

        {/* Save / heart */}
        <button
          onClick={handleSave}
          style={{
            position: 'absolute', top: 9, right: 9,
            width: 34, height: 34, borderRadius: '50%',
            background: 'rgba(255,255,255,0.88)',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, backdropFilter: 'blur(6px)',
            transform: heartBounce ? 'scale(1.35)' : 'scale(1)',
            transition: 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1)',
          }}
          aria-label={saved ? 'Unsave' : 'Save'}
        >
          {saved ? '❤️' : '🤍'}
        </button>

        {/* Out of stock badge */}
        {!product.in_stock && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            background: 'rgba(0,0,0,0.50)',
            color: '#fff', fontSize: 10, textAlign: 'center', padding: '4px 0',
            fontFamily: 'var(--body)', letterSpacing: '0.06em', textTransform: 'uppercase',
          }}>
            Sold out
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '10px 12px 14px' }}>
        <p style={{
          fontSize: 10.5, color: 'var(--ink-3)', fontFamily: 'var(--body)',
          fontWeight: 400, textTransform: 'uppercase', letterSpacing: '0.07em',
          marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {product.vendor}
        </p>
        <p style={{
          fontSize: 13, color: 'var(--ink)', fontFamily: 'var(--body)', fontWeight: 400,
          lineHeight: 1.3,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          marginBottom: 5,
        }}>
          {product.title}
        </p>
        <p style={{ fontSize: 13, color: 'var(--ink)', fontFamily: 'var(--body)', fontWeight: 600 }}>
          {price}
        </p>
      </div>
    </div>
  )
}

// ── Aesthetic chip ────────────────────────────────────────────────────────────
type ChipProps = { label: string; emoji: string; active: boolean; onClick: () => void }
function AestheticChip({ label, emoji, active, onClick }: ChipProps) {
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0,
        padding: '8px 16px', borderRadius: 99,
        border: active ? '1.5px solid var(--accent)' : '1.5px solid var(--border)',
        background: active ? 'var(--accent-bg)' : 'var(--bg-raised)',
        color: active ? 'var(--accent)' : 'var(--ink-2)',
        fontFamily: 'var(--body)', fontSize: 13.5, fontWeight: active ? 500 : 400,
        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
        transition: 'all 0.15s ease', whiteSpace: 'nowrap',
      }}
    >
      <span style={{ fontSize: 14 }}>{emoji}</span>
      {label}
    </button>
  )
}

// ── Empty / setup state ───────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: 400, padding: '40px 32px', textAlign: 'center', gap: 16,
    }}>
      <span style={{ fontSize: 48 }}>🗄</span>
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 400, color: 'var(--ink)' }}>
        Catalog not synced yet
      </h3>
      <p style={{ fontFamily: 'var(--body)', fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.6, maxWidth: 320 }}>
        The discovery feed needs a Neon database and an initial catalog sync.
        Set <code style={{ background: 'var(--accent-bg)', padding: '1px 6px', borderRadius: 4, fontSize: 12 }}>DATABASE_URL</code> in your environment, run the schema setup, then trigger a sync.
      </p>
      <a
        href="https://neon.tech"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          padding: '10px 24px', borderRadius: 10,
          background: 'var(--accent)', color: '#fff',
          fontFamily: 'var(--body)', fontSize: 14, textDecoration: 'none',
        }}
      >
        Create free Neon database →
      </a>
    </div>
  )
}

// ── Main feed ─────────────────────────────────────────────────────────────────
export default function DiscoverFeed() {
  const [style, setStyle]   = useState('')
  const [gender, setGender] = useState<Gender>('all')
  const [sheet, setSheet]   = useState<DiscoverProduct | null>(null)
  const [saved, setSaved]   = useState<Set<string>>(() => typeof window !== 'undefined' ? getSaved() : new Set())

  const { products, loading, loadingMore, hasMore, error, empty, refresh, loadMore } = useDiscover(style, gender)

  // Load on mount and when filters change
  useEffect(() => { refresh() }, [style, gender]) // eslint-disable-line react-hooks/exhaustive-deps

  // Infinite scroll sentinel
  const sentinel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = sentinel.current
    if (!el) return
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loadingMore) loadMore()
    }, { rootMargin: '600px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [hasMore, loadingMore, loadMore])

  const handleSave = useCallback((productId: string) => {
    setSaved(toggleSaved(productId))
  }, [])

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)' }}>

      {/* ── Header ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'var(--bg)', borderBottom: '1px solid var(--border)',
        paddingTop: 'env(safe-area-inset-top)',
      }}>
        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px 10px' }}>
          <h1 style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 400, color: 'var(--ink)', letterSpacing: '-0.01em' }}>
            Discover
          </h1>
          {/* Gender pills */}
          <div style={{ display: 'flex', gap: 6, background: 'var(--border)', borderRadius: 99, padding: 3 }}>
            {(['all', 'women', 'men'] as Gender[]).map(g => (
              <button
                key={g}
                onClick={() => setGender(g)}
                style={{
                  padding: '5px 14px', borderRadius: 99, border: 'none', cursor: 'pointer',
                  background: gender === g ? 'var(--bg-raised)' : 'transparent',
                  color: gender === g ? 'var(--ink)' : 'var(--ink-3)',
                  fontFamily: 'var(--body)', fontSize: 12.5, fontWeight: gender === g ? 500 : 400,
                  transition: 'all 0.15s ease', textTransform: 'capitalize',
                  boxShadow: gender === g ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                {g === 'all' ? 'All' : g === 'women' ? 'Women' : 'Men'}
              </button>
            ))}
          </div>
        </div>

        {/* Aesthetic chips */}
        <div style={{
          display: 'flex', gap: 8, overflowX: 'auto', padding: '0 20px 14px',
          scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch',
        }}>
          {AESTHETICS.map(a => (
            <AestheticChip
              key={a.key}
              label={a.label}
              emoji={a.emoji}
              active={style === a.key}
              onClick={() => setStyle(a.key)}
            />
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ padding: '16px 12px' }}>

        {/* Error */}
        {error && (
          <div style={{
            margin: '20px 8px', padding: '14px 18px', borderRadius: 12,
            background: '#fdf0ee', border: '1px solid #f5c6c0',
            fontFamily: 'var(--body)', fontSize: 13, color: '#c0392b',
          }}>
            {error}
          </div>
        )}

        {/* Empty / not configured */}
        {empty && !loading && <EmptyState />}

        {/* Grid */}
        {(products.length > 0 || loading) && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))',
            gap: 12,
          }}>
            {loading
              ? Array.from({ length: 12 }, (_, i) => <SkeletonCard key={i} />)
              : products.map(p => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    saved={saved.has(p.id)}
                    onSave={() => handleSave(p.id)}
                    onClick={() => setSheet(p)}
                  />
                ))
            }
            {/* Load-more skeletons */}
            {loadingMore && Array.from({ length: 6 }, (_, i) => <SkeletonCard key={`more-${i}`} />)}
          </div>
        )}

        {/* Infinite scroll sentinel */}
        <div ref={sentinel} style={{ height: 1 }} />

        {/* End of feed */}
        {!hasMore && products.length > 0 && !loadingMore && (
          <p style={{
            textAlign: 'center', padding: '32px 0',
            fontFamily: 'var(--body)', fontSize: 13, color: 'var(--ink-4)',
          }}>
            You've seen everything ✦
          </p>
        )}
      </div>

      {/* ── Product detail sheet ── */}
      <ProductSheet
        product={sheet}
        onClose={() => setSheet(null)}
        saved={sheet ? saved.has(sheet.id) : false}
        onSave={() => sheet && handleSave(sheet.id)}
        onFindSimilar={(p) => {
          setSheet(null)
          // Future: wire to search
        }}
      />
    </div>
  )
}
