/**
 * /brand/[domain] — a brand's public profile on FROM. Editorial storefront in
 * the shopper app's warm language: serif display, brown ink on paper, the
 * brand's best-shot catalogue. Approved brands only.
 */

import { sql } from '@/lib/db/client'
import { notFound } from 'next/navigation'
import {
  INK, INK2, INK3, PAPER, BRD, SANS, SERIF,
} from '@/features/brands/theme'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Brand = {
  id: string; store_domain: string; display_name: string | null
  tagline: string | null; bio: string | null; logo_url: string | null
  hero_url: string | null; instagram: string | null; website: string | null
  product_count: number | null
}
type Product = {
  id: string; title: string; vendor: string; price_min: number
  currency: string; store_url: string; image_url: string
}

async function load(slug: string): Promise<{ brand: Brand; products: Product[] } | null> {
  if (!process.env.DATABASE_URL) return null
  const db = sql()
  const s = slug.toLowerCase()
  const rows = await db`
    SELECT id, store_domain, display_name, tagline, bio, logo_url, hero_url,
           instagram, website, product_count
    FROM brand_accounts
    WHERE status = 'approved'
      AND (lower(display_name) = ${s} OR store_domain = ${s} OR store_domain = ${s + '.myshopify.com'})
    LIMIT 1
  `
  const brand = (rows as any[])[0]
  if (!brand) return null
  const products = await db`
    SELECT id, title, vendor, price_min, currency, store_url, image_url
    FROM products
    WHERE brand_account_id = ${brand.id} AND published = TRUE AND image_url <> ''
    ORDER BY in_stock DESC, updated_at DESC
    LIMIT 30
  `
  return { brand, products: products as any[] }
}

function money(n: number, currency: string): string {
  try { return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n) }
  catch { return `${currency} ${Math.round(n)}` }
}

export default async function BrandProfile({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params
  let data: Awaited<ReturnType<typeof load>> = null
  try { data = await load(domain) } catch { data = null }
  if (!data) notFound()

  const { brand, products } = data
  const name = brand.display_name || brand.store_domain.replace(/\.myshopify\.com$/, '')

  return (
    <main style={{ fontFamily: SANS, color: INK, background: PAPER, minHeight: '100vh' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=DM+Sans:wght@300;400;500;600&display=swap');`}</style>

      {/* Hero */}
      <div style={{
        height: 260,
        background: brand.hero_url
          ? `center/cover no-repeat url(${brand.hero_url})`
          : 'linear-gradient(135deg, #efe9e1, #e6ddd2)',
      }} />

      <div style={{ maxWidth: 940, margin: '0 auto', padding: '0 22px 110px' }}>
        {/* Identity */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18, marginTop: -52 }}>
          <div style={{
            width: 104, height: 104, borderRadius: 24, background: '#fff', border: `1px solid ${BRD}`,
            overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 10px 34px rgba(44,18,6,.12)',
          }}>
            {brand.logo_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={brand.logo_url} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontFamily: SERIF, fontSize: 42, fontWeight: 500, color: INK }}>{name.charAt(0).toUpperCase()}</span>}
          </div>
          <div style={{ paddingBottom: 8 }}>
            <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(30px,6vw,44px)', fontWeight: 500, letterSpacing: '-.01em', color: INK, margin: 0, lineHeight: 1 }}>{name}</h1>
            {brand.tagline && <div style={{ fontFamily: SANS, fontSize: 14.5, color: INK3, marginTop: 8 }}>{brand.tagline}</div>}
          </div>
        </div>

        {/* Links */}
        <div style={{ display: 'flex', gap: 18, marginTop: 20, fontFamily: SANS, fontSize: 13.5, alignItems: 'center', flexWrap: 'wrap' }}>
          {brand.website && <a href={brand.website} target="_blank" rel="noopener" style={{ color: INK, textDecoration: 'underline', textUnderlineOffset: 3 }}>Visit store ↗</a>}
          {brand.instagram && <a href={`https://instagram.com/${brand.instagram}`} target="_blank" rel="noopener" style={{ color: INK, textDecoration: 'underline', textUnderlineOffset: 3 }}>@{brand.instagram}</a>}
          <span style={{ color: INK3 }}>{brand.product_count ?? products.length} pieces on FROM</span>
        </div>

        {brand.bio && (
          <p style={{ fontFamily: SERIF, fontSize: 'clamp(18px,2.6vw,22px)', lineHeight: 1.55, color: INK2, marginTop: 26, maxWidth: 680, fontWeight: 400 }}>
            {brand.bio}
          </p>
        )}

        {/* Catalogue */}
        <div style={{ marginTop: 38, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(168px, 1fr))', gap: 20 }}>
          {products.map(p => (
            <a key={p.id} href={p.store_url} target="_blank" rel="noopener" style={{ textDecoration: 'none', color: INK }}>
              <div style={{ aspectRatio: '3/4', borderRadius: 14, overflow: 'hidden', background: '#efe9e1' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.image_url} alt={p.title} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div style={{ fontFamily: SANS, fontSize: 13, marginTop: 9, lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.title}</div>
              <div style={{ fontFamily: SERIF, fontSize: 16, color: INK2, marginTop: 3 }}>{money(Number(p.price_min), p.currency)}</div>
            </a>
          ))}
        </div>

        {products.length === 0 && (
          <div style={{ fontFamily: SANS, marginTop: 34, fontSize: 14, color: INK3 }}>This brand’s catalogue is syncing — check back shortly.</div>
        )}

        {/* Footer wordmark */}
        <div style={{ marginTop: 70, textAlign: 'center', fontFamily: SERIF, fontSize: 20, letterSpacing: '.04em', color: INK3 }}>FROM</div>
      </div>
    </main>
  )
}
