'use client'

import { useState, useEffect, useRef } from 'react'
import { useChatWorkspace } from './hooks/useChatWorkspace'
import { formatMoney } from '@/lib/currency'
import type { BuyerContext } from '@/lib/buyerContext'
import { ExchangeRates } from '@/lib/exchangeRates'
import type { Product } from '@/components/ProductCard'

// ── Palette — pure black & white ─────────────────────────────────────────────
const BG    = "#ffffff"
const INK   = "#000000"
const INK2  = "#1a1a1a"
const INK3  = "#555555"
const BRD   = "rgba(0,0,0,0.09)"
const SANS  = "'DM Sans', system-ui, sans-serif"
const SERIF = "'Cormorant Garamond', Georgia, serif"

// ── FROM wordmark — Bodoni Moda (Season-equivalent: same high-contrast hairlines) ──
const SEASON = "'Bodoni Moda', 'Cormorant Garamond', Georgia, serif"

function FromLogo({ size = 28, color = "#000000" }: { size?: number; color?: string }) {
  return (
    <span style={{
      fontFamily: SEASON,
      fontSize: size,
      fontWeight: 400,
      color,
      letterSpacing: '0.03em',
      lineHeight: 1,
      display: 'block',
      userSelect: 'none',
    }}>
      From
    </span>
  )
}

// ── Sheet info divider row ────────────────────────────────────────────────────
function InfoSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <div style={{ height: 1, background: BRD, margin: "0 20px" }} />
      <div style={{ padding: "13px 20px" }}>
        <p style={{ fontFamily: SANS, fontSize: 9, fontWeight: 600, letterSpacing: ".18em", textTransform: "uppercase", color: INK3, marginBottom: 9 }}>{label}</p>
        {children}
      </div>
    </>
  )
}

// ── Product helpers ───────────────────────────────────────────────────────────
function getProductImages(p: Product): string[] {
  const list: string[] = []
  if (p.image_url) list.push(p.image_url)
  p.media?.forEach(m => { if (m.url && !list.includes(m.url)) list.push(m.url) })
  p.variants?.forEach(v => { v.media?.forEach(m => { if (m.url && !list.includes(m.url)) list.push(m.url) }) })
  return list
}

function getDescriptionText(p: Product): string {
  if (!p.description) return ''
  return p.description
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n').replace(/<\/li>/gi, '\n')
    .replace(/<[^>]*>/g, '').trim()
}

function extractMaterial(p: Product): string {
  const t = p.tags?.find(t => t?.toLowerCase().includes('material') || t?.toLowerCase().includes('fabric'))
  if (t) return t.split('=>').pop()?.trim() || ''
  const m = getDescriptionText(p).match(/(cotton|linen|wool|silk|hemp|polyester|leather|canvas|cashmere|denim|viscose|nylon|spandex)/i)
  return m?.[0] || ''
}

function getProductSizes(p: Product): string[] {
  return p.options?.find(o => o.name.toLowerCase().includes('size'))?.values || []
}

