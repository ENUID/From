'use client'

import { useState, useEffect, useRef } from 'react'
import { useFromChat } from './hooks/useFromChat'
import { formatMoney } from '@/lib/currency'
import type { ShopperContext } from '@/lib/shopperContext'
import { ExchangeRates } from '@/lib/exchangeRates'
import type { Product } from '@/components/ProductCard'

// ── Palette ───────────────────────────────────────────────────────────────────
const INK   = "#000000"
const INK2  = "#1a1a1a"
const INK3  = "#555555"
const BRD   = "rgba(0,0,0,0.07)"
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
      letterSpacing: '0.03em', lineHeight: 1, display: 'block', userSelect: 'none' }}>
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
  const [attachMenuOpen, setAttachMenu] = useState(false)
  const [menuPos, setMenuPos] = useState({ bottom: 100, left: 20 })
  const attachMenuRef = useRef<HTMLDivElement>(null)
  const paperclipRef  = useRef<HTMLButtonElement>(null)

  // Glass interaction states
  const [barPressed, setBarPressed]   = useState(false)
  const [sendPressed, setSendPressed] = useState(false)
  const barRef      = useRef<HTMLDivElement>(null)
  const attachWrap  = useRef<HTMLDivElement>(null)

  // Spring values
  const barScale  = useSpring(barPressed  ? 0.982 : 1, 260, 28)
  const sendScale = useSpring(sendPressed ? 0.84  : 1, 380, 24)

  // Specular light position tracking
  const light = useLight(barRef)

  const nameRef    = useRef<HTMLInputElement>(null)
  const taRef      = useRef<HTMLTextAreaElement>(null)
  const fileRef    = useRef<HTMLInputElement>(null)   // Photo Library
  const cameraRef  = useRef<HTMLInputElement>(null)   // Take Photo
  const anyRef     = useRef<HTMLInputElement>(null)   // Choose File / Drive
  const dragStartY = useRef(0)

  // Close attach menu on outside click
  useEffect(() => {
    if (!attachMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (
        !attachWrap.current?.contains(e.target as Node) &&
        !attachMenuRef.current?.contains(e.target as Node)
      ) setAttachMenu(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [attachMenuOpen])

  // Search results
  const lastProductMsg      = [...messages].reverse().find(m => m.role === 'assistant' && m.products?.length)
  const lastProductMsgIndex = lastProductMsg ? messages.lastIndexOf(lastProductMsg as any) : -1
  const searchProducts: Product[] = lastProductMsg?.products || []
  const lastAssistantText   = [...messages].reverse().find(m => m.role === 'assistant')?.content || ''
  const showEmpty = hasConversation && searchProducts.length === 0 && !loading
  const canSend   = input.trim().length > 0 || !!uploadedImage
  const hasName   = userName.length > 0

  useEffect(() => { setTimeout(() => setLoaded(true), 60) }, [])
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
    <div style={{ fontFamily: SANS, background: "#e8e8e8", minHeight: "100vh", width: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>

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
        html,body{margin:0;padding:0;background:#e8e8e8;min-height:100%;width:100%;}
        *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;-webkit-font-smoothing:antialiased;margin:0;padding:0;}
        ::-webkit-scrollbar{display:none;}

        /* ── Outer wrapper & shell ── */
        .fr-wrap{display:flex;align-items:flex-start;justify-content:center;height:100dvh;width:100%;
          background:linear-gradient(145deg,#e8e8e8 0%,#d8d8d8 100%);}
        .fr-shell{width:100%;height:100dvh;position:relative;display:flex;flex-direction:column;
          overflow:hidden;
          background:linear-gradient(160deg,#f9f9f9 0%,#f0f0f0 55%,#f5f5f5 100%);}
        @media(min-width:768px){
          .fr-wrap{align-items:center;padding:32px 16px;height:auto;min-height:100dvh;}
          .fr-shell{width:min(420px,100%);height:min(870px,calc(100dvh - 64px));
            border-radius:42px;
            box-shadow:0 50px 100px rgba(0,0,0,.22),0 2px 0 rgba(255,255,255,.9) inset,inset 0 0 0 1px rgba(0,0,0,.06);}
        }
        @media(min-width:1200px){
          .fr-shell{width:390px;height:min(844px,calc(100dvh - 80px));border-radius:48px;}
        }

        /* ── Body ── */
        .fr-body{flex:1;overflow-y:auto;overflow-x:hidden;scrollbar-width:none;display:flex;flex-direction:column;}
        .fr-body.home{justify-content:flex-start;padding-top:clamp(72px,18vh,110px);}

        /* ── Greeting ── */
        .fr-greet{padding:0 clamp(16px,5vw,24px) clamp(16px,4vw,24px);
          opacity:0;transform:translateY(8px);transition:opacity .5s,transform .5s;}
        .fr-greet.in{opacity:1;transform:translateY(0);}

        /* ── Grid ── */
        .fr-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:3px;width:100%;flex-shrink:0;}
        .fr-cell{aspect-ratio:1/1;position:relative;overflow:hidden;cursor:pointer;background:#e4e4e4;}
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
          background:rgba(248,248,248,0.94);
          backdrop-filter:blur(36px) saturate(180%);
          -webkit-backdrop-filter:blur(36px) saturate(180%);
          border-right:0.5px solid rgba(255,255,255,0.6);
          box-shadow:8px 0 48px rgba(0,0,0,.14),inset -0.5px 0 0 rgba(0,0,0,.06);
          border-radius:inherit;}
        .fr-sb.open{transform:translateX(0);}
        .fr-ov{position:absolute;inset:0;background:rgba(0,0,0,0);z-index:199;pointer-events:none;
          transition:background .34s;border-radius:inherit;}
        .fr-ov.open{background:rgba(0,0,0,.22);pointer-events:all;backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);}
        .fr-hi{display:flex;align-items:center;gap:14px;padding:13px 18px;cursor:pointer;border-radius:12px;
          transition:background .12s;font-family:'DM Sans',sans-serif;font-size:14px;color:${INK};font-weight:300;}
        .fr-hi:hover{background:rgba(0,0,0,.05);}
        .fr-hi.on{background:rgba(0,0,0,.07);font-weight:400;}

        /* ── Liquid glass search bar ── */
        .fr-bar{
          position:relative;overflow:hidden;
          display:flex;flex-direction:column;gap:10px;
          border-radius:24px;border:none;
          padding:18px 18px 10px 12px;
          will-change:transform;

          /* Glass material */
          background:rgba(255,255,255,0.62);
          backdrop-filter:blur(28px) saturate(190%) brightness(1.04);
          -webkit-backdrop-filter:blur(28px) saturate(190%) brightness(1.04);

          /* Layered shadow: ambient depth + close shadow + inner top specular edge */
          box-shadow:
            0 16px 48px rgba(0,0,0,.15),
            0 4px 14px rgba(0,0,0,.09),
            0 1px 3px rgba(0,0,0,.06),
            inset 0 1.5px 0 rgba(255,255,255,.98),
            inset 0 -0.5px 0 rgba(0,0,0,.05);
        }

        /* Textarea */
        .fr-bar-top{display:flex;align-items:flex-end;gap:8px;}
        .fr-bar-btm{display:flex;align-items:center;justify-content:space-between;}
        .fr-bar-right{display:flex;align-items:center;gap:8px;}
        .fr-ta{flex:1;border:none;background:transparent;font-family:'DM Sans',sans-serif;
          font-size:16px;color:${INK};caret-color:${INK};resize:none;overflow:hidden;
          min-height:24px;max-height:120px;line-height:1.55;padding:0;display:block;outline:none;width:100%;}
        .fr-ta::placeholder{color:rgba(0,0,0,.28);}

        /* Glass icon buttons */
        .fr-icon-btn{
          width:34px;height:34px;border-radius:50%;border:none;cursor:pointer;flex-shrink:0;
          display:flex;align-items:center;justify-content:center;
          color:${INK2};
          background:rgba(255,255,255,0.7);
          backdrop-filter:blur(8px);
          -webkit-backdrop-filter:blur(8px);
          box-shadow:0 2px 8px rgba(0,0,0,.10),inset 0 1px 0 rgba(255,255,255,.95),inset 0 -0.5px 0 rgba(0,0,0,.06);
          transition:background .15s,box-shadow .15s,transform .1s;
        }
        .fr-icon-btn:hover{
          background:rgba(255,255,255,0.9);
          box-shadow:0 3px 12px rgba(0,0,0,.14),inset 0 1px 0 rgba(255,255,255,1),inset 0 -0.5px 0 rgba(0,0,0,.07);
          transform:translateY(-0.5px);
        }
        .fr-icon-btn:active{transform:scale(0.93);}

        /* Send button */
        .fr-send-btn{
          width:36px;height:36px;border-radius:50%;border:none;
          background:${canSend ? INK : 'rgba(0,0,0,.18)'};
          display:flex;align-items:center;justify-content:center;
          cursor:${canSend ? 'pointer' : 'default'};
          flex-shrink:0;
          box-shadow:${canSend
            ? '0 4px 14px rgba(0,0,0,.35),0 1px 4px rgba(0,0,0,.2),inset 0 1px 0 rgba(255,255,255,.12)'
            : 'none'};
          transition:background .2s,box-shadow .2s;
        }

        /* Liquid glass bottom sheet */
        .fr-sheet{
          position:absolute;bottom:0;left:0;right:0;border-radius:24px 24px 0 0;
          display:flex;flex-direction:column;z-index:101;
          background:rgba(250,250,250,0.88);
          backdrop-filter:blur(36px) saturate(180%);
          -webkit-backdrop-filter:blur(36px) saturate(180%);
          border-top:0.5px solid rgba(255,255,255,0.75);
          box-shadow:
            0 -1px 0 rgba(0,0,0,.06),
            0 -24px 64px rgba(0,0,0,.14),
            inset 0 1.5px 0 rgba(255,255,255,.95);
        }
        .fr-sheet-ov{position:absolute;inset:0;background:rgba(0,0,0,0);z-index:100;
          pointer-events:none;transition:background .36s;border-radius:inherit;}
        .fr-sheet-ov.vis{background:rgba(0,0,0,.28);pointer-events:all;
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

      <input ref={fileRef}   type="file" accept="image/*"                       style={{ display:"none" }} onChange={handleFile} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display:"none" }} onChange={handleFile} />
      <input ref={anyRef}    type="file" accept="*/*"                           style={{ display:"none" }} onChange={handleFile} />

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
              <FromLogo size={24} color={INK} />
              <div style={{
                width: 38, height: 38, borderRadius: "50%",
                background: "rgba(255,255,255,0.72)",
                backdropFilter: "blur(12px) saturate(160%)",
                WebkitBackdropFilter: "blur(12px) saturate(160%)" as any,
                boxShadow: "0 4px 16px rgba(0,0,0,.13), 0 1px 4px rgba(0,0,0,.08), inset 0 1px 0 rgba(255,255,255,.95)",
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

          {/* ── Hamburger + FROM wordmark — floating overlay top-left ── */}
          <div style={{ position: "absolute", top: "8px", left: "8px", zIndex: 50, display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => setSidebar(true)} style={{
              width: 36, height: 36, borderRadius: "50%", border: "none",
              background: "rgba(255,255,255,0.72)",
              backdropFilter: "blur(12px) saturate(160%)", WebkitBackdropFilter: "blur(12px) saturate(160%)" as any,
              boxShadow: "0 4px 16px rgba(0,0,0,.13), 0 1px 4px rgba(0,0,0,.08), inset 0 1px 0 rgba(255,255,255,.95)",
              display: "flex", flexDirection: "column", alignItems: "flex-start",
              justifyContent: "center", gap: 4.5, padding: "8px 9px", cursor: "pointer",
              transition: "box-shadow .15s, transform .1s", flexShrink: 0,
            }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,.18), inset 0 1px 0 rgba(255,255,255,1)"; e.currentTarget.style.transform = "translateY(-0.5px)" }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,.13), 0 1px 4px rgba(0,0,0,.08), inset 0 1px 0 rgba(255,255,255,.95)"; e.currentTarget.style.transform = "" }}
            >
              <span style={{ display: "block", width: 16, height: 1.5, background: INK, borderRadius: 1 }} />
              <span style={{ display: "block", width: 12, height: 1.5, background: INK, borderRadius: 1 }} />
            </button>
            <FromLogo size={22} color={INK} />
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
                      : <button onClick={() => loadMoreProducts(lastProductMsgIndex)} style={{ fontFamily: SANS, fontSize: 10, color: INK3, background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '0.5px solid rgba(255,255,255,0.5)', borderRadius: 100, padding: '7px 20px', cursor: 'pointer', letterSpacing: '.08em', boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>Load more</button>
                    }
                  </div>
                )}
              </>
            )}

            <div style={{ height: 12 }} />
          </div>

          {/* ── Search bar — liquid glass ── */}
          <div style={{ padding: "6px clamp(12px,4vw,18px) 6px", flexShrink: 0, position: 'relative' }}>

            {/* Attach menu — fixed position to escape all overflow:hidden ancestors */}
            {attachMenuOpen && (
              <div ref={attachMenuRef} style={{
                position: 'fixed', bottom: menuPos.bottom, left: menuPos.left,
                zIndex: 9999, minWidth: 210,
                background: 'rgba(210,228,255,0.82)',
                backdropFilter: 'blur(28px) saturate(180%)',
                WebkitBackdropFilter: 'blur(28px) saturate(180%)',
                borderRadius: 18,
                border: '0.5px solid rgba(255,255,255,0.7)',
                boxShadow: '0 12px 40px rgba(0,0,0,.14), inset 0 1px 0 rgba(255,255,255,.9)',
                padding: '6px',
                overflow: 'hidden',
              }}>
                {([
                  { label: 'Photo Library', icon: 'gallery',  action: () => fileRef.current?.click() },
                  { label: 'Take Photo',    icon: 'camera',   action: () => cameraRef.current?.click() },
                  { label: 'Choose File',   icon: 'folder',   action: () => anyRef.current?.click() },
                  { label: 'Google Drive',  icon: 'drive',    action: () => anyRef.current?.click() },
                ] as { label: string; icon: string; action: () => void }[]).map(opt => (
                  <button key={opt.label} type="button"
                    onClick={() => { opt.action(); setAttachMenu(false) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14, width: '100%',
                      padding: '11px 14px', background: 'none', border: 'none',
                      borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                      fontFamily: SANS, fontSize: 14.5, color: INK, fontWeight: 400,
                      transition: 'background .1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.35)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    <span style={{
                      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                      background: 'rgba(255,255,255,0.55)',
                      backdropFilter: 'blur(8px)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,.9)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {opt.icon === 'gallery' && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                          <polyline points="21 15 16 10 5 21"/>
                        </svg>
                      )}
                      {opt.icon === 'camera' && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                          <circle cx="12" cy="13" r="4"/>
                        </svg>
                      )}
                      {opt.icon === 'folder' && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                        </svg>
                      )}
                      {opt.icon === 'drive' && (
                        <svg width="16" height="16" viewBox="0 0 87.3 78" fill={INK}>
                          <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3L27.5 53H0c0 1.55.4 3.1 1.2 4.5z" opacity=".7"/>
                          <path d="M43.65 25L29.9 1.2C28.55.4 27 0 25.45 0L6.6 32.5l13.75 23.8z" opacity=".7"/>
                          <path d="M43.65 25l13.75-23.8C56.05.4 54.5 0 52.95 0H34.1l-4.2 1.2z"/>
                          <path d="M43.65 53L29.9 76.8c1.35.8 2.9 1.2 4.45 1.2h18.6c1.55 0 3.1-.4 4.45-1.2z" opacity=".5"/>
                          <path d="M73.4 32.5L60.2 9.85C58.85 8.5 57.2 7.55 55.4 7.05L43.65 25 57.4 48.8z" opacity=".7"/>
                          <path d="M87.3 53c0-1.55-.4-3.1-1.2-4.5l-3.85-6.65c-.8-1.4-1.95-2.5-3.3-3.3L57.4 48.8 43.65 25 57.4 48.8 43.65 53l13.75 23.8c1.8-.5 3.45-1.45 4.8-2.8L87.3 57.5c.8-1.4 1.2-2.95 1.2-4.5z" opacity=".5"/>
                        </svg>
                      )}
                    </span>
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

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
                  background: `radial-gradient(ellipse 55% 40% at ${light.x * 100}% ${light.y * 100}%, rgba(255,255,255,0.52) 0%, rgba(255,255,255,0.18) 40%, transparent 70%)`,
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

                    {/* Paperclip — opens attach menu */}
                    <div ref={attachWrap}>
                      <button type="button" ref={paperclipRef} className="fr-icon-btn"
                        onClick={() => {
                          if (!attachMenuOpen && paperclipRef.current) {
                            const r = paperclipRef.current.getBoundingClientRect()
                            setMenuPos({ bottom: window.innerHeight - r.top + 10, left: r.left })
                          }
                          setAttachMenu(v => !v)
                        }}
                        style={{ transform: attachMenuOpen ? 'scale(0.93)' : undefined }}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                        </svg>
                      </button>
                    </div>
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
