'use client'

import { useState, useEffect, useRef } from 'react'
import { useFromChat } from './hooks/useFromChat'
import { formatMoney } from '@/lib/currency'
import type { ShopperContext } from '@/lib/shopperContext'
import { ExchangeRates } from '@/lib/exchangeRates'
import type { Product } from '@/components/ProductCard'

// ── Palette ───────────────────────────────────────────────────────────────────
const INK   = "#2C1206"   // dark brown
const INK2  = "#4A2010"   // medium brown
const INK3  = "#9B7060"   // warm muted brown
const BRD   = "rgba(44,18,6,0.08)"
const BG    = "#FFFFFF"   // pure white
const BG2   = "#F7F4F2"   // very light warm white
const SANS  = "'DM Sans', system-ui, sans-serif"
const SERIF = "'Cormorant Garamond', Georgia, serif"
const SEASON = "'TANMeringue', 'Bodoni Moda', Georgia, serif"

// ── Spring physics hook ───────────────────────────────────────────────────────
// Runs a damped spring in a RAF loop; returns live animated value.
function useSpring(target: number, stiffness = 220, damping = 26): number {
  const pos = useRef(target)
  const vel = useRef(0)
  const raf = useRef<number | null>(null)
  const [value, set] = useState(target)

  useEffect(() => {
    const tick = () => {
      const disp = pos.current - target
      const acc  = -stiffness * disp - damping * vel.current
      vel.current += acc / 60
      pos.current += vel.current / 60
      set(pos.current)
      if (Math.abs(disp) > 5e-4 || Math.abs(vel.current) > 5e-4) {
        raf.current = requestAnimationFrame(tick)
      }
    }
    if (raf.current) cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(tick)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
  }, [target, stiffness, damping])

  return value
}

// ── Mouse-tracking specular highlight ────────────────────────────────────────
function useLight(elRef: React.RefObject<HTMLDivElement | null>) {
  const [pos, setPos] = useState({ x: 0.28, y: 0.22 })
  useEffect(() => {
    const el = elRef.current; if (!el) return
    const move = (e: MouseEvent) => {
      const r = el.getBoundingClientRect()
      setPos({
        x: Math.max(0, Math.min(1, (e.clientX - r.left)  / r.width)),
        y: Math.max(0, Math.min(1, (e.clientY - r.top)   / r.height)),
      })
    }
    el.addEventListener('mousemove', move)
    return () => el.removeEventListener('mousemove', move)
  }, [elRef])
  return pos
}

// ── FROM wordmark ─────────────────────────────────────────────────────────────
function FromLogo({ size = 28, color = "#000000" }: { size?: number; color?: string }) {
  return (
    <span style={{ fontFamily: SEASON, fontSize: size, fontWeight: 400, color,
      letterSpacing: '0.03em', lineHeight: 1, display: 'block', userSelect: 'none',
      transition: 'color 2.4s ease' }}>
      FROM
    </span>
  )
}

// ── Sheet info divider row ────────────────────────────────────────────────────
function InfoSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <div style={{ height: 1, background: BRD, margin: "0 20px" }} />
      <div style={{ padding: "13px 20px" }}>
        <p style={{ fontFamily: SANS, fontSize: 9, fontWeight: 600, letterSpacing: ".18em",
          textTransform: "uppercase", color: INK3, marginBottom: 9 }}>{label}</p>
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
  const v = size ? p.variants?.find(v => v.options.some(o => o.label === size)) : p.variants?.[0]
  if (!v) return p.store_url
  try { const u = new URL(p.store_url); return `https://${u.hostname}/cart/${v.id.split('/').pop()}:1` }
  catch { return p.store_url }
}

