/**
 * / — FROM's marketing landing. The public face of the product: the pitch,
 * how it works, the brand wall, and the door into the app (/shop). Editorial,
 * warm, minimal — the same language as the app itself.
 */

import HeroPrompt from '@/features/landing/HeroPrompt'
import { CURATED_STORES } from '@/lib/ingestion/curatedStores'

export const metadata = {
  title: 'FROM — End the hunt',
  description:
    'FROM is the AI that understands what you want to wear and finds it across independent and emerging brands — before the mainstream catches up.',
}

const INK = '#2C1206', INK2 = '#4A2010', INK3 = '#9B7060'
const PAPER = '#F7F5F0', BRD = 'rgba(44,18,6,0.08)'
const SANS = "'DM Sans', system-ui, sans-serif"
const SERIF = "'Cormorant Garamond', Georgia, serif"
const SEASON = "'TANMeringue', 'Cormorant Garamond', Georgia, serif"

const shell: React.CSSProperties = { maxWidth: 1060, margin: '0 auto', padding: '0 24px' }
const eyebrow: React.CSSProperties = {
  fontFamily: SANS, fontSize: 11.5, fontWeight: 600, letterSpacing: '.22em',
  textTransform: 'uppercase', color: INK3,
}

export default function Landing() {
  // A wide, de-duplicated set of brand names for the marquee wall.
  const brands = Array.from(new Set(CURATED_STORES.map(s => s.name))).slice(0, 28)

  return (
    <main style={{ fontFamily: SANS, color: INK, background: PAPER, minHeight: '100vh', overflowX: 'hidden' }}>
      {/* Nav */}
      <nav style={{ ...shell, display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 72 }}>
        <div style={{ fontFamily: SEASON, fontSize: 26, letterSpacing: '.02em', color: INK }}>FROM</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <a href="/brands" style={{ fontFamily: SANS, fontSize: 13.5, color: INK2, textDecoration: 'none' }}>For brands</a>
          <a href="/shop" style={{
            fontFamily: SANS, fontSize: 12.5, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase',
            color: '#fff', background: INK, padding: '10px 20px', borderRadius: 30, textDecoration: 'none',
          }}>Enter</a>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ ...shell, textAlign: 'center', paddingTop: 'clamp(48px, 9vw, 104px)', paddingBottom: 'clamp(40px, 7vw, 80px)' }}>
        <div style={eyebrow}>AI fashion search · independent brands</div>
        <h1 style={{
          fontFamily: SERIF, fontWeight: 500, color: INK, margin: '20px 0 0',
          fontSize: 'clamp(44px, 9vw, 92px)', lineHeight: 0.98, letterSpacing: '-.02em',
        }}>
          End the hunt.
        </h1>
        <p style={{
          fontFamily: SANS, fontSize: 'clamp(15px, 2.2vw, 18px)', color: INK2, opacity: .85,
          lineHeight: 1.6, maxWidth: 560, margin: '22px auto 38px',
        }}>
          The best-dressed people aren’t shopping the mainstream — they’re hunting independent
          and emerging brands the algorithms haven’t found yet. Tell FROM what you want.
          It finds it.
        </p>
        <HeroPrompt />
      </section>

      {/* How it works */}
      <section style={{ ...shell, paddingTop: 'clamp(40px, 6vw, 70px)', paddingBottom: 'clamp(40px, 6vw, 70px)' }}>
        <div style={{ ...eyebrow, textAlign: 'center' }}>How it works</div>
        <div style={{
          display: 'grid', gap: 22, marginTop: 34,
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        }}>
          {[
            { n: '01', t: 'Describe it', b: 'In your own words — occasion, vibe, fabric, the feeling you’re after. No filters, no keywords. Or drop in a photo.' },
            { n: '02', t: 'FROM hunts', b: 'It reads the request the way a stylist would and searches a curated world of independent brands — matching taste, not just text.' },
            { n: '03', t: 'You discover', b: 'A feed of pieces worth wanting. Save what you love; FROM learns your taste and gets sharper every time. Buy on the brand’s own site.' },
          ].map(s => (
            <div key={s.n} style={{ background: '#fff', border: `1px solid ${BRD}`, borderRadius: 20, padding: '28px 26px' }}>
              <div style={{ fontFamily: SERIF, fontSize: 30, color: INK3, fontWeight: 500 }}>{s.n}</div>
              <div style={{ fontFamily: SANS, fontSize: 17, fontWeight: 600, color: INK, margin: '10px 0 6px' }}>{s.t}</div>
              <div style={{ fontFamily: SANS, fontSize: 14, color: INK3, lineHeight: 1.6 }}>{s.b}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Pull quote */}
      <section style={{ ...shell, paddingTop: 'clamp(30px, 5vw, 60px)', paddingBottom: 'clamp(40px, 6vw, 70px)', textAlign: 'center' }}>
        <p style={{
          fontFamily: SERIF, fontWeight: 500, color: INK, fontSize: 'clamp(24px, 4.5vw, 40px)',
          lineHeight: 1.25, letterSpacing: '-.01em', maxWidth: 820, margin: '0 auto',
        }}>
          Not a store. Not a marketplace. The first AI that genuinely understands
          what you want to wear — and where to find it.
        </p>
      </section>

      {/* Brand wall */}
      <section style={{ paddingTop: 'clamp(30px, 5vw, 56px)', paddingBottom: 'clamp(40px, 6vw, 70px)' }}>
        <div style={{ ...eyebrow, textAlign: 'center' }}>A hand-picked world of brands</div>
        <div style={{
          ...shell, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '14px 34px', marginTop: 28,
        }}>
          {brands.map(name => (
            <span key={name} style={{ fontFamily: SERIF, fontSize: 'clamp(18px, 2.6vw, 26px)', color: INK2, opacity: .82 }}>
              {name}
            </span>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section style={{ ...shell, textAlign: 'center', paddingTop: 'clamp(40px, 6vw, 64px)', paddingBottom: 'clamp(56px, 8vw, 96px)' }}>
        <h2 style={{ fontFamily: SERIF, fontWeight: 500, fontSize: 'clamp(30px, 6vw, 54px)', color: INK, margin: 0, lineHeight: 1.05 }}>
          Find something worth wanting.
        </h2>
        <a href="/shop" style={{
          display: 'inline-block', marginTop: 28, padding: '16px 40px', borderRadius: 40, background: INK, color: '#fff',
          fontFamily: SANS, fontSize: 13, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', textDecoration: 'none',
        }}>Enter FROM</a>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: `1px solid ${BRD}` }}>
        <div style={{ ...shell, display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between', padding: '26px 24px' }}>
          <div style={{ fontFamily: SEASON, fontSize: 20, color: INK }}>FROM</div>
          <div style={{ display: 'flex', gap: 22, fontFamily: SANS, fontSize: 13 }}>
            <a href="/shop" style={{ color: INK2, textDecoration: 'none' }}>Shop</a>
            <a href="/brands" style={{ color: INK2, textDecoration: 'none' }}>For brands</a>
            <a href="/terms" style={{ color: INK3, textDecoration: 'none' }}>Terms</a>
            <a href="/privacy" style={{ color: INK3, textDecoration: 'none' }}>Privacy</a>
          </div>
        </div>
      </footer>
    </main>
  )
}