function getCheckoutUrl(p: Product, size: string | null): string {
  const v = size
    ? p.variants?.find(v => v.options.some(o => o.label === size))
    : p.variants?.[0]
  if (!v) return p.store_url
  try {
    const url = new URL(p.store_url)
    return `https://${url.hostname}/cart/${v.id.split('/').pop()}:1`
  } catch { return p.store_url }
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function FromApp({
  initialBuyerContext,
  initialRates,
}: {
  initialBuyerContext: BuyerContext
  initialRates: ExchangeRates
}) {
  const {
    messages, input, setInput, loading, hasConversation,
    savedIds, savedProducts, searchHistory, buyerContext, rates,
    sendMessage, toggleSaved, resetConversation, loadMoreProducts,
  } = useChatWorkspace(initialBuyerContext, initialRates)

  // Local UI state
  const [userName, setUserName]         = useState("")
  const [isEditingName, setIsEditing]   = useState(false)
  const [nameInput, setNameInput]       = useState("")
  const [selectedProduct, setSelected]  = useState<Product | null>(null)
  const [selectedSize, setSize]         = useState<string | null>(null)
  const [activeImg, setActiveImg]       = useState(0)
  const [sheetY, setSheetY]             = useState(0)
  const [isDragging, setIsDragging]     = useState(false)
  const [sidebarOpen, setSidebar]       = useState(false)
  const [sidebarView, setSidebarView]   = useState<'nav' | 'saved'>('nav')
  const [uploadedImage, setUploaded]    = useState<string | null>(null)
  const [uploadName, setUploadName]     = useState("")
  const [loaded, setLoaded]             = useState(false)

  const nameRef    = useRef<HTMLInputElement>(null)
  const taRef      = useRef<HTMLTextAreaElement>(null)
  const fileRef    = useRef<HTMLInputElement>(null)
  const dragStartY = useRef(0)

  // Search results — only shown after user sends a message
  const lastProductMsg      = [...messages].reverse().find(m => m.role === 'assistant' && m.products?.length)
  const lastProductMsgIndex = lastProductMsg ? messages.lastIndexOf(lastProductMsg as any) : -1
  const searchProducts: Product[] = lastProductMsg?.products || []
  const lastAssistantText   = [...messages].reverse().find(m => m.role === 'assistant')?.content || ''
  const showEmpty           = hasConversation && searchProducts.length === 0 && !loading
  const canSend             = input.trim().length > 0 || !!uploadedImage
  const hasName             = userName.length > 0

  useEffect(() => { setTimeout(() => setLoaded(true), 60) }, [])
  useEffect(() => { if (isEditingName && nameRef.current) { nameRef.current.focus(); nameRef.current.select() } }, [isEditingName])
  useEffect(() => { if (selectedProduct) { setSize(null); setActiveImg(0); setSheetY(0) } }, [selectedProduct])
  useEffect(() => {
    if (taRef.current) {
      taRef.current.style.height = "auto"
      taRef.current.style.height = Math.min(taRef.current.scrollHeight, 120) + "px"
    }
  }, [input])

  // Sheet drag
  const onHandleDown = (e: React.PointerEvent) => {
    e.preventDefault()
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    dragStartY.current = e.clientY - sheetY
    setIsDragging(true)
  }
  const onHandleMove = (e: React.PointerEvent) => { if (isDragging) setSheetY(Math.max(0, e.clientY - dragStartY.current)) }
  const onHandleUp   = () => {
    if (!isDragging) return
    setIsDragging(false)
    if (sheetY > 100) { setSelected(null); setSheetY(0) } else setSheetY(0)
  }

  const doSearch = () => {
    if (!canSend || loading) return
    const q = [input.trim(), uploadName].filter(Boolean).join(' ')
    if (!q) return
    sendMessage(q)
    setUploaded(null); setUploadName('')
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setUploaded(ev.target?.result as string)
    reader.readAsDataURL(file)
    setUploadName(file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ').toLowerCase())
  }

  const removeUpload = () => { setUploaded(null); setUploadName(''); if (fileRef.current) fileRef.current.value = '' }
  const saveName = () => { setUserName(nameInput.trim()); setIsEditing(false) }
  const kd = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); doSearch() } }

  // Sheet derived
  const sheetImages   = selectedProduct ? getProductImages(selectedProduct) : []
  const sheetDesc     = selectedProduct ? getDescriptionText(selectedProduct) : ''
  const sheetMaterial = selectedProduct ? extractMaterial(selectedProduct) : ''
  const sheetSizes    = selectedProduct ? getProductSizes(selectedProduct) : []
  const checkoutUrl   = selectedProduct ? getCheckoutUrl(selectedProduct, selectedSize) : '#'

  return (
    <div style={{ fontFamily: SANS, background: BG, minHeight: "100vh", width: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=DM+Sans:wght@300;400;500&family=Bodoni+Moda:opsz,wght@6..96,400;6..96,500&display=swap');
        html,body,#root{margin:0;padding:0;background:${BG};min-height:100%;width:100%;}
        *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;-webkit-font-smoothing:antialiased;margin:0;padding:0;}
        ::-webkit-scrollbar{display:none;}

        .fr-wrap{display:flex;align-items:flex-start;justify-content:center;min-height:100vh;width:100%;background:${BG};}
        .fr-shell{width:100%;min-height:100vh;background:${BG};position:relative;display:flex;flex-direction:column;overflow:hidden;}
        @media(min-width:768px){
          .fr-wrap{align-items:center;padding:32px 16px;background:#e8e8e8;}
          .fr-shell{width:min(420px,100%);min-height:0;height:min(870px,calc(100vh - 64px));border-radius:42px;
            box-shadow:0 40px 90px rgba(0,0,0,.18),0 2px 0 rgba(255,255,255,.95) inset,inset 0 0 0 1px rgba(0,0,0,.06);}
        }
        @media(min-width:1200px){
          .fr-wrap{background:#d8d8d8;}
          .fr-shell{width:390px;height:min(844px,calc(100vh - 80px));border-radius:48px;}
        }

        /* scrollable body */
        .fr-body{flex:1;overflow-y:auto;overflow-x:hidden;scrollbar-width:none;display:flex;flex-direction:column;}

        /* home state: greeting sits in upper-third, not dead-center */
        .fr-body.home{justify-content:flex-start;padding-top:clamp(28px,9vh,56px);}

        /* greeting */
        .fr-greet{
          padding:0 clamp(16px,5vw,24px) clamp(16px,4vw,24px);
          opacity:0;transform:translateY(8px);transition:opacity .5s,transform .5s;
        }
        .fr-greet.in{opacity:1;transform:translateY(0);}

        /* ── Instagram-style product grid ── */
        /* Flush to edges, 3px gap, perfectly square cells */
        .fr-grid{
          display:grid;
          grid-template-columns:repeat(3,1fr);
          gap:3px;
          width:100%;
          flex-shrink:0;
        }
        .fr-cell{
          aspect-ratio:1/1;
          position:relative;
          overflow:hidden;
          cursor:pointer;
          background:#f0f0f0;
        }
        .fr-cell img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .4s,filter .25s;}
        .fr-cell:hover img{transform:scale(1.04);filter:brightness(.88);}
        .fr-cell .fr-save{position:absolute;top:6px;right:6px;z-index:2;background:none;border:none;cursor:pointer;padding:4px;display:flex;opacity:0;transition:opacity .2s;}
        .fr-cell:hover .fr-save{opacity:1;}
        .fr-cell .fr-price{position:absolute;bottom:0;left:0;right:0;padding:18px 7px 7px;background:linear-gradient(transparent,rgba(0,0,0,.45));opacity:0;transition:opacity .2s;}
        .fr-cell:hover .fr-price{opacity:1;}

        /* fade-in animation for grid cells */
        .fr-cell{opacity:0;animation:fr-fi .35s ease forwards;}
        @keyframes fr-fi{to{opacity:1;}}
        .fr-cell:nth-child(1){animation-delay:.00s}.fr-cell:nth-child(2){animation-delay:.04s}.fr-cell:nth-child(3){animation-delay:.08s}
        .fr-cell:nth-child(4){animation-delay:.12s}.fr-cell:nth-child(5){animation-delay:.16s}.fr-cell:nth-child(6){animation-delay:.20s}
        .fr-cell:nth-child(7){animation-delay:.24s}.fr-cell:nth-child(8){animation-delay:.28s}.fr-cell:nth-child(9){animation-delay:.32s}
        .fr-cell:nth-child(n+10){animation-delay:.36s}

        /* sidebar */
        .fr-sb{position:absolute;top:0;left:0;bottom:0;width:min(270px,82%);z-index:200;
          transform:translateX(-100%);transition:transform .34s cubic-bezier(.32,.72,0,1);
          display:flex;flex-direction:column;background:${BG};
          border-right:1px solid ${BRD};box-shadow:8px 0 40px rgba(0,0,0,.1);border-radius:inherit;}
        .fr-sb.open{transform:translateX(0);}
        .fr-ov{position:absolute;inset:0;background:rgba(0,0,0,0);z-index:199;pointer-events:none;
          transition:background .34s;border-radius:inherit;}
        .fr-ov.open{background:rgba(0,0,0,.28);pointer-events:all;}
        .fr-hi{display:flex;align-items:center;gap:10px;padding:10px 16px;cursor:pointer;border-radius:8px;
          transition:background .12s;font-family:'DM Sans',sans-serif;font-size:12px;color:${INK};font-weight:300;}
        .fr-hi:hover{background:rgba(0,0,0,.05);}
        .fr-hi.on{background:rgba(0,0,0,.07);font-weight:500;}

        /* search bar — Claude-style floating card */
        .fr-bar{
          display:flex;flex-direction:column;gap:10px;
          background:#fff;
          border-radius:20px;
          padding:14px 14px 10px 16px;
          box-shadow:0 4px 28px rgba(0,0,0,.10),0 1px 4px rgba(0,0,0,.06),0 0 0 1px rgba(0,0,0,.04);
          border:none;
        }
        .fr-bar-top{display:flex;align-items:flex-end;gap:8px;}
        .fr-bar-btm{display:flex;align-items:center;justify-content:space-between;}
        .fr-bar-left{display:flex;align-items:center;gap:6px;}
        .fr-bar-right{display:flex;align-items:center;gap:8px;}
        .fr-ta{flex:1;border:none;background:transparent;font-family:'DM Sans',sans-serif;
          font-size:14px;color:${INK};caret-color:${INK};resize:none;overflow:hidden;
          min-height:22px;max-height:120px;line-height:1.55;padding:0;display:block;outline:none;width:100%;}
        .fr-ta::placeholder{color:rgba(0,0,0,.28);}
        /* icon buttons — gray pill like Claude */
        .fr-icon-btn{width:34px;height:34px;border-radius:50%;border:none;background:#f2f2f2;
          display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;
          transition:background .15s,box-shadow .15s;color:${INK2};
          box-shadow:0 1px 3px rgba(0,0,0,.06);}
        .fr-icon-btn:hover{background:#e8e8e8;box-shadow:0 2px 6px rgba(0,0,0,.1);}
        .fr-send-btn{width:36px;height:36px;border-radius:50%;border:none;
          background:${canSend ? INK : '#d0d0d0'};
          display:flex;align-items:center;justify-content:center;cursor:${canSend ? 'pointer' : 'default'};
          flex-shrink:0;transition:background .2s,transform .15s,box-shadow .2s;
          box-shadow:${canSend ? '0 2px 10px rgba(0,0,0,.25)' : 'none'};}
        .fr-send-btn:hover{transform:${canSend ? 'scale(1.06)' : 'none'};box-shadow:${canSend ? '0 4px 14px rgba(0,0,0,.32)' : 'none'};}

        /* bottom sheet */
        .fr-sheet{position:absolute;bottom:0;left:0;right:0;border-radius:24px 24px 0 0;
          display:flex;flex-direction:column;z-index:101;background:${BG};
          border-top:1px solid ${BRD};box-shadow:0 -8px 40px rgba(0,0,0,.1);}
        .fr-sheet-ov{position:absolute;inset:0;background:rgba(0,0,0,0);z-index:100;
          pointer-events:none;transition:background .36s;border-radius:inherit;}
        .fr-sheet-ov.vis{background:rgba(0,0,0,.36);pointer-events:all;}
        .fr-drag{padding:10px 0 6px;display:flex;justify-content:center;flex-shrink:0;
          cursor:ns-resize;touch-action:none;user-select:none;}
        .fr-drag-pill{width:34px;height:4px;background:rgba(0,0,0,.12);border-radius:2px;}

        /* size underline tabs */
        .fr-sz{font-family:'DM Sans',sans-serif;font-size:13px;color:${INK3};
          background:transparent;border:none;border-bottom:2px solid transparent;
          padding:6px 4px;cursor:pointer;transition:all .15s;min-width:36px;text-align:center;}
        .fr-sz:hover{color:${INK};}
        .fr-sz.on{color:${INK};border-bottom-color:${INK};font-weight:500;}

        /* CTAs — black background, white text */
        .fr-atc{flex:1;padding:16px;border:none;font-family:'DM Sans',sans-serif;font-size:11px;
          font-weight:500;letter-spacing:.12em;text-transform:uppercase;cursor:pointer;
          background:${INK};color:#fff;transition:background .18s;
          text-decoration:none;display:flex;align-items:center;justify-content:center;}
        .fr-atc:hover{background:#222;}
        .fr-atc.warn{background:${INK3};cursor:default;pointer-events:none;}
        .fr-hrt{width:54px;flex-shrink:0;padding:16px;border:none;
          border-left:1px solid rgba(255,255,255,.1);
          background:${INK};color:#fff;cursor:pointer;transition:background .18s;
          display:flex;align-items:center;justify-content:center;}
        .fr-hrt:hover{background:#222;}
        .fr-bin{width:100%;padding:16px;border:none;border-top:1px solid rgba(255,255,255,.08);
          font-family:'DM Sans',sans-serif;font-size:11px;font-weight:500;letter-spacing:.12em;
          text-transform:uppercase;cursor:pointer;background:${INK};color:#fff;
          transition:background .18s;text-decoration:none;display:block;text-align:center;}
        .fr-bin:hover{background:#222;}

        /* upload thumb in bar */
        .fr-uth{width:34px;height:34px;border-radius:10px;object-fit:cover;
          border:1.5px solid rgba(0,0,0,.12);flex-shrink:0;cursor:pointer;margin-right:6px;margin-bottom:1px;}

        /* search header row above grid */
        .fr-results-bar{display:flex;justify-content:space-between;align-items:center;
          padding:10px 14px 6px;font-family:'DM Sans',sans-serif;font-size:10px;color:${INK3};}

        @keyframes fr-bounce{0%,100%{transform:translateY(0);opacity:.2;}50%{transform:translateY(-6px);opacity:1;}}
        @keyframes spin{to{transform:rotate(360deg);}}
        button{cursor:pointer;}
        a{color:inherit;}
      `}</style>

      <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />

      <div className="fr-wrap">
        <div className="fr-shell">

          {/* ── Sidebar overlay ── */}
          <div className={`fr-ov ${sidebarOpen ? "open" : ""}`} onClick={() => setSidebar(false)} />

          {/* ── Sidebar ── */}
          <div className={`fr-sb ${sidebarOpen ? "open" : ""}`}>
            <div style={{ padding: "clamp(20px,5vw,28px) 20px 16px", borderBottom: `1px solid ${BRD}` }}>
              <FromLogo size={22} color={INK} />
            </div>
            <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none" }}>
              <div style={{ padding: "10px 10px 4px" }}>
                {([["Explore","compass"],["Saved","bookmark"],["Brands","grid"],["Settings","settings"]] as [string,string][]).map(([l, ic]) => (
                  <div key={l}
                    className={`fr-hi${sidebarView === 'saved' && l === 'Saved' ? ' on' : ''}`}
                    onClick={() => {
                      if (l === 'Explore') { setSidebarView('nav'); resetConversation(); setSidebar(false) }
                      else if (l === 'Saved') setSidebarView('saved')
                      else setSidebar(false)
                    }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={INK3} strokeWidth="1.8">
                      {ic==="compass"  && <><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></>}
                      {ic==="bookmark" && <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>}
                      {ic==="grid"     && <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></>}
                      {ic==="settings" && <><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></>}
                    </svg>
                    {l}
                    {l === 'Saved' && savedProducts.length > 0 && (
                      <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 600, color: INK }}>{savedProducts.length}</span>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ height: 1, background: BRD, margin: "4px 16px" }} />
              <div style={{ padding: "4px 10px" }}>
                {sidebarView === 'nav' ? (
                  <>
                    <p style={{ fontFamily: SANS, fontSize: 9, fontWeight: 600, letterSpacing: ".16em", textTransform: "uppercase", color: INK3, padding: "6px 6px 8px" }}>Recent</p>
                    {searchHistory.length === 0
                      ? <p style={{ fontFamily: SANS, fontSize: 11, color: INK3, padding: "4px 6px", opacity: .55 }}>No recent searches</p>
                      : searchHistory.slice(0, 10).map(h => (
                          <div key={h.id} className="fr-hi" onClick={() => { sendMessage(h.query); setSidebar(false) }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={INK3} strokeWidth="1.8"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.query}</span>
                          </div>
                        ))
                    }
                  </>
                ) : (
                  <>
                    <p style={{ fontFamily: SANS, fontSize: 9, fontWeight: 600, letterSpacing: ".16em", textTransform: "uppercase", color: INK3, padding: "6px 6px 8px" }}>Saved</p>
                    {savedProducts.length === 0
                      ? <p style={{ fontFamily: SANS, fontSize: 11, color: INK3, padding: "4px 6px", opacity: .55 }}>Nothing saved yet</p>
                      : savedProducts.map(p => (
                          <div key={p.id} className="fr-hi" onClick={() => { setSelected(p); setSidebar(false) }} style={{ gap: 8 }}>
                            <div style={{ width: 32, height: 40, borderRadius: 5, overflow: 'hidden', flexShrink: 0, background: '#f0f0f0' }}>
                              {p.image_url && <img src={p.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 11, fontWeight: 500, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                              <div style={{ fontSize: 10, color: INK3 }}>{formatMoney(p.price, p.currency, p.base_currency, rates)}</div>
                            </div>
                          </div>
                        ))
                    }
                  </>
                )}
              </div>
            </div>
            <div style={{ padding: "12px 20px", borderTop: `1px solid ${BRD}` }}>
              <p style={{ fontFamily: SANS, fontSize: 10, color: INK3, letterSpacing: ".06em" }}>{buyerContext.country} · {buyerContext.currency}</p>
            </div>
          </div>

          {/* ── Nav bar ── */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "clamp(14px,4vw,20px) clamp(16px,5vw,22px) clamp(6px,2vw,10px)", flexShrink: 0 }}>
            <div style={{ cursor: "default", userSelect: "none" }}>
              <FromLogo size={28} color={INK} />
            </div>
            <button onClick={() => setSidebar(true)} style={{ width: 36, height: 36, borderRadius: "50%", border: "none", background: "transparent", display: "flex", flexDirection: "column", alignItems: "flex-end", justifyContent: "center", gap: 5, padding: "8px 6px", cursor: "pointer" }}>
              <span style={{ display: "block", width: 18, height: 1.5, background: INK, borderRadius: 1 }} />
              <span style={{ display: "block", width: 13, height: 1.5, background: INK, borderRadius: 1 }} />
            </button>
          </div>

          {/* ── Body ── */}
          <div className={`fr-body${hasConversation ? '' : ' home'}`}>

            {/* Greeting — always visible */}
            <div className={`fr-greet${loaded ? ' in' : ''}`}>
              <div style={{ fontFamily: SERIF, fontSize: "clamp(30px,8vw,44px)", fontWeight: 300, lineHeight: 1.12, letterSpacing: "-.018em", marginBottom: 6 }}>
                <span style={{ color: INK }}>Hello, </span>
                {isEditingName ? (
                  <input ref={nameRef} value={nameInput}
                    onChange={e => setNameInput(e.target.value)}
                    onBlur={saveName}
                    onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') { setNameInput(''); setIsEditing(false) } }}
                    maxLength={22} placeholder="your name"
                    style={{ fontFamily: SERIF, fontSize: "clamp(30px,8vw,44px)", fontWeight: 400, fontStyle: "italic", color: INK, background: "transparent", border: "none", borderBottom: `1px solid ${INK}`, paddingBottom: 1, width: "clamp(120px,48vw,210px)", letterSpacing: "-.018em", outline: "none" }}
                  />
                ) : (
                  <span onClick={() => { setNameInput(userName); setIsEditing(true) }}
                    style={{ fontStyle: "italic", fontWeight: 400, cursor: "pointer", color: hasName ? INK : INK3, borderBottom: `1px dashed ${hasName ? INK : 'rgba(0,0,0,.3)'}`, paddingBottom: 1 }}>
                    {hasName ? userName : "your name"}
                  </span>
                )}
              </div>
              <p style={{ fontFamily: SANS, fontSize: "clamp(7px,1.6vw,9px)", letterSpacing: ".22em", textTransform: "uppercase", color: INK3, opacity: .5 }}>
                Shop at the speed of thought
              </p>
            </div>

            {/* ── Everything below is only shown after a search ── */}

            {/* Results header */}
            {hasConversation && (
              <div className="fr-results-bar">
                <span>{loading ? 'Searching…' : `${searchProducts.length} results`}</span>
                <button onClick={resetConversation} style={{ fontFamily: SANS, fontSize: 10, color: INK3, background: "none", border: "none", textDecoration: "underline", cursor: "pointer" }}>Clear</button>
              </div>
            )}

            {/* Loading dots */}
            {loading && (
              <div style={{ display: "flex", gap: 5, justifyContent: "center", padding: "44px 0" }}>
                {[0, .2, .4].map((d, i) => (
                  <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: INK, animation: `fr-bounce 1.2s ${d}s ease-in-out infinite` }} />
                ))}
              </div>
            )}

            {/* Empty search state */}
            {showEmpty && !loading && (
              <div style={{ padding: "48px 20px", textAlign: "center" }}>
                {lastAssistantText
                  ? <p style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 300, fontStyle: "italic", color: INK3, lineHeight: 1.65 }}>{lastAssistantText}</p>
                  : <>
                      <p style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 300, fontStyle: "italic", color: INK3 }}>Nothing found</p>
                      <span style={{ fontFamily: SANS, fontSize: 10, color: INK3, letterSpacing: ".1em", display: "block", marginTop: 6, opacity: .6 }}>Try a different search</span>
                    </>
                }
              </div>
            )}

            {/* Instagram-style product grid — only appears after search */}
            {hasConversation && !loading && searchProducts.length > 0 && (
              <>
                <div className="fr-grid">
                  {searchProducts.map(p => (
                    <div key={p.id} className="fr-cell" onClick={() => setSelected(p)} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && setSelected(p)}>
                      {p.image_url
                        ? <img src={p.image_url} alt="" loading="lazy" />
                        : <div style={{ width: '100%', height: '100%', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={INK3} strokeWidth="1.4" opacity=".4"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </div>
                      }
                      <button className="fr-save" onClick={e => { e.stopPropagation(); toggleSaved(p) }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill={savedIds.has(p.id) ? 'white' : 'none'} stroke="white" strokeWidth="2">
                          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                        </svg>
                      </button>
                      <div className="fr-price">
                        <span style={{ fontFamily: SERIF, fontSize: 11, color: "rgba(255,255,255,.92)", fontStyle: "italic" }}>
                          {formatMoney(p.price, p.currency, p.base_currency, rates)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Load more */}
                {lastProductMsg && !lastProductMsg.hasNoMore && lastProductMsgIndex >= 0 && (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0 8px' }}>
                    {lastProductMsg.loadingMore
                      ? <div style={{ display: "flex", gap: 4 }}>{[0,.2,.4].map((d,i) => <div key={i} style={{ width: 4, height: 4, borderRadius: "50%", background: INK, animation: `fr-bounce 1.2s ${d}s ease-in-out infinite` }}/>)}</div>
                      : <button onClick={() => loadMoreProducts(lastProductMsgIndex)} style={{ fontFamily: SANS, fontSize: 10, color: INK3, background: 'transparent', border: `1px solid ${BRD}`, borderRadius: 100, padding: '7px 20px', cursor: 'pointer', letterSpacing: '.08em' }}>Load more</button>
                    }
                  </div>
                )}
              </>
            )}

            <div style={{ height: 12 }} />
          </div>

          {/* ── Search bar — Claude-style floating card ── */}
          <div style={{ padding: "8px clamp(12px,4vw,18px) clamp(16px,4vw,24px)", background: BG, flexShrink: 0 }}>
            <div className="fr-bar">

              {/* Row 1: input */}
              <div className="fr-bar-top">
                {uploadedImage && (
                  <img src={uploadedImage} className="fr-uth" alt="attached" title="Remove" onClick={removeUpload} />
                )}
                <textarea ref={taRef} className="fr-ta" rows={1}
                  placeholder="What are you looking for?"
                  value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={kd} disabled={loading} />
              </div>

              {/* Row 2: action buttons */}
              <div className="fr-bar-btm">
                <div className="fr-bar-left">
                  {/* attach */}
                  <button type="button" className="fr-icon-btn" onClick={() => fileRef.current?.click()}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </button>
                </div>
                <div className="fr-bar-right">
                  {/* mic */}
                  <button type="button" className="fr-icon-btn">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
                      <rect x="9" y="2" width="6" height="12" rx="3"/>
                      <path d="M5 10a7 7 0 0 0 14 0M12 19v3M9 22h6"/>
                    </svg>
                  </button>
                  {/* send */}
                  <button type="button" className="fr-send-btn" onClick={() => canSend && doSearch()}>
                    {loading
                      ? <div style={{ width: 12, height: 12, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,.3)', borderTopColor: 'white', animation: 'spin .8s linear infinite' }} />
                      : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="19" x2="12" y2="5"/>
                          <polyline points="5 12 12 5 19 12"/>
                        </svg>
                    }
                  </button>
                </div>
              </div>

            </div>
          </div>

          {/* ── Sheet overlay ── */}
          <div className={`fr-sheet-ov ${selectedProduct ? "vis" : ""}`} onClick={() => setSelected(null)} />

          {/* ── Product sheet ── */}
          <div className="fr-sheet" style={{
            maxHeight: "92%",
            transform: selectedProduct ? `translateY(${sheetY}px)` : "translateY(100%)",
            transition: isDragging ? "none" : "transform .4s cubic-bezier(.32,.72,0,1)",
            willChange: "transform",
          }}>
            {selectedProduct && (
              <>
                <div className="fr-drag" onPointerDown={onHandleDown} onPointerMove={onHandleMove} onPointerUp={onHandleUp} onPointerLeave={onHandleUp}>
                  <div className="fr-drag-pill" />
                </div>

                <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none", paddingBottom: 4 }}>
                  {/* Image carousel */}
                  <div style={{ padding: "0 16px" }}>
                    <div style={{ position: "relative", overflow: "hidden", borderRadius: 14 }}>
                      <div style={{ display: "flex", transition: isDragging ? "none" : "transform .32s cubic-bezier(.32,.72,0,1)", transform: `translateX(-${activeImg * 100}%)` }}>
                        {sheetImages.length > 0 ? sheetImages.map((img, i) => (
                          <div key={i} style={{ width: "100%", flexShrink: 0 }}>
                            <img src={img} alt="" style={{ width: "100%", aspectRatio: "4/5", objectFit: "cover", display: "block" }} />
                          </div>
                        )) : (
                          <div style={{ width: "100%", aspectRatio: "4/5", background: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={INK3} strokeWidth="1.4" opacity=".4"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </div>
                        )}
                      </div>
                      {sheetImages.length > 1 && (
                        <div style={{ position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 5 }}>
                          {sheetImages.map((_, i) => (
                            <div key={i} onClick={e => { e.stopPropagation(); setActiveImg(i) }}
                              style={{ width: 5, height: 5, borderRadius: "50%", background: i === activeImg ? "white" : "rgba(255,255,255,.4)", cursor: "pointer", transform: i === activeImg ? "scale(1.3)" : "scale(1)", transition: "all .18s" }} />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Colour thumbnails */}
                  {sheetImages.length > 1 && (
                    <div style={{ padding: "12px 16px 0", display: "flex", gap: 6 }}>
                      {sheetImages.slice(0, 5).map((img, i) => (
                        <button key={i} onClick={() => setActiveImg(i)}
                          style={{ width: 46, height: 58, borderRadius: 6, overflow: "hidden", padding: 0, border: `2px solid ${i === activeImg ? INK : 'transparent'}`, cursor: "pointer", background: "#f0f0f0", flexShrink: 0, transition: "border-color .15s" }}>
                          <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Header */}
                  <div style={{ padding: "16px 20px 0" }}>
                    <h2 style={{ fontFamily: SANS, fontSize: "clamp(16px,4.5vw,19px)", fontWeight: 700, color: INK, lineHeight: 1.2, marginBottom: 5 }}>
                      {selectedProduct.title}
                    </h2>
                    <p style={{ fontFamily: SANS, fontSize: "clamp(14px,3.8vw,16px)", color: INK, fontWeight: 400 }}>
                      {formatMoney(selectedProduct.price, selectedProduct.currency, selectedProduct.base_currency, rates)}
                    </p>
                  </div>

                  {sheetDesc && (
                    <div style={{ padding: "12px 20px 0" }}>
                      <p style={{ fontFamily: SANS, fontSize: 13, color: INK3, lineHeight: 1.7, fontWeight: 300 }}>{sheetDesc}</p>
                    </div>
                  )}

                  {sheetSizes.length > 0 && (
                    <div style={{ padding: "14px 20px 0" }}>
                      <div style={{ height: 1, background: BRD, marginBottom: 12 }} />
                      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", borderBottom: `1px solid ${BRD}`, paddingBottom: 2 }}>
                        {sheetSizes.map(s => (
                          <button key={s} className={`fr-sz${selectedSize === s ? " on" : ""}`} onClick={() => setSize(selectedSize === s ? null : s)}>{s}</button>
                        ))}
                      </div>
                    </div>
                  )}

                  {sheetMaterial && <InfoSection label="Material"><p style={{ fontFamily: SANS, fontSize: 13, color: INK3, fontWeight: 300 }}>{sheetMaterial}</p></InfoSection>}

                  {selectedProduct.tags && selectedProduct.tags.length > 0 && (
                    <InfoSection label="Details">
                      <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 7 }}>
                        {selectedProduct.tags.slice(0, 6).map((tag, i) => (
                          <li key={i} style={{ fontFamily: SANS, fontSize: 12, color: INK2, display: "flex", alignItems: "flex-start", gap: 8, fontWeight: 300, lineHeight: 1.5 }}>
                            <div style={{ width: 3, height: 3, borderRadius: "50%", background: INK3, flexShrink: 0, marginTop: 5 }} />
                            {tag}
                          </li>
                        ))}
                      </ul>
                    </InfoSection>
                  )}

                  <InfoSection label="Store">
                    <p style={{ fontFamily: SANS, fontSize: 13, color: INK3, fontWeight: 300 }}>
                      {selectedProduct.in_stock ? '✓ In stock' : '✗ Out of stock'}
                      {' — '}
                      {(() => { try { return new URL(selectedProduct.store_url).hostname.replace('www.', '') } catch { return '' } })()}
                    </p>
                  </InfoSection>

                  <div style={{ height: 8 }} />
                </div>

                {/* CTAs */}
                <div style={{ borderTop: `1px solid ${BRD}`, background: BG, flexShrink: 0, overflow: "hidden" }}>
                  <div style={{ display: "flex" }}>
                    <a href={sheetSizes.length > 0 && !selectedSize ? undefined : checkoutUrl}
                      target="_blank" rel="noopener noreferrer"
                      className={`fr-atc${sheetSizes.length > 0 && !selectedSize ? " warn" : ""}`}
                      onClick={sheetSizes.length > 0 && !selectedSize ? e => e.preventDefault() : undefined}>
                      {sheetSizes.length > 0 && !selectedSize ? "Select a size" : "Add to Cart"}
                    </a>
                    <button className="fr-hrt" onClick={() => toggleSaved(selectedProduct)}>
                      <svg width="18" height="18" viewBox="0 0 24 24"
                        fill={savedIds.has(selectedProduct.id) ? '#fff' : "none"} stroke="#fff" strokeWidth="1.8">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                      </svg>
                    </button>
                  </div>
                  <a href={sheetSizes.length > 0 && !selectedSize ? undefined : checkoutUrl}
                    target="_blank" rel="noopener noreferrer" className="fr-bin"
                    onClick={sheetSizes.length > 0 && !selectedSize ? e => e.preventDefault() : undefined}
                    style={{ opacity: sheetSizes.length > 0 && !selectedSize ? .5 : 1 }}>
                    Buy It Now
                  </a>
                </div>
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
