/**
 * /brand/[domain] — a brand's public profile on FROM.
 *
 * Elegant storefront: hero, logo, story, and the brand's live catalog. Only
 * shown for approved brands. Products deep-link to the brand's own store.
 */

import { sql } from '@/lib/db/client'
import { notFound } from 'next/navigation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Brand = {
  store_domain: string
  display_name: string | null
  tagline: string | null
  bio: string | null
  logo_url: string | null
  hero_url: string | null
  instagram: string | null
  website: string | null
  product_count: number | null
}
type Product = {
  id: string
  title: string
  vendor: string
  price_min: number
  currency: string
  store_url: string
  image_url: string
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
  const ink = '#1a1a1a', sub = '#79756d', sans = 'system-ui, -apple-system, sans-serif'

  return (
    <main style={{ fontFamily: sans, color: ink, background: '#faf9f7', minHeight: '100vh' }}>
      {/* Hero */}
      <div style={{
        height: 220, background: brand.hero_url
          ? `center/cover no-repeat url(${brand.hero_url})`
          : 'linear-gradient(135deg, #efece6, #e3ded5)',
        position: 'relative',
      }} />

      <div style={{ maxWidth: 920, margin: '0 auto', padding: '0 18px 90px' }}>
        {/* Identity */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginTop: -44 }}>
          <div style={{
            width: 88, height: 88, borderRadius: 20, background: '#fff', border: '1px solid #e8e6e1',
            overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 6px 20px rgba(0,0,0,.06)',
          }}>
            {brand.logo_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={brand.logo_url} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: 30, fontWeight: 700 }}>{name.charAt(0).toUpperCase()}</span>}
          </div>
          <div style={{ paddingBottom: 6 }}>
            <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>{name}</h1>
            {brand.tagline && <div style={{ fontSize: 14, color: sub, marginTop: 3 }}>{brand.tagline}</div>}
          </div>
        </div>

        {/* Links */}
        <div style={{ display: 'flex', gap: 14, marginTop: 16, fontSize: 13.5 }}>
          {brand.website && <a href={brand.website} target="_blank" rel="noopener" style={{ color: ink, textDecoration: 'underline', textUnderlineOffset: 3 }}>Visit store ↗</a>}
          {brand.instagram && <a href={`https://instagram.com/${brand.instagram}`} target="_blank" rel="noopener" style={{ color: ink, textDecoration: 'underline', textUnderlineOffset: 3 }}>@{brand.instagram}</a>}
          <span style={{ color: sub }}>{brand.product_count ?? products.length} pieces on FROM</span>
        </div>

        {brand.bio && (
          <p style={{ fontSize: 15, lineHeight: 1.65, color: '#3a3733', marginTop: 20, maxWidth: 640 }}>{brand.bio}</p>
        )}

        {/* Catalog */}
        <div style={{ marginTop: 30, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16 }}>
          {products.map(p => (
            <a key={p.id} href={p.store_url} target="_blank" rel="noopener"
               style={{ textDecoration: 'none', color: ink }}>
              <div style={{ aspectRatio: '3/4', borderRadius: 14, overflow: 'hidden', background: '#efece6' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.image_url} alt={p.title} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div style={{ fontSize: 13, marginTop: 8, lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.title}</div>
              <div style={{ fontSize: 13, color: sub, marginTop: 2 }}>{money(Number(p.price_min), p.currency)}</div>
            </a>
          ))}
        </div>

        {products.length === 0 && (
          <div style={{ marginTop: 30, fontSize: 14, color: sub }}>This brand’s catalog is syncing — check back shortly.</div>
        )}
      </div>
    </main>
  )
}