// ── Main component ────────────────────────────────────────────────────────────
export default function FromApp({
  initialShopperContext, initialRates,
}: { initialShopperContext: ShopperContext; initialRates: ExchangeRates }) {

  const {
    messages, input, setInput, loading, hasConversation,
    savedIds, savedProducts, searchHistory, shopperContext, rates,
    sendMessage, toggleSaved, resetConversation, loadMoreProducts,
  } = useFromChat(initialShopperContext, initialRates)

  // ── UI state ────────────────────────────────────────────────────────────────
  const [userName, setUserName]       = useState("")
  const [isEditingName, setIsEditing] = useState(false)
  const [nameInput, setNameInput]     = useState("")
  const [selectedProduct, setSelected]= useState<Product | null>(null)
  const [selectedSize, setSize]       = useState<string | null>(null)
  const [activeImg, setActiveImg]     = useState(0)
  const [sheetY, setSheetY]           = useState(0)
  const [isDragging, setIsDragging]   = useState(false)
  const [sidebarOpen, setSidebar]     = useState(false)
  const [sidebarView, setSidebarView] = useState<'nav' | 'saved'>('nav')
  const [uploadedImage, setUploaded]    = useState<string | null>(null)
  const [uploadName, setUploadName]     = useState("")
  const [loaded, setLoaded]             = useState(false)
  const [logoHue, setLogoHue] = useState(220)

  // Glass interaction states
  const [barPressed, setBarPressed]   = useState(false)
  const [sendPressed, setSendPressed] = useState(false)
  const barRef      = useRef<HTMLDivElement>(null)

  // Spring values
  const barScale  = useSpring(barPressed  ? 0.982 : 1, 260, 28)
  const sendScale = useSpring(sendPressed ? 0.84  : 1, 380, 24)

  // Specular light position tracking
  const light = useLight(barRef)

  const nameRef    = useRef<HTMLInputElement>(null)
  const taRef      = useRef<HTMLTextAreaElement>(null)
  const fileRef    = useRef<HTMLInputElement>(null)
  const dragStartY = useRef(0)


  // Search results
  const lastProductMsg      = [...messages].reverse().find(m => m.role === 'assistant' && m.products?.length)
  const lastProductMsgIndex = lastProductMsg ? messages.lastIndexOf(lastProductMsg as any) : -1
  const searchProducts: Product[] = lastProductMsg?.products || []
  const lastAssistantText   = [...messages].reverse().find(m => m.role === 'assistant')?.content || ''
  const showEmpty = hasConversation && searchProducts.length === 0 && !loading
  const canSend   = input.trim().length > 0 || !!uploadedImage
  const hasName   = userName.length > 0

  useEffect(() => { setTimeout(() => setLoaded(true), 60) }, [])

  // Cycle logo colour through every hue every 11 seconds; step of 47° (prime-ish) so it
  // doesn't repeat the same sequence quickly. Lightness 36% keeps every hue readable on white.
  useEffect(() => {
    const id = setInterval(() => setLogoHue(h => (h + 47) % 360), 11000)
    return () => clearInterval(id)
  }, [])
  useEffect(() => { if (isEditingName && nameRef.current) { nameRef.current.focus(); nameRef.current.select() } }, [isEditingName])
  useEffect(() => { if (selectedProduct) { setSize(null); setActiveImg(0); setSheetY(0) } }, [selectedProduct])
  useEffect(() => {
    if (taRef.current) {
      taRef.current.style.height = "auto"
      taRef.current.style.height = Math.min(taRef.current.scrollHeight, 120) + "px"
    }
  }, [input])

  const onHandleDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture(e.pointerId)
    dragStartY.current = e.clientY - sheetY; setIsDragging(true)
  }
  const onHandleMove = (e: React.PointerEvent) => { if (isDragging) setSheetY(Math.max(0, e.clientY - dragStartY.current)) }
  const onHandleUp   = () => {
    if (!isDragging) return; setIsDragging(false)
    if (sheetY > 100) { setSelected(null); setSheetY(0) } else setSheetY(0)
  }

  const doSearch = () => {
    if (!canSend || loading) return
    const q = [input.trim(), uploadName].filter(Boolean).join(' '); if (!q) return
    sendMessage(q); setUploaded(null); setUploadName('')
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

  const sheetImages   = selectedProduct ? getProductImages(selectedProduct) : []
  const sheetDesc     = selectedProduct ? getDescriptionText(selectedProduct) : ''
  const sheetMaterial = selectedProduct ? extractMaterial(selectedProduct) : ''
  const sheetSizes    = selectedProduct ? getProductSizes(selectedProduct) : []
  const checkoutUrl   = selectedProduct ? getCheckoutUrl(selectedProduct, selectedSize) : '#'

  return (
    <div style={{ fontFamily: SANS, background: "#ffffff", minHeight: "100vh", width: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>

      {/* ── SVG filter for glass edge refraction ── */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <filter id="glass-refract" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.018 0.012" numOctaves="2" seed="4" result="noise"/>
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.2" xChannelSelector="R" yChannelSelector="G"/>
          </filter>
        </defs>
      </svg>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=DM+Sans:wght@300;400;500&display=swap');
        html,body{margin:0;padding:0;background:#fff;min-height:100%;width:100%;}
        *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;-webkit-font-smoothing:antialiased;margin:0;padding:0;}
        ::-webkit-scrollbar{display:none;}

        /* ── Outer wrapper & shell ── */
        .fr-wrap{display:flex;align-items:flex-start;justify-content:center;height:100dvh;width:100%;
          background:#ffffff;}
        .fr-shell{width:100%;height:100dvh;position:relative;display:flex;flex-direction:column;
          overflow:hidden;
          background:#ffffff;}
        @media(min-width:768px){
          .fr-wrap{align-items:center;padding:32px 16px;height:auto;min-height:100dvh;background:#f2ede8;}
          .fr-shell{width:min(420px,100%);height:min(870px,calc(100dvh - 64px));
            border-radius:42px;
            box-shadow:0 50px 100px rgba(44,18,6,.16),0 2px 0 rgba(255,255,255,.9) inset,inset 0 0 0 1px rgba(44,18,6,.06);}
        }
        @media(min-width:1200px){
          .fr-shell{width:390px;height:min(844px,calc(100dvh - 80px));border-radius:48px;}
        }

        /* ── Header ── */
        .fr-header{display:flex;align-items:center;gap:10px;padding:10px 10px 6px;flex-shrink:0;z-index:10;}

        /* ── Body ── */
        .fr-body{flex:1;overflow-y:auto;overflow-x:hidden;scrollbar-width:none;display:flex;flex-direction:column;padding-bottom:110px;}
        .fr-body.home{justify-content:flex-start;padding-top:clamp(16px,4vh,32px);}

        /* ── Search bar floats over content ── */
        .fr-bar-wrap{position:absolute;bottom:0;left:0;right:0;padding:0 clamp(12px,4vw,18px) 10px;z-index:50;}

        /* ── Greeting ── */
        .fr-greet{padding:0 clamp(16px,5vw,24px) clamp(16px,4vw,24px);
          opacity:0;transform:translateY(8px);transition:opacity .5s,transform .5s;}
        .fr-greet.in{opacity:1;transform:translateY(0);}

        /* ── Grid ── */
        .fr-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:3px;width:100%;flex-shrink:0;}
        .fr-cell{aspect-ratio:1/1;position:relative;overflow:hidden;cursor:pointer;background:#ede8e3;}
        .fr-cell img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .4s,filter .25s;}
        .fr-cell:hover img{transform:scale(1.04);filter:brightness(.88);}
        .fr-cell .fr-save{position:absolute;top:6px;right:6px;z-index:2;background:none;border:none;
          cursor:pointer;padding:4px;display:flex;opacity:0;transition:opacity .2s;}
        .fr-cell:hover .fr-save{opacity:1;}
        .fr-cell .fr-price{position:absolute;bottom:0;left:0;right:0;padding:18px 7px 7px;
          background:linear-gradient(transparent,rgba(0,0,0,.45));opacity:0;transition:opacity .2s;}
        .fr-cell:hover .fr-price{opacity:1;}
        .fr-cell{opacity:0;animation:fr-fi .35s ease forwards;}
        @keyframes fr-fi{to{opacity:1;}}
        .fr-cell:nth-child(1){animation-delay:.00s}.fr-cell:nth-child(2){animation-delay:.04s}.fr-cell:nth-child(3){animation-delay:.08s}
        .fr-cell:nth-child(4){animation-delay:.12s}.fr-cell:nth-child(5){animation-delay:.16s}.fr-cell:nth-child(6){animation-delay:.20s}
        .fr-cell:nth-child(7){animation-delay:.24s}.fr-cell:nth-child(8){animation-delay:.28s}.fr-cell:nth-child(9){animation-delay:.32s}
        .fr-cell:nth-child(n+10){animation-delay:.36s}

        /* ── Sidebar ── */
        .fr-sb{position:absolute;top:0;left:0;bottom:0;width:min(290px,86%);z-index:200;
          transform:translateX(-100%);transition:transform .34s cubic-bezier(.32,.72,0,1);
          display:flex;flex-direction:column;
          background:#ffffff;
          border-right:0.5px solid rgba(44,18,6,.08);
          box-shadow:8px 0 48px rgba(44,18,6,.10);
          border-radius:inherit;}
        .fr-sb.open{transform:translateX(0);}
        .fr-ov{position:absolute;inset:0;background:rgba(0,0,0,0);z-index:199;pointer-events:none;
          transition:background .34s;border-radius:inherit;}
        .fr-ov.open{background:rgba(44,18,6,.18);pointer-events:all;backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);}
        .fr-hi{display:flex;align-items:center;gap:14px;padding:13px 18px;cursor:pointer;border-radius:12px;
          transition:background .12s;font-family:'DM Sans',sans-serif;font-size:14px;color:${INK};font-weight:300;}
        .fr-hi:hover{background:rgba(44,18,6,.05);}
        .fr-hi.on{background:rgba(44,18,6,.07);font-weight:400;}

        /* ── Search bar ── */
        .fr-bar{
          position:relative;overflow:hidden;
          display:flex;flex-direction:column;gap:10px;
          border-radius:24px;border:none;
          padding:18px 18px 10px 12px;
          will-change:transform;
          background:#ffffff;
          box-shadow:
            0 16px 48px rgba(44,18,6,.10),
            0 4px 14px rgba(44,18,6,.06),
            0 1px 3px rgba(44,18,6,.04),
            inset 0 1.5px 0 rgba(255,255,255,.98),
            inset 0 -0.5px 0 rgba(44,18,6,.04);
        }

        /* Textarea */
        .fr-bar-top{display:flex;align-items:flex-end;gap:8px;}
        .fr-bar-btm{display:flex;align-items:center;justify-content:space-between;}
        .fr-bar-right{display:flex;align-items:center;gap:8px;}
        .fr-ta{flex:1;border:none;background:transparent;font-family:'DM Sans',sans-serif;
          font-size:16px;color:${INK};caret-color:${INK};resize:none;overflow:hidden;
          min-height:24px;max-height:120px;line-height:1.55;padding:0;display:block;outline:none;width:100%;}
        .fr-ta::placeholder{color:rgba(44,18,6,.28);}

        /* Icon buttons */
        .fr-icon-btn{
          width:34px;height:34px;border-radius:50%;border:none;cursor:pointer;flex-shrink:0;
          display:flex;align-items:center;justify-content:center;
          color:${INK2};
          background:#ffffff;
          box-shadow:0 2px 8px rgba(44,18,6,.10),inset 0 1px 0 rgba(255,255,255,.95),inset 0 -0.5px 0 rgba(44,18,6,.06);
          transition:background .15s,box-shadow .15s,transform .1s;
        }
        .fr-icon-btn:hover{
          background:#ffffff;
          box-shadow:0 3px 12px rgba(44,18,6,.13),inset 0 1px 0 #fff,inset 0 -0.5px 0 rgba(44,18,6,.07);
          transform:translateY(-0.5px);
        }
        .fr-icon-btn:active{transform:scale(0.93);}

        /* Send button */
        .fr-send-btn{
          width:36px;height:36px;border-radius:50%;border:none;
          background:${canSend ? INK : 'rgba(44,18,6,.18)'};
          display:flex;align-items:center;justify-content:center;
          cursor:${canSend ? 'pointer' : 'default'};
          flex-shrink:0;
          box-shadow:${canSend
            ? '0 4px 14px rgba(44,18,6,.35),0 1px 4px rgba(44,18,6,.2),inset 0 1px 0 rgba(255,255,255,.12)'
            : 'none'};
          transition:background .2s,box-shadow .2s;
        }

        /* Bottom sheet */
        .fr-sheet{
          position:absolute;bottom:0;left:0;right:0;border-radius:24px 24px 0 0;
          display:flex;flex-direction:column;z-index:101;
          background:#ffffff;
          border-top:0.5px solid rgba(44,18,6,.08);
          box-shadow:
            0 -1px 0 rgba(44,18,6,.05),
            0 -24px 64px rgba(44,18,6,.10);
        }
        .fr-sheet-ov{position:absolute;inset:0;background:rgba(0,0,0,0);z-index:100;
          pointer-events:none;transition:background .36s;border-radius:inherit;}
        .fr-sheet-ov.vis{background:rgba(44,18,6,.22);pointer-events:all;
          backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);}
        .fr-drag{padding:10px 0 6px;display:flex;justify-content:center;flex-shrink:0;
          cursor:ns-resize;touch-action:none;user-select:none;}
        .fr-drag-pill{width:34px;height:4px;background:rgba(0,0,0,.14);border-radius:2px;}

        /* Sizes */
        .fr-sz{font-family:'DM Sans',sans-serif;font-size:13px;color:${INK3};
          background:transparent;border:none;border-bottom:2px solid transparent;
          padding:6px 4px;cursor:pointer;transition:all .15s;min-width:36px;text-align:center;}
        .fr-sz:hover{color:${INK};}
        .fr-sz.on{color:${INK};border-bottom-color:${INK};font-weight:500;}

        /* CTAs */
        .fr-atc{flex:1;padding:16px;border:none;font-family:'DM Sans',sans-serif;font-size:11px;
          font-weight:500;letter-spacing:.12em;text-transform:uppercase;cursor:pointer;
          background:${INK};color:#fff;transition:background .18s;
          text-decoration:none;display:flex;align-items:center;justify-content:center;}
        .fr-atc:hover{background:#222;}
        .fr-atc.warn{background:${INK3};cursor:default;pointer-events:none;}
        .fr-hrt{width:54px;flex-shrink:0;padding:16px;border:none;
          border-left:1px solid rgba(255,255,255,.1);background:${INK};color:#fff;
          cursor:pointer;transition:background .18s;display:flex;align-items:center;justify-content:center;}
        .fr-hrt:hover{background:#222;}
        .fr-bin{width:100%;padding:16px;border:none;border-top:1px solid rgba(255,255,255,.08);
          font-family:'DM Sans',sans-serif;font-size:11px;font-weight:500;letter-spacing:.12em;
          text-transform:uppercase;cursor:pointer;background:${INK};color:#fff;
          transition:background .18s;text-decoration:none;display:block;text-align:center;}
        .fr-bin:hover{background:#222;}

        /* Results bar */
        .fr-results-bar{display:flex;justify-content:space-between;align-items:center;
          padding:10px 14px 6px;font-family:'DM Sans',sans-serif;font-size:10px;color:${INK3};}

        /* Upload thumb */
        .fr-uth{width:34px;height:34px;border-radius:10px;object-fit:cover;
          border:1px solid rgba(0,0,0,.1);flex-shrink:0;cursor:pointer;margin-bottom:1px;}

        @keyframes fr-bounce{0%,100%{transform:translateY(0);opacity:.2;}50%{transform:translateY(-6px);opacity:1;}}
        @keyframes spin{to{transform:rotate(360deg);}}
        button{cursor:pointer;} a{color:inherit;}
      `}</style>

      <input ref={fileRef} type="file" accept="image/*,*/*" style={{ display:"none" }} onChange={handleFile} />

      <div className="fr-wrap">
        <div className="fr-shell">

          {/* ── Sidebar overlay ── */}
          <div className={`fr-ov ${sidebarOpen ? "open" : ""}`} onClick={() => setSidebar(false)} />

          {/* ── Sidebar ── */}
          <div className={`fr-sb ${sidebarOpen ? "open" : ""}`}>

            {/* Header: From logo + profile avatar on same row */}
            <div style={{
              padding: "clamp(22px,5vw,30px) 20px 16px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              flexShrink: 0,
            }}>
              <FromLogo size={24} color={`hsl(${logoHue},85%,36%)`} />
              <div style={{
                width: 38, height: 38, borderRadius: "50%",
                background: "#ffffff",
                boxShadow: "0 4px 16px rgba(44,18,6,.12), 0 1px 4px rgba(44,18,6,.07), inset 0 1px 0 rgba(255,255,255,.95)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", flexShrink: 0, userSelect: "none",
              }}>
                {hasName ? (
                  <span style={{ fontFamily: SANS, fontSize: 15, fontWeight: 500, color: INK }}>
                    {userName.charAt(0).toUpperCase()}
                  </span>
                ) : (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={INK3} strokeWidth="1.7" strokeLinecap="round">
                    <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                  </svg>
                )}
              </div>
            </div>

            {/* Nav items */}
            <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none" }}>
              <div style={{ padding: "4px 12px 8px" }}>
                {([["Explore","compass"],["Saved","bookmark"],["Brands","grid"]] as [string,string][]).map(([l, ic]) => (
                  <div key={l} className={`fr-hi${sidebarView === 'saved' && l === 'Saved' ? ' on' : ''}`}
                    onClick={() => {
                      if (l === 'Explore') { setSidebarView('nav'); resetConversation(); setSidebar(false) }
                      else if (l === 'Saved') setSidebarView('saved')
                      else setSidebar(false)
                    }}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={INK3} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      {ic==="compass"  && <><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></>}
                      {ic==="bookmark" && <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>}
                      {ic==="grid"     && <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></>}
                    </svg>
                    {l}
                    {l === 'Saved' && savedProducts.length > 0 && (
                      <span style={{ marginLeft: 'auto', fontFamily: SANS, fontSize: 11, fontWeight: 500, color: INK, background: "rgba(0,0,0,.07)", borderRadius: 20, padding: "2px 8px" }}>
                        {savedProducts.length}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ height: 1, background: "rgba(0,0,0,.06)", margin: "4px 20px 10px" }} />

              <div style={{ padding: "0 12px" }}>
                {sidebarView === 'nav' ? (
                  <>
                    <p style={{ fontFamily: SANS, fontSize: 10, fontWeight: 500, letterSpacing: ".14em", textTransform: "uppercase", color: INK3, padding: "2px 8px 10px", opacity: .5 }}>Recent</p>
                    {searchHistory.length === 0
                      ? <p style={{ fontFamily: SANS, fontSize: 13, color: INK3, padding: "4px 8px", opacity: .4 }}>No recent searches</p>
                      : searchHistory.slice(0, 10).map(h => (
                          <div key={h.id} className="fr-hi" onClick={() => { sendMessage(h.query); setSidebar(false) }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={INK3} strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.query}</span>
                          </div>
                        ))
                    }
                  </>
                ) : (
                  <>
                    <p style={{ fontFamily: SANS, fontSize: 10, fontWeight: 500, letterSpacing: ".14em", textTransform: "uppercase", color: INK3, padding: "2px 8px 10px", opacity: .5 }}>Saved</p>
                    {savedProducts.length === 0
                      ? <p style={{ fontFamily: SANS, fontSize: 13, color: INK3, padding: "4px 8px", opacity: .4 }}>Nothing saved yet</p>
                      : savedProducts.map(p => (
                          <div key={p.id} className="fr-hi" onClick={() => { setSelected(p); setSidebar(false) }} style={{ gap: 10 }}>
                            <div style={{ width: 34, height: 42, borderRadius: 7, overflow: 'hidden', flexShrink: 0, background: '#e8e8e8' }}>
                              {p.image_url && <img src={p.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 500, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                              <div style={{ fontFamily: SANS, fontSize: 11, color: INK3, marginTop: 2 }}>{formatMoney(p.price, p.currency, p.base_currency, rates)}</div>
                            </div>
                          </div>
                        ))
                    }
                  </>
                )}
              </div>
            </div>

            {/* Footer: New chat pill + locale */}
            <div style={{ padding: "14px 18px 24px", flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <button
                onClick={() => { resetConversation(); setSidebarView('nav'); setSidebar(false) }}
                style={{
                  width: "auto", padding: "11px 20px", borderRadius: 100,
                  background: INK, border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                  fontFamily: SANS, fontSize: 13, fontWeight: 400, color: "#fff",
                  letterSpacing: ".01em", transition: "opacity .15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = ".8")}
                onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                New chat
              </button>
              <p style={{ fontFamily: SANS, fontSize: 10, color: INK3, letterSpacing: ".06em", textAlign: "right", marginTop: 8, opacity: .4 }}>
                {shopperContext.country} · {shopperContext.currency}
              </p>
            </div>

          </div>

          {/* ── Header ── */}
          <div className="fr-header">
            <button onClick={() => setSidebar(true)} style={{
              width: 36, height: 36, borderRadius: "50%", border: "none",
              background: "#ffffff",
              boxShadow: "0 2px 8px rgba(44,18,6,.10), inset 0 1px 0 rgba(255,255,255,.95)",
              display: "flex", flexDirection: "column", alignItems: "flex-start",
              justifyContent: "center", gap: 4.5, padding: "8px 9px", cursor: "pointer",
              transition: "box-shadow .15s, transform .1s", flexShrink: 0,
            }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 4px 14px rgba(44,18,6,.14), inset 0 1px 0 #fff"; e.currentTarget.style.transform = "translateY(-0.5px)" }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 2px 8px rgba(44,18,6,.10), inset 0 1px 0 rgba(255,255,255,.95)"; e.currentTarget.style.transform = "" }}
            >
              <span style={{ display: "block", width: 16, height: 1.5, background: INK, borderRadius: 1 }} />
              <span style={{ display: "block", width: 12, height: 1.5, background: INK, borderRadius: 1 }} />
            </button>
            <FromLogo size={22} color={`hsl(${logoHue},85%,36%)`} />
          </div>

          {/* ── Body ── */}
          <div className={`fr-body${hasConversation ? '' : ' home'}`}>

            {/* Greeting — home screen only */}
            {!hasConversation && <div className={`fr-greet${loaded ? ' in' : ''}`}>
              {(() => {
                const greetName = isEditingName ? (nameInput || "your name") : (hasName ? userName : "your name")
                const HELLO_PX = 72
                // Only the name shrinks; "Hello, " is locked at HELLO_PX no matter what
                const namePx = Math.min(HELLO_PX, Math.max(20, Math.floor(150 / (Math.max(1, greetName.length) * 0.52))))
                return (
                <div style={{ fontFamily: SERIF, lineHeight: 1.08, letterSpacing: "-.02em", marginBottom: 10,
                  display: "flex", alignItems: "baseline", flexWrap: "nowrap", overflow: "hidden" }}>
                  <span style={{ fontWeight: 300, color: INK, fontSize: HELLO_PX, flexShrink: 0, whiteSpace: "nowrap" }}>Hello,&nbsp;</span>
                  {isEditingName ? (
                    <input ref={nameRef} value={nameInput}
                      onChange={e => setNameInput(e.target.value)}
                      onBlur={saveName}
                      onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') { setNameInput(''); setIsEditing(false) } }}
                      maxLength={22} placeholder="your name"
                      style={{ fontFamily: SERIF, fontSize: namePx, fontWeight: 400, fontStyle: "italic", color: INK,
                        background: "transparent", border: "none",
                        borderBottom: `1.5px dashed ${INK}`,
                        paddingBottom: 1, letterSpacing: "-.02em", outline: "none",
                        width: `${Math.max(3, (nameInput.length || 8)) * 0.52}em`,
                        minWidth: 0, flexShrink: 1 }}
                    />
                  ) : (
                    <span onClick={() => { setNameInput(userName); setIsEditing(true) }}
                      style={{ fontFamily: SERIF, fontSize: namePx, fontWeight: 400, fontStyle: "italic", cursor: "pointer",
                        color: hasName ? INK : INK3,
                        borderBottom: `1.5px dashed ${hasName ? INK : 'rgba(0,0,0,.3)'}`,
                        paddingBottom: 1, minWidth: 0, flexShrink: 1 }}>
                      {hasName ? userName : "your name"}
                    </span>
                  )}
                </div>
                )
              })()}
              <p style={{ fontFamily: SANS, fontSize: "clamp(9px,2.2vw,11px)", letterSpacing: ".22em", textTransform: "uppercase", color: INK3, opacity: .45 }}>
                Shop at the speed of thought
              </p>
            </div>
            }


            {/* Loading dots */}
            {loading && (
              <div style={{ display: "flex", gap: 5, justifyContent: "center", padding: "44px 0" }}>
                {[0, .2, .4].map((d, i) => (
                  <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: INK, animation: `fr-bounce 1.2s ${d}s ease-in-out infinite` }} />
                ))}
              </div>
            )}

            {/* Empty state */}
            {showEmpty && !loading && (
              <div style={{ padding: "48px 20px", textAlign: "center" }}>
                {lastAssistantText
                  ? <p style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 300, fontStyle: "italic", color: INK3, lineHeight: 1.65 }}>{lastAssistantText}</p>
                  : <><p style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 300, fontStyle: "italic", color: INK3 }}>Nothing found</p>
                      <span style={{ fontFamily: SANS, fontSize: 10, color: INK3, letterSpacing: ".1em", display: "block", marginTop: 6, opacity: .6 }}>Try a different search</span></>
                }
              </div>
            )}

            {/* Product grid */}
            {hasConversation && !loading && searchProducts.length > 0 && (
              <>
                <div className="fr-grid">
                  {searchProducts.map(p => (
                    <div key={p.id} className="fr-cell" onClick={() => setSelected(p)} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && setSelected(p)}>
                      {p.image_url
                        ? <img src={p.image_url} alt="" loading="lazy" />
                        : <div style={{ width: '100%', height: '100%', background: '#e4e4e4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                {lastProductMsg && !lastProductMsg.hasNoMore && lastProductMsgIndex >= 0 && (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0 8px' }}>
                    {lastProductMsg.loadingMore
                      ? <div style={{ display: "flex", gap: 4 }}>{[0,.2,.4].map((d,i) => <div key={i} style={{ width: 4, height: 4, borderRadius: "50%", background: INK, animation: `fr-bounce 1.2s ${d}s ease-in-out infinite` }}/>)}</div>
                      : <button onClick={() => loadMoreProducts(lastProductMsgIndex)} style={{ fontFamily: SANS, fontSize: 10, color: INK3, background: '#ffffff', border: '0.5px solid rgba(44,18,6,.12)', borderRadius: 100, padding: '7px 20px', cursor: 'pointer', letterSpacing: '.08em', boxShadow: '0 2px 8px rgba(44,18,6,.07)' }}>Load more</button>
                    }
                  </div>
                )}
              </>
            )}

            <div style={{ height: 12 }} />
          </div>

          {/* ── Search bar — floats above content ── */}
          <div className="fr-bar-wrap">

            {/* Spring-animated wrapper */}
            <div style={{ transform: `scale(${barScale})`, transformOrigin: "center bottom", willChange: "transform" }}
              onMouseDown={() => setBarPressed(true)}
              onMouseUp={() => setBarPressed(false)}
              onMouseLeave={() => setBarPressed(false)}
            >
              <div ref={barRef} className="fr-bar">

                {/* Mouse-tracking specular hotspot */}
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: 20, pointerEvents: 'none', zIndex: 0,
                  background: `radial-gradient(ellipse 55% 40% at ${light.x * 100}% ${light.y * 100}%, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.12) 40%, transparent 70%)`,
                  transition: 'background 80ms linear',
                }} />

                {/* Top-edge prismatic shimmer */}
                <div style={{
                  position: 'absolute', top: 0, left: '8%', right: '8%', height: 1,
                  borderRadius: '0 0 50% 50%', pointerEvents: 'none', zIndex: 0,
                  background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.9) 30%, rgba(255,255,255,1) 50%, rgba(255,255,255,0.9) 70%, transparent)',
                  filter: 'blur(0.4px)',
                }} />

                {/* Content — sits above overlays */}
                <div style={{ position: 'relative', zIndex: 1 }}>
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

                  {/* Row 2: actions */}
                  <div className="fr-bar-btm">

                    {/* Paperclip — directly opens native file picker */}
                    <button type="button" className="fr-icon-btn" onClick={() => fileRef.current?.click()}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                      </svg>
                    </button>
                    <div className="fr-bar-right">
                      {/* Send with spring */}
                      <div style={{ transform: `scale(${sendScale})`, willChange: "transform" }}
                        onMouseDown={() => setSendPressed(true)}
                        onMouseUp={() => setSendPressed(false)}
                        onMouseLeave={() => setSendPressed(false)}
                      >
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

              </div>
            </div>
          </div>

          {/* ── Sheet overlay ── */}
          <div className={`fr-sheet-ov ${selectedProduct ? "vis" : ""}`} onClick={() => setSelected(null)} />

          {/* ── Product sheet — liquid glass ── */}
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
                  <div style={{ padding: "0 16px" }}>
                    <div style={{ position: "relative", overflow: "hidden", borderRadius: 14 }}>
                      <div style={{ display: "flex", transition: isDragging ? "none" : "transform .32s cubic-bezier(.32,.72,0,1)", transform: `translateX(-${activeImg * 100}%)` }}>
                        {sheetImages.length > 0 ? sheetImages.map((img, i) => (
                          <div key={i} style={{ width: "100%", flexShrink: 0 }}>
                            <img src={img} alt="" style={{ width: "100%", aspectRatio: "4/5", objectFit: "cover", display: "block" }} />
                          </div>
                        )) : (
                          <div style={{ width: "100%", aspectRatio: "4/5", background: "#ebebeb", display: "flex", alignItems: "center", justifyContent: "center" }}>
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

                  {sheetImages.length > 1 && (
                    <div style={{ padding: "12px 16px 0", display: "flex", gap: 6 }}>
                      {sheetImages.slice(0, 5).map((img, i) => (
                        <button key={i} onClick={() => setActiveImg(i)}
                          style={{ width: 46, height: 58, borderRadius: 6, overflow: "hidden", padding: 0, border: `2px solid ${i === activeImg ? INK : 'transparent'}`, cursor: "pointer", background: "#ebebeb", flexShrink: 0, transition: "border-color .15s" }}>
                          <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                        </button>
                      ))}
                    </div>
                  )}

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

                <div style={{ borderTop: `0.5px solid rgba(0,0,0,.08)`, flexShrink: 0, overflow: "hidden" }}>
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
