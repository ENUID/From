'use client'

import { useState, useEffect, useRef } from 'react'
import { useChatWorkspace } from './hooks/useChatWorkspace'
import { formatMoney } from '@/lib/currency'
import type { BuyerContext } from '@/lib/buyerContext'
import { ExchangeRates } from '@/lib/exchangeRates'
import type { Product } from '@/components/ProductCard'

// ── Palette ───────────────────────────────────────────────────────────────────
const MILK  = "#fdfcfa"
const CHOC  = "#3b1f0e"
const DARK  = "#1e1008"
const MID   = "#6b4c38"
const GOLD  = "#a87840"
const SANS  = "'DM Sans', system-ui, sans-serif"
const SERIF = "'Cormorant Garamond', Georgia, serif"
const BRD   = "rgba(30,16,8,0.07)"

// ── Logo ──────────────────────────────────────────────────────────────────────
function FromLogo({ size = 60, color = "#1e1008" }: { size?: number; color?: string }) {
  return (
    <svg
      viewBox="0 0 220 58"
      width={size * (220 / 58)}
      height={size}
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block", overflow: "visible" }}
    >
      <path d="M 4 4 L 4 54 L 8 54 L 8 32 L 26 32 L 26 29 L 8 29 L 8 7 L 30 7 L 30 4 Z" />
      <path d="M 36 4 L 36 54 L 40 54 L 40 32 L 52 32 L 62 54 L 66.5 54 L 56 31.5 C 62 29.5 66 24.5 66 18 C 66 10 61 4 51 4 Z M 40 7 L 50 7 C 58 7 62 11 62 18 C 62 25.5 57.5 29 50 29 L 40 29 Z" />
      <path d="M 90 3 C 78 3 70 12 70 29 C 70 46 78 55 90 55 C 102 55 110 46 110 29 C 110 12 102 3 90 3 Z M 90 6.5 C 100 6.5 106 15 106 29 C 106 43 100 51.5 90 51.5 C 80 51.5 74 43 74 29 C 74 15 80 6.5 90 6.5 Z" />
      <path d="M 118 4 L 118 54 L 122 54 L 122 10 L 140 42 L 142 42 L 160 10 L 160 54 L 164 54 L 164 4 L 160.5 4 L 141 37 L 121.5 4 Z" />
    </svg>
  )
}

// ── Sheet info row ────────────────────────────────────────────────────────────
function InfoSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <div style={{ height: 1, background: BRD, margin: "0 20px" }} />
      <div style={{ padding: "13px 20px" }}>
        <p style={{ fontFamily: SANS, fontSize: 9, fontWeight: 500, letterSpacing: ".18em", textTransform: "uppercase", color: GOLD, marginBottom: 9 }}>
          {label}
        </p>
        {children}
      </div>
    </>
  )
}

// ── Product data helpers ──────────────────────────────────────────────────────
function getProductImages(product: Product): string[] {
  const list: string[] = []
  if (product.image_url) list.push(product.image_url)
  product.media?.forEach(m => { if (m.url && !list.includes(m.url)) list.push(m.url) })
  product.variants?.forEach(v => {
    v.media?.forEach(m => { if (m.url && !list.includes(m.url)) list.push(m.url) })
  })
  return list
}

function getDescriptionText(product: Product): string {
  if (!product.description) return ''
  let text = product.description
  text = text.replace(/<br\s*\/?>/gi, '\n')
  text = text.replace(/<\/p>/gi, '\n')
  text = text.replace(/<\/div>/gi, '\n')
  text = text.replace(/<\/li>/gi, '\n')
  text = text.replace(/<[^>]*>/g, '')
  return text.trim()
}

function extractMaterial(product: Product): string {
  const matTag = product.tags?.find(t => t?.toLowerCase().includes('material') || t?.toLowerCase().includes('fabric'))
  if (matTag) return matTag.split('=>').pop()?.trim() || ''
  const desc = getDescriptionText(product)
  const match = desc.match(/(cotton|linen|wool|silk|hemp|polyester|leather|canvas|cashmere|denim|viscose|nylon|spandex)/i)
  return match?.[0] || ''
}

function getProductSizes(product: Product): string[] {
  const sizeOpt = product.options?.find(o => o.name.toLowerCase().includes('size'))
  return sizeOpt?.values || []
}

function getProductColor(product: Product): string {
  const colorOpt = product.options?.find(o =>
    o.name.toLowerCase().includes('color') || o.name.toLowerCase().includes('colour')
  )
  return colorOpt?.values?.[0] || ''
}

function getCheckoutUrl(product: Product, selectedSize: string | null): string {
  const variant = selectedSize
    ? product.variants?.find(v => v.options.some(o => o.label === selectedSize))
    : product.variants?.[0]
  if (!variant) return product.store_url
  try {
    const url = new URL(product.store_url)
    const variantId = variant.id.split('/').pop()
    return `https://${url.hostname}/cart/${variantId}:1`
  } catch {
    return product.store_url
  }
}

