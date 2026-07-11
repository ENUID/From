// @ts-nocheck
// ── PARKED, NOT LIVE ──────────────────────────────────────────────────────
// This was the home page's product results grid — a loading skeleton, an
// empty state, the responsive `.fr-grid` of product cards, a load-more
// skeleton, and an infinite-scroll sentinel. It rendered `searchProducts`
// (derived from the old grid-search `messages` state) before FROM unified
// onto a single conversational surface (Fabrics).
//
// This file is NOT imported anywhere and does not run. It's kept as a
// reference snapshot — exactly the JSX that used to live inline in
// `DiscernPage.tsx` — for a future, different feature that wants a dedicated
// browsable grid again. `// @ts-nocheck` is deliberate: this component
// depends on ~15 pieces of DiscernPage-local state, refs, and helper
// components (CardCarousel, ProductMeta, makePressHandlers, etc.) that
// aren't exported/typed for standalone reuse. To resurrect: copy the JSX
// back into a live component, thread in real implementations for every
// prop below (see the destructured names), and wire a `.fr-grid`/`.fr-card`
// CSS block (still defined in DiscernPage.tsx) alongside it.
//
// Companion parked pieces: web/lib/_parked/ai-chat-route.ts (backend),
// web/features/discern/hooks/_parked/useLegacySearch.ts (state/actions).
// ─────────────────────────────────────────────────────────────────────────

export default function LegacySearchGrid(props: {
  loading: boolean
  productsLoading: boolean
  showEmpty: boolean
  showExplore: boolean
  hasConversation: boolean
  searchProducts: any[]
  lastProductMsg: any
  cardColors: Record<string, string>
  setCardColors: (fn: (m: Record<string, string>) => Record<string, string>) => void
  savedIds: Set<string>
  toggleSaved: (p: any) => void
  setSelected: (p: any) => void
  setProductCtxMenu: (menu: any) => void
  makePressHandlers: (onLongPress: (x: number, y: number) => void) => any
  productWasLong: { current: boolean }
  ctxMenuOpenAt: { current: number }
  sentinelRef: React.RefObject<HTMLDivElement>
  getProductColors: (p: any) => string[]
  getColorVariantImages: (p: any, color: string | null) => string[]
  getProductImages: (p: any) => string[]
  liveRates: any
  CardCarousel: React.ComponentType<any>
  ProductMeta: React.ComponentType<any>
}) {
  const {
    loading, productsLoading, showEmpty, showExplore, hasConversation,
    searchProducts, lastProductMsg, cardColors, setCardColors,
    savedIds, toggleSaved, setSelected, setProductCtxMenu,
    makePressHandlers, productWasLong, ctxMenuOpenAt, sentinelRef,
    getProductColors, getColorVariantImages, getProductImages, liveRates,
    CardCarousel, ProductMeta,
  } = props

  return (
    <>
      {/* Loading — skeleton image grid */}
      {(loading || productsLoading) && (
        <div className="fr-grid">
          {Array.from({ length: 24 }).map((_, i) => (
            <div key={i} className="fr-card">
              <div style={{
                aspectRatio: '3/4',
                position: 'relative',
                overflow: 'hidden',
                background: '#EEEEEE',
              }}>
                {/* Shimmer: fade from base color → light → base color — no dark edges */}
                <div style={{
                  position: 'absolute', top: 0, bottom: 0,
                  width: '60%',
                  background: 'linear-gradient(90deg, #EEEEEE 0%, #F4F4F4 35%, #F6F6F6 50%, #F4F4F4 65%, #EEEEEE 100%)',
                  animation: `sk-sweep 2s ${i * 0.06}s ease-in-out infinite`,
                  willChange: 'transform',
                }} />
              </div>
              {/* Meta placeholders — keep the card height stable while loading */}
              <div style={{ padding: '9px 4px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ height: 9, width: '85%', background: '#EEEEEE', borderRadius: 2 }} />
                <div style={{ height: 9, width: '40%', background: '#EEEEEE', borderRadius: 2 }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {showEmpty && !loading && !showExplore && (
        <div style={{ padding: "48px 20px", textAlign: "center" }}>
          <p style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 300, fontStyle: "italic", color: 'var(--ink3)' }}>Nothing found</p>
          <span style={{ fontFamily: 'var(--sans)', fontSize: 10, color: 'var(--ink3)', letterSpacing: ".1em", display: "block", marginTop: 6, opacity: .6 }}>Try a different search</span>
        </div>
      )}

      {/* Product grid */}
      {(hasConversation || showExplore) && !loading && !productsLoading && searchProducts.length > 0 && (
        <>
          <div className="fr-grid">
            {searchProducts.map(p => {
              const cardColor = cardColors[p.id] ?? getProductColors(p)[0] ?? null
              const colorImgs = getColorVariantImages(p, cardColor)
              const cardImgs = colorImgs.length > 0 ? colorImgs : getProductImages(p)
              return (
              <div key={p.id} className="fr-card">
                <div className="fr-cell"
                  role="button" tabIndex={0}
                  {...makePressHandlers((x, y) => {
                    productWasLong.current = true
                    const menuW = 200; const menuH = 160
                    const above = y + 8 + menuH > window.innerHeight
                    const my = Math.max(8, above ? y - menuH - 4 : y + 8)
                    const mx = Math.max(8, Math.min(x, window.innerWidth - menuW - 8))
                    ctxMenuOpenAt.current = Date.now()
                    setProductCtxMenu({ product: p, x: mx, y: my, above })
                  })}
                  onKeyDown={e => e.key === 'Enter' && setSelected(p)}>
                  <CardCarousel
                    key={cardColor ?? 'default'}
                    images={cardImgs}
                    onOpen={() => { if (productWasLong.current) { productWasLong.current = false; return }; setSelected(p) }}
                  />
                </div>
                <ProductMeta p={p} rates={liveRates} saved={savedIds.has(p.id)} onSave={() => toggleSaved(p)} onOpen={() => setSelected(p)}
                  activeColor={cardColor} onSelectColor={c => setCardColors(m => ({ ...m, [p.id]: c }))} />
              </div>
              )
            })}
          </div>
          {lastProductMsg?.loadingMore && !productsLoading && (
            <div className="fr-grid" style={{ marginTop: 26 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="fr-card">
                  <div className="fr-cell" style={{ background: '#EEEEEE', overflow: 'hidden' }}>
                    <div style={{ position:'absolute',top:0,bottom:0,width:'60%',
                      background:'linear-gradient(90deg,#EEEEEE 0%,#F4F4F4 35%,#F6F6F6 50%,#F4F4F4 65%,#EEEEEE 100%)',
                      animation:`sk-sweep 2s ${i * 0.1}s ease-in-out infinite`,willChange:'transform' }} />
                  </div>
                  <div style={{ padding: '9px 4px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ height: 9, width: '85%', background: '#EEEEEE', borderRadius: 2 }} />
                    <div style={{ height: 9, width: '40%', background: '#EEEEEE', borderRadius: 2 }} />
                  </div>
                </div>
              ))}
            </div>
          )}
          <div ref={sentinelRef} style={{ height: 1 }} />
        </>
      )}
    </>
  )
}