// ── Main component ────────────────────────────────────────────────────────────
export default function FromApp({
  initialBuyerContext,
  initialRates,
}: {
  initialBuyerContext: BuyerContext
  initialRates: ExchangeRates
}) {
  const {
    messages,
    input,
    setInput,
    loading,
    hasConversation,
    savedIds,
    savedProducts,
    searchHistory,
    buyerContext,
    rates,
    sendMessage,
    toggleSaved,
    resetConversation,
    loadMoreProducts,
  } = useChatWorkspace(initialBuyerContext, initialRates)

  // Local UI state
  const [userName, setUserName]       = useState("")
  const [isEditingName, setIsEditing] = useState(false)
  const [nameInput, setNameInput]     = useState("")
  const [selectedProduct, setSelected] = useState<Product | null>(null)
  const [selectedSize, setSize]       = useState<string | null>(null)
  const [activeImg, setActiveImg]     = useState(0)
  const [sheetY, setSheetY]           = useState(0)
  const [isDragging, setIsDragging]   = useState(false)
  const [sidebarOpen, setSidebar]     = useState(false)
  const [sidebarView, setSidebarView] = useState<'nav' | 'saved'>('nav')
  const [uploadedImage, setUploaded]  = useState<string | null>(null)
  const [uploadName, setUploadName]   = useState("")
  const [loaded, setLoaded]           = useState(false)

  const nameRef    = useRef<HTMLInputElement>(null)
  const taRef      = useRef<HTMLTextAreaElement>(null)
  const fileRef    = useRef<HTMLInputElement>(null)
  const dragStartY = useRef(0)

  // Derive display state from messages
  const lastProductMsg = [...messages].reverse().find(m => m.role === 'assistant' && m.products && m.products.length > 0)
  const lastProductMsgIndex = lastProductMsg ? messages.lastIndexOf(lastProductMsg as any) : -1
  const displayProducts: Product[] = lastProductMsg?.products || []
  const lastAssistantText = [...messages].reverse().find(m => m.role === 'assistant')?.content || ''

  const showHome  = !hasConversation
  const showGrid  = hasConversation && displayProducts.length > 0
  const showEmpty = hasConversation && displayProducts.length === 0 && !loading
  const canSend   = input.trim().length > 0 || !!uploadedImage
  const hasName   = userName.length > 0
  const dispName  = hasName ? userName : "your name"
  const nameClr   = hasName ? CHOC : GOLD

  useEffect(() => { setTimeout(() => setLoaded(true), 80) }, [])
  useEffect(() => {
    if (isEditingName && nameRef.current) {
      nameRef.current.focus()
      nameRef.current.select()
    }
  }, [isEditingName])
  useEffect(() => {
    if (selectedProduct) { setSize(null); setActiveImg(0); setSheetY(0) }
  }, [selectedProduct])
  useEffect(() => {
    if (taRef.current) {
      taRef.current.style.height = "auto"
      taRef.current.style.height = Math.min(taRef.current.scrollHeight, 130) + "px"
    }
  }, [input])

  // Sheet drag
  const onHandleDown = (e: React.PointerEvent) => {
    e.preventDefault()
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    dragStartY.current = e.clientY - sheetY
    setIsDragging(true)
  }
  const onHandleMove = (e: React.PointerEvent) => {
    if (!isDragging) return
    setSheetY(Math.max(0, e.clientY - dragStartY.current))
  }
  const onHandleUp = () => {
    if (!isDragging) return
    setIsDragging(false)
    if (sheetY > 100) { setSelected(null); setSheetY(0) } else setSheetY(0)
  }

  const doSearch = () => {
    if (!canSend || loading) return
    const q = [input.trim(), uploadName].filter(Boolean).join(' ')
    if (!q) return
    if (q !== input.trim()) setInput(q)
    sendMessage(q)
    setUploaded(null)
    setUploadName('')
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setUploaded(ev.target?.result as string)
    reader.readAsDataURL(file)
    const kw = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ').toLowerCase()
    setUploadName(kw)
  }

  const removeUpload = () => {
    setUploaded(null)
    setUploadName('')
    if (fileRef.current) fileRef.current.value = ''
  }

  const doHistorySearch = (q: string) => {
    setSidebar(false)
    sendMessage(q)
  }

  const saveName = () => { setUserName(nameInput.trim()); setIsEditing(false) }

  const kd = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); doSearch() }
  }

  // Product sheet values
  const sheetImages   = selectedProduct ? getProductImages(selectedProduct) : []
  const sheetDesc     = selectedProduct ? getDescriptionText(selectedProduct) : ''
  const sheetMaterial = selectedProduct ? extractMaterial(selectedProduct) : ''
  const sheetSizes    = selectedProduct ? getProductSizes(selectedProduct) : []
  const sheetColor    = selectedProduct ? getProductColor(selectedProduct) : ''
  const checkoutUrl   = selectedProduct ? getCheckoutUrl(selectedProduct, selectedSize) : '#'

  return (
    <div style={{ fontFamily: SANS, background: MILK, minHeight: "100vh", width: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Sans:wght@300;400;500&display=swap');
        html,body,#root{margin:0;padding:0;background:${MILK};min-height:100%;width:100%;}
        *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;-webkit-font-smoothing:antialiased;margin:0;padding:0;}
        ::-webkit-scrollbar{display:none;}

        .from-wrap{display:flex;align-items:flex-start;justify-content:center;min-height:100vh;width:100%;background:${MILK};}
        .from-phone{width:100%;min-height:100vh;background:${MILK};position:relative;display:flex;flex-direction:column;overflow:hidden;}
        @media(min-width:768px){
          .from-wrap{align-items:center;padding:32px 16px;background:#ded5c8;}
          .from-phone{width:min(460px,100%);min-height:0;height:min(880px,calc(100vh - 64px));border-radius:40px;
            box-shadow:0 40px 90px rgba(30,16,8,.2),0 2px 0 rgba(255,255,255,.95) inset,inset 0 0 0 1px rgba(30,16,8,.04);}
        }
        @media(min-width:1200px){
          .from-wrap{background:#cec3b4;}
          .from-phone{width:400px;height:min(840px,calc(100vh - 80px));border-radius:46px;
            box-shadow:0 56px 110px rgba(30,16,8,.26),0 2px 0 rgba(255,255,255,.95) inset,inset 0 0 0 1px rgba(30,16,8,.04);}
        }

        .from-bscroll{flex:1;overflow-y:auto;overflow-x:hidden;scrollbar-width:none;}

        .from-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:2px;padding:2px;}
        .from-gi{aspect-ratio:4/5;position:relative;overflow:hidden;cursor:pointer;background:#e6ddd0;border-radius:8px;opacity:0;animation:from-fi .45s ease forwards;}
        @keyframes from-fi{to{opacity:1;}}
        .from-gi:nth-child(1){animation-delay:.00s}.from-gi:nth-child(2){animation-delay:.05s}.from-gi:nth-child(3){animation-delay:.10s}
        .from-gi:nth-child(4){animation-delay:.15s}.from-gi:nth-child(5){animation-delay:.20s}.from-gi:nth-child(6){animation-delay:.25s}
        .from-gi:nth-child(7){animation-delay:.30s}.from-gi:nth-child(8){animation-delay:.35s}.from-gi:nth-child(9){animation-delay:.40s}
        .from-gi:nth-child(10){animation-delay:.45s}.from-gi:nth-child(11){animation-delay:.50s}.from-gi:nth-child(12){animation-delay:.55s}
        .from-gi img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .45s,filter .3s;}
        .from-gi:hover img{transform:scale(1.04);filter:brightness(.86);}
        .from-pq{position:absolute;bottom:0;left:0;right:0;padding:20px 8px 8px;background:linear-gradient(to top,rgba(30,16,8,.5),transparent);opacity:0;transition:opacity .2s;border-radius:0 0 8px 8px;pointer-events:none;}
        .from-gi:hover .from-pq{opacity:1;}
        .from-no-img{width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#e6ddd0;}

        .from-sbtn{
          width:32px;height:32px;border-radius:50%;border:none;flex-shrink:0;cursor:pointer;
          display:flex;align-items:center;justify-content:center;
          position:relative;overflow:hidden;
          background:${CHOC};
          border:1px solid rgba(255,255,255,0.14);
          box-shadow:0 4px 16px rgba(59,31,14,.38),0 1px 0 rgba(255,255,255,.16) inset;
          transition:transform .15s,box-shadow .2s;
        }
        .from-sbtn::before{content:'';position:absolute;top:0;left:0;right:0;height:50%;background:linear-gradient(to bottom,rgba(255,255,255,.15),transparent);border-radius:50% 50% 0 0;pointer-events:none;}
        .from-sbtn:hover{transform:scale(1.07);box-shadow:0 6px 20px rgba(59,31,14,.48);}
        .from-sbtn:active{transform:scale(.91);}
        .from-sbtn.off{background:rgba(59,31,14,.1);border-color:transparent;box-shadow:none;cursor:default;}
        .from-sbtn.off::before{display:none;}

        .from-abtn{width:32px;height:32px;border-radius:50%;border:1px solid rgba(59,31,14,.12);flex-shrink:0;cursor:pointer;display:flex;align-items:center;justify-content:center;background:rgba(59,31,14,.05);transition:all .2s;}
        .from-abtn:hover{background:rgba(59,31,14,.1);}

        /* Size — underline tab style matching reference */
        .from-szb{
          font-family:'DM Sans',sans-serif;font-size:13px;color:${MID};
          background:transparent;border:none;border-bottom:2px solid transparent;
          padding:6px 4px;cursor:pointer;transition:all .18s;
          min-width:36px;text-align:center;font-weight:400;
        }
        .from-szb:hover{color:${DARK};}
        .from-szb.sel{color:${DARK};border-bottom-color:${DARK};font-weight:500;}

        /* Add to Cart — full width dark brown */
        .from-atc{
          flex:1;padding:16px;border:none;border-radius:0;
          font-family:'DM Sans',sans-serif;font-size:12px;font-weight:500;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;
          background:${CHOC};color:${MILK};transition:background .2s;
          text-decoration:none;display:flex;align-items:center;justify-content:center;
        }
        .from-atc:hover{background:#4e2a14;}
        .from-atc.warn{background:${MID};cursor:default;pointer-events:none;}

        /* Heart button beside Add to Cart */
        .from-hrt{
          width:56px;flex-shrink:0;padding:16px;border:none;border-left:1px solid rgba(255,255,255,.15);
          background:${CHOC};color:${MILK};cursor:pointer;transition:background .2s;
          display:flex;align-items:center;justify-content:center;
        }
        .from-hrt:hover{background:#4e2a14;}
        .from-hrt.saved{background:#5c2d0e;}

        /* Buy It Now — full width below */
        .from-bin{
          width:100%;padding:16px;border:none;border-radius:0;
          font-family:'DM Sans',sans-serif;font-size:12px;font-weight:500;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;
          background:${CHOC};color:${MILK};transition:background .2s;
          text-decoration:none;display:block;text-align:center;
          border-top:1px solid rgba(255,255,255,.1);
        }
        .from-bin:hover{background:#4e2a14;}

        .from-sb{position:absolute;top:0;left:0;bottom:0;width:min(275px,82%);z-index:200;transform:translateX(-100%);transition:transform .36s cubic-bezier(.32,.72,0,1);display:flex;flex-direction:column;
          background:rgba(253,252,250,0.92);backdrop-filter:blur(36px) saturate(1.5);-webkit-backdrop-filter:blur(36px) saturate(1.5);
          border-right:1px solid rgba(255,255,255,.8);box-shadow:6px 0 40px rgba(30,16,8,.14);border-radius:inherit;}
        .from-sb.open{transform:translateX(0);}
        .from-sov{position:absolute;inset:0;background:rgba(30,16,8,0);z-index:199;pointer-events:none;transition:background .36s ease;border-radius:inherit;}
        .from-sov.open{background:rgba(30,16,8,.28);pointer-events:all;}
        .from-hi{display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;border-radius:8px;transition:background .15s;font-family:'DM Sans',sans-serif;font-size:12px;color:${DARK};font-weight:300;}
        .from-hi:hover{background:rgba(59,31,14,.06);}
        .from-hi.active{background:rgba(59,31,14,.08);font-weight:500;}

        .from-sheet{position:absolute;bottom:0;left:0;right:0;border-radius:26px 26px 0 0;display:flex;flex-direction:column;z-index:101;
          background:rgba(253,252,250,0.93);backdrop-filter:blur(40px) saturate(1.6);-webkit-backdrop-filter:blur(40px) saturate(1.6);
          border-top:1px solid rgba(255,255,255,.85);box-shadow:0 -12px 48px rgba(30,16,8,.13);}
        .from-sov2{position:absolute;inset:0;background:rgba(30,16,8,0);z-index:100;pointer-events:none;transition:background .38s ease;border-radius:inherit;}
        .from-sov2.vis{background:rgba(30,16,8,.34);pointer-events:all;}

        .from-ibar{
          display:flex;align-items:flex-end;gap:8px;
          border-radius:18px;
          padding:clamp(9px,2.5vw,11px) clamp(10px,3vw,14px);
          background:rgba(59,31,14,0.05);
          backdrop-filter:blur(20px) saturate(1.3);
          -webkit-backdrop-filter:blur(20px) saturate(1.3);
          border:1px solid rgba(255,255,255,0.72);
          box-shadow:0 2px 14px rgba(59,31,14,.06),0 1px 0 rgba(255,255,255,.9) inset;
        }
        .from-ta{flex:1;border:none;background:transparent;font-family:'DM Sans',sans-serif;font-size:clamp(12px,3.2vw,13px);color:${DARK};caret-color:${GOLD};resize:none;overflow:hidden;min-height:20px;max-height:130px;line-height:1.55;padding:0;display:block;overflow-y:auto;}
        .from-ta::placeholder{color:${MID};opacity:.4;}
        .from-ta:focus{outline:none;}
        input:focus{outline:none;}

        .from-dh{padding:10px 0 4px;display:flex;justify-content:center;flex-shrink:0;cursor:ns-resize;touch-action:none;user-select:none;}
        .from-dp{width:36px;height:4px;background:rgba(30,16,8,.13);border-radius:2px;}

        .from-uthumb{width:36px;height:36px;border-radius:8px;object-fit:cover;border:1.5px solid rgba(59,31,14,.15);flex-shrink:0;cursor:pointer;transition:opacity .2s;margin-bottom:1px;}
        .from-uthumb:hover{opacity:.75;}

        .from-save-btn{background:none;border:none;cursor:pointer;padding:4px 6px;display:flex;align-items:center;transition:opacity .15s;}
        .from-save-btn:hover{opacity:.7;}

        @keyframes from-bounce{0%,100%{transform:translateY(0);opacity:.3;}50%{transform:translateY(-7px);opacity:1;}}
        button{cursor:pointer;}
      `}</style>

      <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />

      <div className="from-wrap">
        <div className="from-phone">

          {/* Sidebar overlay */}
          <div className={`from-sov ${sidebarOpen ? "open" : ""}`} onClick={() => setSidebar(false)} />

          {/* Sidebar */}
          <div className={`from-sb ${sidebarOpen ? "open" : ""}`}>
            <div style={{ padding: "clamp(18px,4vw,24px) 16px 14px", borderBottom: `1px solid ${BRD}`, display: "flex", alignItems: "center" }}>
              <FromLogo size={22} color={DARK} />
            </div>

            <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none" }}>
              <div style={{ padding: "10px 8px 2px" }}>
                {([
                  ["Explore", "compass"],
                  ["Saved", "bookmark"],
                  ["Brands", "grid"],
                  ["Settings", "settings"],
                ] as [string, string][]).map(([l, ic]) => (
                  <div
                    key={l}
                    className={`from-hi${sidebarView === 'saved' && l === 'Saved' ? ' active' : ''}`}
                    onClick={() => {
                      if (l === 'Explore') { setSidebarView('nav'); resetConversation(); setSidebar(false) }
                      else if (l === 'Saved') { setSidebarView('saved') }
                      else setSidebar(false)
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={MID} strokeWidth="1.8">
                      {ic === "compass"  && <><circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" /></>}
                      {ic === "bookmark" && <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />}
                      {ic === "grid"     && <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>}
                      {ic === "settings" && <><circle cx="12" cy="12" r="3" /><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" /></>}
                    </svg>
                    {l}
                    {l === 'Saved' && savedProducts.length > 0 && (
                      <span style={{ marginLeft: 'auto', fontFamily: SANS, fontSize: 10, fontWeight: 500, color: GOLD }}>{savedProducts.length}</span>
                    )}
                  </div>
                ))}
              </div>

              {sidebarView === 'nav' ? (
                <>
                  <div style={{ height: 1, background: BRD, margin: "6px 14px" }} />
                  <div style={{ padding: "6px 8px 4px" }}>
                    <p style={{ fontFamily: SANS, fontSize: 9, fontWeight: 500, letterSpacing: ".16em", textTransform: "uppercase", color: GOLD, padding: "4px 6px 8px" }}>Recent</p>
                    {searchHistory.length === 0 ? (
                      <p style={{ fontFamily: SANS, fontSize: 11, color: MID, padding: "4px 6px", opacity: 0.6 }}>No recent searches</p>
                    ) : (
                      searchHistory.slice(0, 10).map(h => (
                        <div key={h.id} className="from-hi" onClick={() => doHistorySearch(h.query)}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={MID} strokeWidth="1.8">
                            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                          </svg>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.query}</span>
                        </div>
                      ))
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ height: 1, background: BRD, margin: "6px 14px" }} />
                  <div style={{ padding: "6px 8px 4px" }}>
                    <p style={{ fontFamily: SANS, fontSize: 9, fontWeight: 500, letterSpacing: ".16em", textTransform: "uppercase", color: GOLD, padding: "4px 6px 8px" }}>Saved</p>
                    {savedProducts.length === 0 ? (
                      <p style={{ fontFamily: SANS, fontSize: 11, color: MID, padding: "4px 6px", opacity: 0.6 }}>Nothing saved yet</p>
                    ) : (
                      savedProducts.map(p => (
                        <div key={p.id} className="from-hi" onClick={() => { setSelected(p); setSidebar(false) }}
                          style={{ gap: 8, alignItems: 'center' }}>
                          <div style={{ width: 32, height: 32, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: '#e6ddd0' }}>
                            {p.image_url && <img src={p.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 11, fontWeight: 500, color: DARK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                            <div style={{ fontSize: 10, color: GOLD }}>{formatMoney(p.price, p.currency, p.base_currency, rates)}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>

            <div style={{ padding: "12px 16px", borderTop: `1px solid ${BRD}` }}>
              <p style={{ fontFamily: SANS, fontSize: 10, color: GOLD, letterSpacing: ".06em" }}>
                {buyerContext.country} · {buyerContext.currency}
              </p>
            </div>
          </div>

          {/* Nav bar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "clamp(14px,4vw,20px) clamp(16px,5vw,20px) clamp(8px,2.5vw,12px)", flexShrink: 0 }}>
            <div style={{ cursor: "pointer", userSelect: "none" }} onClick={() => setSidebar(true)}>
              <FromLogo size={20} color={DARK} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {hasConversation && (
                <button
                  onClick={resetConversation}
                  style={{ fontFamily: SANS, fontSize: 10, color: MID, background: 'none', border: 'none', letterSpacing: '.06em' }}
                >
                  New search
                </button>
              )}
              <button
                onClick={() => setSidebar(true)}
                style={{ width: 34, height: 34, borderRadius: "50%", border: "none", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={DARK} strokeWidth="1.7">
                  <line x1="4" y1="8" x2="14" y2="8" />
                  <line x1="4" y1="14" x2="20" y2="14" />
                </svg>
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="from-bscroll">

            {/* Home greeting */}
            {showHome && (
              <div style={{ padding: "0 clamp(16px,5vw,22px) clamp(20px,5vw,28px)", opacity: loaded ? 1 : 0, transform: loaded ? "translateY(0)" : "translateY(10px)", transition: "opacity .55s,transform .55s" }}>
                <div style={{ paddingTop: "clamp(10px,3vw,18px)" }}>
                  <div style={{ fontFamily: SERIF, fontSize: "clamp(28px,8vw,42px)", fontWeight: 300, lineHeight: 1.15, letterSpacing: "-.015em", marginBottom: 6 }}>
                    <span style={{ color: DARK }}>Hello, </span>
                    {isEditingName ? (
                      <input
                        ref={nameRef}
                        value={nameInput}
                        onChange={e => setNameInput(e.target.value)}
                        onBlur={saveName}
                        onKeyDown={e => {
                          if (e.key === 'Enter') saveName()
                          if (e.key === 'Escape') { setNameInput(''); setIsEditing(false) }
                        }}
                        maxLength={22}
                        placeholder="your name"
                        style={{ fontFamily: SERIF, fontSize: "clamp(28px,8vw,42px)", fontWeight: 400, fontStyle: "italic", color: nameInput.length > 0 ? CHOC : GOLD, background: "transparent", border: "none", borderBottom: `1px solid ${nameInput.length > 0 ? CHOC : GOLD}`, paddingBottom: 1, width: "clamp(110px,45vw,200px)", letterSpacing: "-.015em", transition: "color .25s,border-color .25s" }}
                      />
                    ) : (
                      <span
                        onClick={() => { setNameInput(userName); setIsEditing(true) }}
                        style={{ fontStyle: "italic", fontWeight: 400, cursor: "pointer", color: nameClr, borderBottom: `1px dashed ${nameClr}`, paddingBottom: 1, transition: "color .3s,border-color .3s" }}
                      >
                        {dispName}
                      </span>
                    )}
                  </div>
                  <p style={{ fontFamily: SANS, fontSize: "clamp(8px,1.8vw,10px)", letterSpacing: ".2em", textTransform: "uppercase", color: MID, opacity: .4 }}>
                    Shop at the speed of thought
                  </p>
                </div>

                {/* Recent search chips */}
                {searchHistory.length > 0 && (
                  <div style={{ marginTop: 28 }}>
                    <p style={{ fontFamily: SANS, fontSize: 9, fontWeight: 500, letterSpacing: ".18em", textTransform: "uppercase", color: GOLD, marginBottom: 10 }}>Recent</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {searchHistory.slice(0, 5).map(h => (
                        <button
                          key={h.id}
                          onClick={() => doHistorySearch(h.query)}
                          style={{ fontFamily: SANS, fontSize: 11, color: DARK, background: 'transparent', border: `1px solid ${BRD}`, borderRadius: 100, padding: '6px 14px', cursor: 'pointer', transition: 'background .15s', fontWeight: 300 }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(59,31,14,.05)' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                        >
                          {h.query}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div style={{ display: "flex", gap: 5, justifyContent: "center", padding: "50px 0" }}>
                {[0, .2, .4].map((d, i) => (
                  <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: GOLD, animation: `from-bounce 1.2s ${d}s ease-in-out infinite` }} />
                ))}
              </div>
            )}

            {/* Empty state */}
            {showEmpty && !loading && (
              <div style={{ padding: "52px 20px", textAlign: "center" }}>
                {lastAssistantText ? (
                  <>
                    <p style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 300, fontStyle: "italic", color: MID, lineHeight: 1.6 }}>{lastAssistantText}</p>
                  </>
                ) : (
                  <>
                    <p style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 300, fontStyle: "italic", color: MID }}>Nothing found</p>
                    <span style={{ fontFamily: SANS, fontSize: 10, color: GOLD, letterSpacing: ".1em", display: "block", marginTop: 6 }}>Try a different search</span>
                  </>
                )}
              </div>
            )}

            {/* Product grid */}
            {showGrid && !loading && (
              <>
                <div style={{ padding: "0 14px 6px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: SANS, fontSize: 10, color: MID, opacity: .7 }}>{displayProducts.length} results</span>
                  <button
                    onClick={resetConversation}
                    style={{ fontFamily: SANS, fontSize: 10, color: MID, background: "none", border: "none", textDecoration: "underline" }}
                  >
                    Clear
                  </button>
                </div>
                <div className="from-grid">
                  {displayProducts.map(p => (
                    <div
                      key={p.id}
                      className="from-gi"
                      onClick={() => setSelected(p)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={e => e.key === 'Enter' && setSelected(p)}
                    >
                      {p.image_url ? (
                        <img src={p.image_url} alt="" loading="lazy" />
                      ) : (
                        <div className="from-no-img">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={MID} strokeWidth="1.5" opacity=".4">
                            <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      )}
                      {/* Save toggle */}
                      <button
                        className="from-save-btn"
                        style={{ position: 'absolute', top: 5, right: 5, zIndex: 2 }}
                        onClick={e => { e.stopPropagation(); toggleSaved(p) }}
                        title={savedIds.has(p.id) ? 'Remove from saved' : 'Save'}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill={savedIds.has(p.id) ? 'white' : 'none'} stroke="white" strokeWidth="2">
                          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                        </svg>
                      </button>
                      <div className="from-pq">
                        <div style={{ fontFamily: SERIF, fontSize: 11, color: "rgba(255,255,255,.93)", fontStyle: "italic" }}>
                          {formatMoney(p.price, p.currency, p.base_currency, rates)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Load more */}
                {lastProductMsg && !lastProductMsg.hasNoMore && lastProductMsgIndex >= 0 && (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0 8px' }}>
                    {lastProductMsg.loadingMore ? (
                      <div style={{ display: "flex", gap: 5 }}>
                        {[0, .2, .4].map((d, i) => (
                          <div key={i} style={{ width: 4, height: 4, borderRadius: "50%", background: GOLD, animation: `from-bounce 1.2s ${d}s ease-in-out infinite` }} />
                        ))}
                      </div>
                    ) : (
                      <button
                        onClick={() => loadMoreProducts(lastProductMsgIndex)}
                        style={{ fontFamily: SANS, fontSize: 10, color: MID, background: 'transparent', border: `1px solid ${BRD}`, borderRadius: 100, padding: '8px 20px', cursor: 'pointer', letterSpacing: '.08em' }}
                      >
                        Load more
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Input bar */}
          <div style={{ padding: "clamp(8px,2vw,12px) clamp(12px,4vw,18px) clamp(10px,3vw,16px)", background: MILK, flexShrink: 0 }}>
            <div className="from-ibar">
              {uploadedImage ? (
                <img
                  src={uploadedImage}
                  className="from-uthumb"
                  alt="attached"
                  title="Tap to remove"
                  onClick={removeUpload}
                />
              ) : (
                <button type="button" className="from-abtn" onClick={() => fileRef.current?.click()} title="Attach image">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={MID} strokeWidth="1.8">
                    <rect x="3" y="3" width="18" height="18" rx="3" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="M21 15l-5-5L5 21" />
                  </svg>
                </button>
              )}

              <textarea
                ref={taRef}
                className="from-ta"
                rows={1}
                placeholder="Tell me what you're looking for"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={kd}
                disabled={loading}
              />

              <button type="button" className={`from-sbtn ${!canSend ? "off" : ""}`} onClick={() => canSend && doSearch()}>
                {loading ? (
                  <div style={{ width: 12, height: 12, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,.3)', borderTopColor: 'white', animation: 'spin 0.8s linear infinite' }} />
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="19" x2="12" y2="5" />
                    <polyline points="5 12 12 5 19 12" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Sheet overlay */}
          <div className={`from-sov2 ${selectedProduct ? "vis" : ""}`} onClick={() => setSelected(null)} />

          {/* Product sheet */}
          <div
            className="from-sheet"
            style={{
              maxHeight: "92%",
              transform: selectedProduct ? `translateY(${sheetY}px)` : "translateY(100%)",
              transition: isDragging ? "none" : "transform .42s cubic-bezier(.32,.72,0,1)",
              willChange: "transform",
            }}
          >
            {selectedProduct && (
              <>
                <div
                  className="from-dh"
                  onPointerDown={onHandleDown}
                  onPointerMove={onHandleMove}
                  onPointerUp={onHandleUp}
                  onPointerLeave={onHandleUp}
                >
                  <div className="from-dp" />
                </div>

                <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none", paddingBottom: 4 }}>
                  {/* Image carousel */}
                  <div style={{ padding: "4px 16px 0" }}>
                    <div style={{ position: "relative", overflow: "hidden", borderRadius: 14 }}>
                      <div style={{ display: "flex", transition: isDragging ? "none" : "transform .35s cubic-bezier(.32,.72,0,1)", transform: `translateX(-${activeImg * 100}%)` }}>
                        {sheetImages.length > 0 ? sheetImages.map((img, i) => (
                          <div key={i} style={{ width: "100%", flexShrink: 0 }}>
                            <img src={img} alt="" style={{ width: "100%", aspectRatio: "4/5", objectFit: "cover", display: "block" }} />
                          </div>
                        )) : (
                          <div style={{ width: "100%", aspectRatio: "4/5", background: "#e6ddd0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={MID} strokeWidth="1.5" opacity=".4">
                              <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                        )}
                      </div>
                      {sheetImages.length > 1 && (
                        <div style={{ position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 5 }}>
                          {sheetImages.map((_, i) => (
                            <div
                              key={i}
                              onClick={e => { e.stopPropagation(); setActiveImg(i) }}
                              style={{ width: 5, height: 5, borderRadius: "50%", background: i === activeImg ? "white" : "rgba(255,255,255,.42)", cursor: "pointer", transform: i === activeImg ? "scale(1.3)" : "scale(1)", transition: "all .2s" }}
                            />
                          ))}
                        </div>
                      )}
                      {/* Save button on sheet */}
                      <button
                        onClick={() => toggleSaved(selectedProduct)}
                        style={{ position: 'absolute', top: 10, right: 10, width: 32, height: 32, borderRadius: '50%', background: 'rgba(253,252,250,0.88)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backdropFilter: 'blur(8px)' }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill={savedIds.has(selectedProduct.id) ? CHOC : 'none'} stroke={CHOC} strokeWidth="2">
                          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Product header — bold title + plain price (matches reference) */}
                  <div style={{ padding: "18px 20px 0" }}>
                    <h2 style={{ fontFamily: SANS, fontSize: "clamp(17px,4.5vw,20px)", fontWeight: 700, color: DARK, lineHeight: 1.2, letterSpacing: "-.01em", marginBottom: 6 }}>
                      {selectedProduct.title}
                    </h2>
                    <p style={{ fontFamily: SANS, fontSize: "clamp(14px,4vw,17px)", fontWeight: 400, color: DARK, marginBottom: 0 }}>
                      {formatMoney(selectedProduct.price, selectedProduct.currency, selectedProduct.base_currency, rates)}
                    </p>
                  </div>

                  {/* Description — no section label, just the text */}
                  {sheetDesc && (
                    <div style={{ padding: "14px 20px 0" }}>
                      <p style={{ fontFamily: SANS, fontSize: 13, color: MID, lineHeight: 1.7, fontWeight: 300 }}>{sheetDesc}</p>
                    </div>
                  )}

                  {/* Colour thumbnails — variant images as small swatches */}
                  {sheetImages.length > 1 && (
                    <div style={{ padding: "16px 20px 0" }}>
                      <div style={{ height: 1, background: BRD, marginBottom: 14 }} />
                      <div style={{ display: "flex", gap: 8 }}>
                        {sheetImages.slice(0, 4).map((img, i) => (
                          <button
                            key={i}
                            onClick={() => setActiveImg(i)}
                            style={{
                              width: 52, height: 65, borderRadius: 4, overflow: "hidden", padding: 0,
                              border: `2px solid ${i === activeImg ? DARK : 'transparent'}`,
                              cursor: "pointer", background: "#e6ddd0", flexShrink: 0,
                              transition: "border-color .15s",
                            }}
                          >
                            <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Size — underline tab selector */}
                  {sheetSizes.length > 0 && (
                    <div style={{ padding: "16px 20px 0" }}>
                      <div style={{ height: 1, background: BRD, marginBottom: 14 }} />
                      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", borderBottom: `1px solid ${BRD}`, paddingBottom: 2 }}>
                        {sheetSizes.map(s => (
                          <button
                            key={s}
                            className={`from-szb ${selectedSize === s ? "sel" : ""}`}
                            onClick={() => setSize(selectedSize === s ? null : s)}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedProduct.tags && selectedProduct.tags.length > 0 && (
                    <InfoSection label="Details">
                      <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
                        {selectedProduct.tags.slice(0, 6).map((tag, i) => (
                          <li key={i} style={{ fontFamily: SANS, fontSize: "clamp(11px,2.8vw,12px)", color: DARK, letterSpacing: ".01em", display: "flex", alignItems: "flex-start", gap: 9, fontWeight: 300, lineHeight: 1.5 }}>
                            <div style={{ width: 3, height: 3, borderRadius: "50%", background: GOLD, flexShrink: 0, marginTop: 5 }} />
                            {tag}
                          </li>
                        ))}
                      </ul>
                    </InfoSection>
                  )}

                  <InfoSection label="Store">
                    <p style={{ fontFamily: SANS, fontSize: "clamp(11px,3vw,13px)", color: MID, lineHeight: 1.7, fontWeight: 300 }}>
                      {selectedProduct.in_stock ? '✓ In stock' : '✗ Out of stock'} — ships from{' '}
                      {(() => { try { return new URL(selectedProduct.store_url).hostname.replace('www.', '') } catch { return selectedProduct.store_url } })()}
                    </p>
                  </InfoSection>

                  <div style={{ height: 10 }} />
                </div>

                {/* CTA block — Add to Cart + heart / Buy It Now (matches reference) */}
                <div style={{ borderTop: `1px solid ${BRD}`, background: MILK, flexShrink: 0, overflow: "hidden" }}>
                  {/* Row 1: Add to Cart + heart */}
                  <div style={{ display: "flex" }}>
                    <a
                      href={sheetSizes.length > 0 && !selectedSize ? undefined : checkoutUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`from-atc${sheetSizes.length > 0 && !selectedSize ? " warn" : ""}`}
                      onClick={sheetSizes.length > 0 && !selectedSize ? e => e.preventDefault() : undefined}
                    >
                      {sheetSizes.length > 0 && !selectedSize ? "Select a size" : "Add to Cart"}
                    </a>
                    <button
                      className={`from-hrt${savedIds.has(selectedProduct.id) ? " saved" : ""}`}
                      onClick={() => toggleSaved(selectedProduct)}
                      title={savedIds.has(selectedProduct.id) ? "Remove from saved" : "Save"}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill={savedIds.has(selectedProduct.id) ? MILK : "none"} stroke={MILK} strokeWidth="1.8">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                      </svg>
                    </button>
                  </div>
                  {/* Row 2: Buy It Now */}
                  <a
                    href={sheetSizes.length > 0 && !selectedSize ? undefined : checkoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="from-bin"
                    onClick={sheetSizes.length > 0 && !selectedSize ? e => e.preventDefault() : undefined}
                    style={{ opacity: sheetSizes.length > 0 && !selectedSize ? 0.5 : 1 }}
                  >
                    Buy It Now
                  </a>
                </div>
              </>
            )}
          </div>

        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
