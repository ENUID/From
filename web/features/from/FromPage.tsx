'use client'

import { useState, useEffect, useRef } from 'react'
import { useFromChat } from './hooks/useFromChat'
import { formatMoney } from '@/lib/currency'
import type { ShopperContext } from '@/lib/shopperContext'
import { ExchangeRates } from '@/lib/exchangeRates'
import type { Product } from '@/components/ProductCard'
import { BRAND_NAMES } from '@/lib/stores'

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

// ── Logo colour palette — full-spectrum, dark→mid→light per hue ───────────────
const LOGO_PALETTE: string[] = [
  // Reds — dark to light
  "#5C0A0A","#7A1010","#991616","#B81C1C","#D32020","#E03030","#C0392B","#E74C3C",
  "#F1948A","#F5B7B1","#FADADD","#FF6B6B","#FF4444","#CC0000","#880000",
  // Burnt oranges / brick
  "#5E1F00","#7A2900","#99380A","#B84E14","#C0572B","#CC6633","#D4784A","#E8895A",
  "#F0A070","#F5BBA0","#A0522D","#8B4513","#6B2D0F",
  // Oranges
  "#7A3800","#9C4800","#C05A00","#E06600","#F07000","#FF8C00","#FF9F1C","#FFB347",
  "#FFC870","#FFD9A0","#FF6600","#E55300","#C24200",
  // Amber / gold
  "#7A5200","#9C6800","#B87D00","#D49200","#E8A800","#F5B800","#FFC200","#FFD000",
  "#FFE066","#FFF0A0","#DAA520","#B8860B","#8B6914",
  // Yellows
  "#7A6A00","#9C8800","#C0A800","#D4BC00","#E8D000","#F5E000","#FFEF00","#FFF176",
  "#FFFC8A","#FFFFAA","#E6CC00","#CCAA00","#AA8800",
  // Yellow-green / chartreuse
  "#4A5500","#5C6A00","#6E8000","#849600","#9AAC00","#AABF00","#C0D400","#D0E800",
  "#DEF060","#EEF8A0","#8DB600","#7A9900","#5C7A00",
  // Olive / moss
  "#2E3A0A","#3A4A0E","#485A14","#566A1C","#647A24","#728A2E","#80993A","#90A84A",
  "#A8BC6E","#C0D08E","#556B2F","#6B8E23","#4A6020",
  // Greens — dark
  "#0A2E0A","#0E3A12","#124A18","#165A20","#1A6A28","#1E7A30","#228A38","#269A40",
  "#2EAA4A","#3ABA56","#145214","#006400","#004D00",
  // Greens — vivid
  "#007A1F","#009926","#00B82E","#00CC33","#00E03A","#00F542","#2ECC71","#27AE60",
  "#1ABC9C","#16A085","#52BE80","#82E0AA","#A9DFBF",
  // Greens — light / mint
  "#3CB371","#4CAF70","#5EC970","#70D880","#90E490","#B0EEB0","#C8F5C8","#E0FAE0",
  "#98FB98","#90EE90","#7CFC00","#ADFF2F","#6BFF6B",
  // Teal / cyan-green
  "#00332E","#004D44","#006655","#007A66","#009980","#00B399","#00CCB0","#00E5C5",
  "#26A69A","#4DB6AC","#4ECDC4","#80CBC4","#A5D6D3",
  // Teals — mid
  "#006666","#008080","#009999","#00AAAA","#00BBBB","#00CCCC","#00DDDD","#33BBBB",
  "#55CCCC","#88DDDD","#AAEAEA","#CCF0F0","#20B2AA",
  // Cyan
  "#005A6E","#007A90","#0099B2","#00AABF","#00BBCC","#00CCDD","#00DDEE","#00EEEE",
  "#00FFFF","#66FFFF","#99FFFF","#00CED1","#008B8B",
  // Sky blues
  "#003A5C","#00527A","#006699","#007AB8","#0088CC","#009ADE","#00AAEE","#33BBFF",
  "#66CCFF","#99DDFF","#CCF0FF","#4FC3F7","#29B6F6",
  // Blues — dark to vivid
  "#0A0A6E","#10107A","#181899","#2020B8","#2828CC","#3030DD","#3838EE","#4444FF",
  "#5555FF","#6666FF","#0000CD","#0000FF","#1E3A8A",
  // Blues — mid
  "#1A4080","#1E52A0","#2464B8","#2A76CC","#3080D4","#3B9BDE","#4AA4E8","#5BBBF5",
  "#6EC6FF","#87D0FF","#A0DAFF","#2196F3","#1976D2",
  // Indigo / violet-blue
  "#1A0A5C","#28147A","#381E99","#4828B8","#5A32CC","#6B3CDD","#7A4AEE","#8A58FF",
  "#6610F2","#5C00D2","#4B0082","#7B2FBE","#9B59B6",
  // Purples
  "#3A0A5C","#4E107A","#641699","#7A1CB8","#9022CC","#A028D8","#B030E0","#C040EE",
  "#8B008B","#9400D3","#9B30FF","#C071FF","#DA90FF",
  // Violet / magentas
  "#5C0A4A","#7A1062","#991678","#B81C8E","#D022A4","#E028B0","#EE40C0","#F55CCE",
  "#FF00FF","#FF22EE","#FF44DD","#FF66CC","#FF88BB",
  // Pinks
  "#7A0A40","#991450","#B81E62","#CC2872","#DD3380","#EE4490","#FF55A0","#FF70B0",
  "#FF8EBF","#FFA0CC","#FFB5D8","#FFC8E4","#FF69B4",
  // Rose / hot pink
  "#8B0040","#A8004E","#C5005C","#E0006A","#FF1493","#FF4488","#FF6699","#FF88AA",
  "#FF99BB","#FFAAC4","#FFBBCC","#FFC5D5","#DC143C",
  // Warm neutrals / earthy
  "#3C2010","#52300A","#6B400E","#845016","#9C6020","#B4722C","#C88040","#D99058",
  "#E8A070","#F0B88A","#F5C89A","#F8D8B0","#8B4513",
  // Terracotta / rust
  "#7A2210","#9A2C14","#B83818","#CC4422","#DD5530","#E8663E","#F0774E","#F78860",
  "#FA9A72","#FCAC84","#FDBE96","#FECDB0","#CD5C5C",
  // Muted / desaturated accents
  "#4A3A30","#6A5040","#8A6A56","#AA8070","#C09080","#D0A898","#E0BCB0","#EDD0CA",
  "#6D4C41","#795548","#8D6E63","#A1887F","#BCAAA4",
  // Deep jewel tones
  "#1B0030","#2D004D","#3D0066","#1A0033","#002244","#001A33","#002B1A","#1A2600",
  "#330011","#220022","#001133","#002233","#1A1A00",
  // Bright neons (still readable on white via darker variants)
  "#CC0066","#CC3300","#CC6600","#CCCC00","#00CC00","#00CCCC","#0066CC","#6600CC",
  "#CC00CC","#FF0044","#FF4400","#AACC00","#00AACC",
]

// Shuffle deterministically (seeded Fisher-Yates so order is stable across renders)
function seededShuffle(arr: string[]): string[] {
  const a = [...arr]; let seed = 0x9e3779b9
  const rng = () => { seed ^= seed << 13; seed ^= seed >> 17; seed ^= seed << 5; return (seed >>> 0) / 0x100000000 }
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1));[a[i], a[j]] = [a[j], a[i]] }
  return a
}
const SHUFFLED_PALETTE = seededShuffle(LOGO_PALETTE)

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

// ── Collapsible accordion row (H&M editorial style) ───────────────────────────
function Accordion({ label, children, defaultOpen = false }: { label: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ borderTop: `1px solid ${BRD}` }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "17px 0", background: "transparent", border: "none", cursor: "pointer", textAlign: "left",
      }}>
        <span style={{ fontFamily: SANS, fontSize: 12, fontWeight: 600, letterSpacing: ".07em", textTransform: "uppercase", color: INK }}>{label}</span>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="1.6" strokeLinecap="round">
          <line x1="5" y1="12" x2="19" y2="12" />
          {!open && <line x1="12" y1="5" x2="12" y2="19" />}
        </svg>
      </button>
      <div style={{ display: "grid", gridTemplateRows: open ? "1fr" : "0fr", transition: "grid-template-rows .28s cubic-bezier(.32,.72,0,1)" }}>
        <div style={{ overflow: "hidden" }}>
          <div style={{ paddingBottom: 18 }}>{children}</div>
        </div>
      </div>
    </div>
  )
}

// ── Product helpers ───────────────────────────────────────────────────────────
// Signals that an image shows a person/model wearing the item.
const MODEL_HINTS = /(model|wearing|worn|lifestyle|on[-_ ]?body|onbody|outfit|\blook\b|\bfit\b|person|portrait|editorial|campaign|street|styled?)/i
// Signals that an image is a product-only / flat / studio shot.
const FLAT_HINTS  = /(flat[-_ ]?lay|flatlay|pack[-_ ]?shot|packshot|still[-_ ]?life|product[-_ ]?(shot|only)|ghost|mannequin|swatch|fabric|\bdetail\b|close[-_ ]?up|closeup|back[-_ ]?view|folded|hanger|cut[-_ ]?out|cutout|\blabel\b|white[-_ ]?bg|on[-_ ]?white)/i

// Collect every product image (full gallery), drop video/3d media, and order
// model/lifestyle shots first. Returns a de-duplicated list of image URLs.
function getProductImages(p: Product): string[] {
  type Img = { url: string; alt: string; idx: number }
  const seen = new Set<string>()
  const imgs: Img[] = []
  const push = (url?: string, alt?: string, type?: string) => {
    if (!url || seen.has(url)) return
    if (type && !/image|photo/i.test(type)) return   // skip video / model_3d / external_video
    seen.add(url)
    imgs.push({ url, alt: alt || '', idx: imgs.length })
  }
  // Full product gallery first, then variant-specific media, then the thumbnail fallback.
  p.media?.forEach(m => push(m.url, (m as { alt?: string }).alt, m.type))
  p.variants?.forEach(v => v.media?.forEach(m => push(m.url, (m as { alt?: string }).alt)))
  if (p.image_url) push(p.image_url)

  const score = (im: Img) => {
    const hay = `${im.alt} ${im.url}`
    let s = 0
    if (MODEL_HINTS.test(hay)) s += 2
    if (FLAT_HINTS.test(hay))  s -= 2
    return s
  }
  const ranked = imgs.map(im => ({ im, s: score(im) }))
  // Prefer model shots: drop the ones we can confidently tell are product-only,
  // but never empty the gallery — fall back to all images if filtering leaves none.
  const modelFirst = ranked.filter(r => r.s >= 0)
  const base = modelFirst.length > 0 ? modelFirst : ranked
  base.sort((a, b) => b.s - a.s || a.im.idx - b.im.idx)
  return base.map(r => r.im.url)
}
function getDescriptionText(p: Product): string {
  if (!p.description) return ''
  return p.description
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n').replace(/<\/li>/gi, '\n')
    .replace(/<[^>]*>/g, '').trim()
}

function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed[^>]*>/gi, '')
    .replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*')/gi, '')
    .replace(/href\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, '')
}

const SIZE_TABLE_KWS = /\b(size|chest|waist|hip|inseam|sleeve|shoulder|length|neck|bust|height|weight|measurements?)\b/i

function extractSizeTables(html: string): string | null {
  const tables: string[] = []
  const re = /<table[\s\S]*?<\/table>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    if (SIZE_TABLE_KWS.test(m[0])) tables.push(m[0])
  }
  return tables.length > 0 ? tables.join('') : null
}

function stripSizeTables(html: string): string {
  return html
    .replace(/<table[\s\S]*?<\/table>/gi, t => SIZE_TABLE_KWS.test(t) ? '' : t)
    .replace(/\n{3,}/g, '\n\n').trim()
}

const MATERIAL_KW = /material|fabric|composition|fiber|blend|cotton|linen|wool|silk|leather|polyester|nylon|viscose|cashmere|denim|hemp|spandex|lyocell|tencel|modal|bamboo|rayon|acrylic|elastane/i
const CARE_KW = /\b(care|wash|dry|iron|clean|bleach|tumble|hand.?wash|machine|delicate)\b/i

function extractMaterial(p: Product): string {
  const matTag = p.tags?.find(t => MATERIAL_KW.test(t))
  if (matTag) {
    const v = matTag.split('=>').pop()?.trim()
    if (v) return v
  }
  const descText = p.description_html
    ? p.description_html.replace(/<[^>]*>/g, ' ')
    : getDescriptionText(p)
  const m = descText.match(/\d+%?\s*(?:cotton|linen|wool|silk|hemp|polyester|nylon|viscose|cashmere|denim|spandex|lyocell|tencel|modal|bamboo|rayon|acrylic|elastane)/i)
  if (m) return m[0]
  const single = descText.match(/\b(?:cotton|linen|wool|silk|hemp|polyester|leather|canvas|cashmere|denim|viscose|nylon|spandex)\b/i)
  return single?.[0] || ''
}

function extractCareTags(p: Product): string[] {
  return p.tags?.filter(t => CARE_KW.test(t)).map(t => t.split('=>').pop()?.trim() || t) || []
}

function extractDetailTags(p: Product): string[] {
  return (p.tags || []).filter(t => {
    const lower = t.toLowerCase()
    return t.length > 2 && t.length < 80 && !MATERIAL_KW.test(t) && !CARE_KW.test(t) && !lower.includes('=>')
  })
}
function getProductSizes(p: Product): string[] {
  return p.options?.find(o => o.name.toLowerCase().includes('size'))?.values || []
}
function getProductColors(p: Product): string[] {
  return p.options?.find(o => /colou?r/i.test(o.name))?.values || []
}
// Map each size value → whether any variant carrying it is available.
function getSizeAvailability(p: Product): Record<string, boolean> {
  const map: Record<string, boolean> = {}
  const sizeOpt = p.options?.find(o => o.name.toLowerCase().includes('size'))
  if (!sizeOpt) return map
  for (const val of sizeOpt.values) {
    const v = p.variants?.find(v => v.options.some(o => o.label === val))
    map[val] = v ? v.availability : true
  }
  return map
}
// Map each colour value → whether any variant carrying it is available.
function getColorAvailability(p: Product): Record<string, boolean> {
  const map: Record<string, boolean> = {}
  const colorOpt = p.options?.find(o => /colou?r/i.test(o.name))
  if (!colorOpt) return map
  for (const val of colorOpt.values) {
    const v = p.variants?.find(v => v.options.some(o => o.label === val))
    map[val] = v ? v.availability : true
  }
  return map
}
function getCheckoutUrl(p: Product, size: string | null, color: string | null): string {
  let v = p.variants?.[0]
  if (p.variants?.length) {
    const wantSize  = size  && p.options?.some(o => o.name.toLowerCase().includes('size'))
    const wantColor = color && p.options?.some(o => /colou?r/i.test(o.name))
    if (wantSize && wantColor) {
      v = p.variants.find(vt => vt.options.some(o => o.label === size) && vt.options.some(o => o.label === color))
       || p.variants.find(vt => vt.options.some(o => o.label === size))
       || p.variants[0]
    } else if (wantSize) {
      v = p.variants.find(vt => vt.options.some(o => o.label === size)) || p.variants[0]
    } else if (wantColor) {
      v = p.variants.find(vt => vt.options.some(o => o.label === color)) || p.variants[0]
    }
  }
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
    deleteHistoryEntry, renameHistoryEntry,
  } = useFromChat(initialShopperContext, initialRates)

  // ── UI state ────────────────────────────────────────────────────────────────
  const [userName, setUserName]       = useState(() => {
    if (typeof window === 'undefined') return ""
    return localStorage.getItem('from_user_name') || ""
  })
  const [isEditingName, setIsEditing] = useState(false)
  const [nameInput, setNameInput]     = useState("")
  const [selectedProduct, setSelected]= useState<Product | null>(null)
  const [selectedSize, setSize]       = useState<string | null>(null)
  const [selectedColor, setColor]     = useState<string | null>(null)
  const [activeImg, setActiveImg]     = useState(0)
  const [sheetY, setSheetY]           = useState(0)
  const [sheetSnap, setSheetSnap]     = useState<'full'|'half'>('full')
  const [isDragging, setIsDragging]   = useState(false)
  const [sidebarOpen, setSidebar]     = useState(false)
  const [sidebarView, setSidebarView] = useState<'nav' | 'saved'>('nav')
  const [uploadedImages, setUploaded]   = useState<{ url: string; name: string }[]>([])
  const [loaded, setLoaded]             = useState(false)
  const [showExplore, setShowExplore]   = useState(false)
  const [exploreCache, setExploreCache] = useState<Product[]>(() => {
    try { return JSON.parse(localStorage.getItem('from:explore') || '[]') } catch { return [] }
  })
  const [logoIdx, setLogoIdx] = useState(0)
  const [ctxMenu, setCtxMenu] = useState<{ id: string; query: string; x: number; y: number } | null>(null)
  const [renameId, setRenameId]         = useState<string | null>(null)
  const [renameVal, setRenameVal]       = useState("")
  const [isWide, setIsWide]             = useState(false)

  // Glass interaction states
  const [barPressed, setBarPressed]   = useState(false)
  const [sendPressed, setSendPressed] = useState(false)
  const barRef      = useRef<HTMLDivElement>(null)

  // Spring values
  const barScale  = useSpring(barPressed  ? 0.982 : 1, 260, 28)
  const sendScale = useSpring(sendPressed ? 0.84  : 1, 380, 24)

  // Specular light position tracking
  const light = useLight(barRef)

  const nameRef       = useRef<HTMLInputElement>(null)
  const renameRef     = useRef<HTMLInputElement>(null)
  const taRef         = useRef<HTMLTextAreaElement>(null)
  const fileRef       = useRef<HTMLInputElement>(null)
  const dragHandleRef = useRef<HTMLDivElement>(null)
  const similarRef    = useRef<HTMLDivElement>(null)
  const sentinelRef   = useRef<HTMLDivElement>(null)
  const canLoadMoreRef = useRef(false)
  const loadMoreRef   = useRef(loadMoreProducts)

  // Image carousel horizontal swipe
  const [imgDX, setImgDX]   = useState(0)
  const imgStartX = useRef(0)
  const imgStartY = useRef(0)
  const imgActive = useRef(false)
  const imgLockH  = useRef<null | boolean>(null)
  const dragStartY    = useRef(0)
  const dragStartSnap = useRef<'full'|'half'>('full')
  const dragVel       = useRef(0)
  const dragLastY     = useRef(0)
  const dragLastT     = useRef(0)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wasLongPress   = useRef(false)


  // Search results
  const lastProductMsg      = [...messages].reverse().find(m => m.role === 'assistant' && m.products?.length)
  const lastProductMsgIndex = lastProductMsg ? messages.lastIndexOf(lastProductMsg as any) : -1
  const searchProducts: Product[] = (lastProductMsg?.products || []).filter((p: Product) => p.in_stock)
  const lastAssistantText   = [...messages].reverse().find(m => m.role === 'assistant')?.content || ''
  const showEmpty = hasConversation && searchProducts.length === 0 && !loading
  const canSend   = input.trim().length > 0 || uploadedImages.length > 0
  const hasName   = userName.length > 0

  // Keep refs up-to-date every render so the observer callback always sees current values
  canLoadMoreRef.current = !loading && !!lastProductMsg && !lastProductMsg.loadingMore && !lastProductMsg.hasNoMore && lastProductMsgIndex >= 0
  loadMoreRef.current = loadMoreProducts

  useEffect(() => { setTimeout(() => setLoaded(true), 60) }, [])
  useEffect(() => {
    const check = () => setIsWide(window.innerWidth >= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Prevent pull-to-refresh when dragging the sheet handle.
  // React touch listeners are passive by default, so we must attach directly.
  useEffect(() => {
    const el = dragHandleRef.current
    if (!el) return
    const block = (e: TouchEvent) => e.preventDefault()
    el.addEventListener('touchstart', block, { passive: false })
    el.addEventListener('touchmove',  block, { passive: false })
    return () => { el.removeEventListener('touchstart', block); el.removeEventListener('touchmove', block) }
  }, [])

  // Persist explore results so they survive page refresh
  useEffect(() => {
    if (showExplore && searchProducts.length > 0) {
      const toSave = searchProducts.filter(p => p.in_stock).slice(0, 20)
      setExploreCache(toSave)
      try { localStorage.setItem('from:explore', JSON.stringify(toSave)) } catch {}
    }
  }, [showExplore, searchProducts])

  useEffect(() => {
    const id = setInterval(() => setLogoIdx(i => (i + 1) % SHUFFLED_PALETTE.length), 11000)
    return () => clearInterval(id)
  }, [])
  useEffect(() => { if (isEditingName && nameRef.current) { nameRef.current.focus(); nameRef.current.select() } }, [isEditingName])
  useEffect(() => { if (renameId && renameRef.current) { renameRef.current.focus(); renameRef.current.select() } }, [renameId])
  useEffect(() => { if (selectedProduct) { setSize(null); setColor(null); setActiveImg(0); setSheetY(0); setSheetSnap('full') } }, [selectedProduct])
  useEffect(() => {
    if (taRef.current) {
      taRef.current.style.height = "auto"
      taRef.current.style.height = Math.min(taRef.current.scrollHeight, 120) + "px"
    }
  }, [input])

  // Infinite scroll: re-create the observer whenever the result message changes
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || lastProductMsgIndex < 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && canLoadMoreRef.current) {
          loadMoreRef.current(lastProductMsgIndex)
        }
      },
      { rootMargin: '1200px', threshold: 0 }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
    // Re-create when loadingMore flips false: the sentinel is often still inside
    // the rootMargin after a batch loads, so the observer won't re-fire unless
    // we create a fresh one — this chains loads with no visible gap.
  }, [lastProductMsgIndex, lastProductMsg?.loadingMore])

  const onHandleDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture(e.pointerId)
    const halfY = window.innerHeight * 0.44
    dragStartY.current  = e.clientY - (sheetSnap === 'half' ? halfY : 0)
    dragStartSnap.current = sheetSnap
    dragLastY.current = e.clientY
    dragLastT.current = Date.now()
    dragVel.current = 0
    setIsDragging(true)
  }
  const onHandleMove = (e: React.PointerEvent) => {
    if (!isDragging) return
    const now = Date.now(); const dt = now - dragLastT.current
    if (dt > 0) dragVel.current = (e.clientY - dragLastY.current) / dt
    dragLastY.current = e.clientY; dragLastT.current = now
    setSheetY(Math.max(0, e.clientY - dragStartY.current))
  }
  const onHandleUp = () => {
    if (!isDragging) return; setIsDragging(false)
    const vh = window.innerHeight
    const halfY = vh * 0.44
    const vel = dragVel.current        // px/ms, positive = downward
    const fastDown = vel > 0.5
    const fastUp   = vel < -0.5

    if (dragStartSnap.current === 'full') {
      // from full: fast flick or dragged past 20% → go half; even further or second flick → close
      if (fastDown || sheetY > vh * 0.55) { setSelected(null); setSheetY(0) }
      else if (sheetY > vh * 0.18)        { setSheetSnap('half'); setSheetY(halfY) }
      else                                { setSheetSnap('full'); setSheetY(0) }
    } else {
      // from half: flick/drag down → close, flick/drag up → full
      if (fastDown || sheetY > vh * 0.65) { setSelected(null); setSheetY(0) }
      else if (fastUp || sheetY < vh * 0.25){ setSheetSnap('full'); setSheetY(0) }
      else                                  { setSheetSnap('half'); setSheetY(halfY) }
    }
  }

  // ── Image carousel swipe (horizontal) ──
  const onImgDown = (e: React.PointerEvent) => {
    imgStartX.current = e.clientX
    imgStartY.current = e.clientY
    imgActive.current = true
    imgLockH.current = null
    setImgDX(0)
  }
  const onImgMove = (e: React.PointerEvent, count: number) => {
    if (!imgActive.current) return
    const dx = e.clientX - imgStartX.current
    const dy = e.clientY - imgStartY.current
    if (imgLockH.current === null) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        imgLockH.current = Math.abs(dx) > Math.abs(dy)
        if (imgLockH.current) { try { (e.currentTarget as Element).setPointerCapture(e.pointerId) } catch {} }
      }
    }
    if (imgLockH.current) {
      let d = dx
      // rubber-band resistance at the ends
      if ((activeImg === 0 && d > 0) || (activeImg >= count - 1 && d < 0)) d *= 0.35
      setImgDX(d)
    }
  }
  const onImgUp = (count: number) => {
    if (!imgActive.current) return
    imgActive.current = false
    if (imgLockH.current) {
      const threshold = 48
      if (imgDX < -threshold && activeImg < count - 1) setActiveImg(activeImg + 1)
      else if (imgDX > threshold && activeImg > 0)     setActiveImg(activeImg - 1)
    }
    imgLockH.current = null
    setImgDX(0)
  }

  const doSearch = () => {
    if (!canSend || loading) return
    const names = uploadedImages.map(u => u.name).join(' ')
    const q = [input.trim(), names].filter(Boolean).join(' '); if (!q) return
    setShowExplore(false)
    sendMessage(q); setUploaded([])
    if (fileRef.current) fileRef.current.value = ''
  }
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    files.slice(0, 11 - uploadedImages.length).forEach(file => {
      const reader = new FileReader()
      reader.onload = ev => {
        const url = ev.target?.result as string
        const name = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ').toLowerCase()
        setUploaded(prev => prev.length < 11 ? [...prev, { url, name }] : prev)
      }
      reader.readAsDataURL(file)
    })
    if (fileRef.current) fileRef.current.value = ''
  }
  const removeUpload = (idx: number) => setUploaded(prev => prev.filter((_, i) => i !== idx))
  const saveName = () => {
    const n = nameInput.trim()
    setUserName(n)
    localStorage.setItem('from_user_name', n)
    setIsEditing(false)
  }
  const kd = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); doSearch() } }

  const sheetImages    = selectedProduct ? getProductImages(selectedProduct) : []
  const sheetDesc      = selectedProduct ? getDescriptionText(selectedProduct) : ''
  const sheetDescRaw   = selectedProduct?.description_html
    ? sanitizeHtml(selectedProduct.description_html)
    : null
  const sheetSizeTable = sheetDescRaw ? extractSizeTables(sheetDescRaw) : null
  const sheetDescHtml  = sheetDescRaw
    ? (sheetSizeTable ? stripSizeTables(sheetDescRaw) : sheetDescRaw)
    : null
  const sheetMaterial  = selectedProduct ? extractMaterial(selectedProduct) : ''
  const sheetCareTags  = selectedProduct ? extractCareTags(selectedProduct) : []
  const sheetDetailTags= selectedProduct ? extractDetailTags(selectedProduct) : []
  const sheetSizes     = selectedProduct ? getProductSizes(selectedProduct) : []
  const sheetColors    = selectedProduct ? getProductColors(selectedProduct) : []
  const sizeAvail      = selectedProduct ? getSizeAvailability(selectedProduct) : {}
  const colorAvail     = selectedProduct ? getColorAvailability(selectedProduct) : {}
  const effectiveColor = selectedColor || (sheetColors.length > 0 ? sheetColors[0] : null)
  const checkoutUrl   = selectedProduct ? getCheckoutUrl(selectedProduct, selectedSize, effectiveColor) : '#'
  const sheetStoreHost= selectedProduct ? (() => { try { return new URL(selectedProduct.store_url).hostname.replace('www.', '') } catch { return '' } })() : ''
  const sheetBrandName = selectedProduct ? (() => {
    // Try BRAND_NAMES lookup first (keyed by domain), then vendor, then domain fallback
    if (sheetStoreHost) {
      const match = Object.entries(BRAND_NAMES).find(([domain]) =>
        sheetStoreHost === domain || sheetStoreHost.endsWith('.' + domain) || domain.endsWith('.' + sheetStoreHost)
      )
      if (match) return match[1]
    }
    return selectedProduct.vendor || sheetStoreHost || 'the brand'
  })() : ''
  const similarItems  = selectedProduct
    ? (searchProducts.length ? searchProducts : exploreCache).filter(p => p.id !== selectedProduct.id).slice(0, 12)
    : []

  return (
    <div style={{ fontFamily: SANS, background: "#ffffff", height: "100dvh", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>

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

        /* ── Outer wrapper & shell ──
           The app fills the whole device — phone, tablet or laptop — rather than a
           fixed phone-width strip. Only on very large monitors do we cap the width
           and centre it so the layout never stretches absurdly wide. */
        .fr-wrap{display:flex;align-items:stretch;justify-content:center;height:100dvh;width:100%;
          background:#ffffff;}
        .fr-shell{width:100%;max-width:1600px;height:100dvh;position:relative;display:flex;flex-direction:column;
          overflow:hidden;overscroll-behavior:none;
          background:#ffffff;}
        @media(min-width:1601px){
          .fr-wrap{background:#f2ede8;}
          .fr-shell{box-shadow:0 0 0 1px rgba(44,18,6,.06);}
        }

        /* ── Header ── */
        .fr-header{display:flex;align-items:center;justify-content:space-between;padding:10px 10px 6px;flex-shrink:0;z-index:10;}

        /* ── Content area (body + floating bar share this space) ── */
        .fr-content{flex:1;position:relative;overflow:hidden;}

        /* ── Body ── */
        .fr-body{position:absolute;inset:0;overflow-y:auto;overflow-x:hidden;scrollbar-width:none;display:flex;flex-direction:column;padding-bottom:120px;}
        .fr-body.home{justify-content:flex-start;padding-top:clamp(48px,10vh,80px);overflow:hidden;padding-bottom:0;}

        /* ── Search bar wrap ── */
        .fr-bar-wrap{
          position:absolute;bottom:0;left:0;right:0;
          padding:12px clamp(12px,4vw,18px) max(12px,env(safe-area-inset-bottom));
          background:rgba(255,255,255,0.5);
          backdrop-filter:blur(28px) saturate(160%);
          -webkit-backdrop-filter:blur(28px) saturate(160%);
        }
        /* On tablet/desktop the wrap is transparent — products show through,
           only the pill itself floats on top */
        @media(min-width:768px){
          .fr-bar-wrap{
            background:transparent;
            backdrop-filter:none;
            -webkit-backdrop-filter:none;
          }
        }

        /* ── Greeting ── */
        .fr-greet{padding:0 clamp(16px,5vw,24px) clamp(16px,4vw,24px);
          opacity:0;transform:translateY(8px);transition:opacity .5s,transform .5s;}
        .fr-greet.in{opacity:1;transform:translateY(0);}

        /* ── Grid — 2 col mobile → 3 col large phone/small tablet → 4 col iPad & up
           4 columns is the industry standard for fashion e-commerce on desktop
           (Net-a-Porter, SSENSE, Farfetch all cap at 4 — gives images room to breathe).
           Only very wide monitors (1500px+) step up to 5. */
        .fr-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:2px;width:100%;flex-shrink:0;}
        @media(min-width:600px){.fr-grid{grid-template-columns:repeat(3,1fr);}}
        @media(min-width:820px){.fr-grid{grid-template-columns:repeat(4,1fr);}}
        @media(min-width:1500px){.fr-grid{grid-template-columns:repeat(5,1fr);}}
        .fr-cell{aspect-ratio:3/4;position:relative;overflow:hidden;cursor:pointer;background:#ede8e3;}
        .fr-cell img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .4s,opacity .35s;}
        .fr-cell:hover img{transform:scale(1.03);}
        .fr-cell{opacity:0;animation:fr-fi .35s ease forwards;}
        @keyframes fr-fi{to{opacity:1;}}
        .fr-cell:nth-child(1){animation-delay:.00s}.fr-cell:nth-child(2){animation-delay:.05s}
        .fr-cell:nth-child(3){animation-delay:.10s}.fr-cell:nth-child(4){animation-delay:.15s}
        .fr-cell:nth-child(5){animation-delay:.20s}.fr-cell:nth-child(6){animation-delay:.25s}
        .fr-cell:nth-child(n+7){animation-delay:.30s}

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
          transition:background .12s;font-family:'DM Sans',sans-serif;font-size:14px;color:${INK};font-weight:300;
          -webkit-touch-callout:none;touch-action:pan-y;}
        .fr-hi:hover{background:rgba(44,18,6,.05);}
        .fr-hi.on{background:rgba(44,18,6,.07);font-weight:400;}

        /* ── Search bar pill ── */
        .fr-bar{
          position:relative;overflow:hidden;
          display:flex;flex-direction:column;gap:10px;
          width:100%;max-width:720px;margin:0 auto;
          border-radius:24px;border:none;
          padding:18px 18px 10px 12px;
          will-change:transform;
          background:rgba(255,255,255,0.82);
          box-shadow:
            0 8px 32px rgba(44,18,6,.10),
            0 2px 8px rgba(44,18,6,.06),
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

        /* Bottom sheet — phone */
        .fr-sheet{
          position:absolute;bottom:0;left:0;right:0;border-radius:24px 24px 0 0;
          display:flex;flex-direction:column;z-index:101;
          background:#ffffff;
          border-top:0.5px solid rgba(44,18,6,.08);
          box-shadow:
            0 -1px 0 rgba(44,18,6,.05),
            0 -24px 64px rgba(44,18,6,.10);
        }
        /* On tablet/desktop the sheet becomes a centred side-by-side card */
        @media(min-width:768px){
          .fr-sheet{
            top:50%;left:50%;
            right:auto;bottom:auto;
            width:min(960px,90vw);
            height:min(680px,88vh);
            min-height:0;
            border-radius:28px;
            border:0.5px solid rgba(44,18,6,.07);
            box-shadow:
              0 0 0 0.5px rgba(44,18,6,.04),
              0 8px 40px rgba(44,18,6,.14),
              0 32px 80px rgba(44,18,6,.10);
          }
          .fr-drag{display:none;}
        }
        .fr-sheet-ov{position:absolute;inset:0;background:rgba(0,0,0,0);z-index:100;
          pointer-events:none;transition:background .36s;border-radius:inherit;}
        .fr-sheet-ov.vis{background:rgba(44,18,6,.28);pointer-events:all;
          backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);}
        .fr-drag{padding:10px 0 6px;display:flex;justify-content:center;flex-shrink:0;
          cursor:ns-resize;touch-action:none;user-select:none;}
        .fr-drag-pill{width:34px;height:4px;background:rgba(0,0,0,.14);border-radius:2px;}

        /* Sizes — boxed grid (H&M editorial) */
        .fr-szbox{font-family:'DM Sans',sans-serif;font-size:13px;color:${INK};
          background:#fff;border:1px solid ${BRD};padding:14px 0;cursor:pointer;
          text-align:center;transition:border-color .15s;position:relative;}
        .fr-szbox:hover{border-color:${INK3};z-index:1;}
        .fr-szbox.on{border:1.5px solid ${INK};z-index:2;}
        .fr-szbox.dis{color:${INK3};text-decoration:line-through;cursor:default;opacity:.45;}
        .fr-szbox.dis:hover{border-color:${BRD};}

        /* HTML description rendering */
        .fr-html{font-family:'DM Sans',sans-serif;font-size:13px;color:${INK2};line-height:1.7;font-weight:300;}
        .fr-html p{margin-bottom:10px;}.fr-html p:last-child{margin-bottom:0;}
        .fr-html ul,.fr-html ol{padding-left:18px;margin-bottom:10px;}
        .fr-html li{margin-bottom:5px;}
        .fr-html h1,.fr-html h2,.fr-html h3,.fr-html h4{font-size:12px;font-weight:600;color:${INK};margin-bottom:8px;margin-top:12px;letter-spacing:.05em;text-transform:uppercase;}
        .fr-html b,.fr-html strong{font-weight:500;color:${INK};}
        .fr-html em,.fr-html i{font-style:italic;}
        .fr-html table{width:100%;border-collapse:collapse;font-size:12px;}
        .fr-html th{background:rgba(44,18,6,0.05);font-weight:600;text-transform:uppercase;letter-spacing:.05em;font-size:10px;color:${INK};}
        .fr-html th,.fr-html td{padding:9px 12px;border:1px solid rgba(44,18,6,0.10);text-align:left;vertical-align:middle;}
        .fr-html tr:nth-child(even) td{background:rgba(44,18,6,0.025);}
        /* Size guide table wrapper */
        .fr-size-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;border-radius:6px;border:1px solid rgba(44,18,6,0.08);}
        .fr-size-wrap table{min-width:100%;white-space:nowrap;}

        /* ADD button — full width */
        .fr-add{display:block;width:100%;padding:17px;border:none;cursor:pointer;
          font-family:'DM Sans',sans-serif;font-size:12px;font-weight:500;letter-spacing:.14em;
          text-transform:uppercase;text-align:center;text-decoration:none;
          background:${INK};color:#fff;transition:background .18s;}
        .fr-add:hover{background:#3d1c0c;}
        .fr-add.warn{background:#fff;color:${INK3};border:1px solid ${BRD};cursor:default;pointer-events:none;}

        /* Results bar */
        .fr-results-bar{display:flex;justify-content:space-between;align-items:center;
          padding:10px 14px 6px;font-family:'DM Sans',sans-serif;font-size:10px;color:${INK3};}


        @keyframes fr-bounce{0%,100%{transform:translateY(0);opacity:.2;}50%{transform:translateY(-6px);opacity:1;}}
        @keyframes sk-sweep{0%{transform:translateX(-100%);}100%{transform:translateX(300%);}}
        @keyframes spin{to{transform:rotate(360deg);}}
        @keyframes ctxIn{0%{opacity:0;transform:scale(0.60);}55%{opacity:1;transform:scale(1.04);}80%{transform:scale(0.98);}100%{opacity:1;transform:scale(1);}}
        button{cursor:pointer;} a{color:inherit;}
      `}</style>

      <input ref={fileRef} type="file" accept="image/*,*/*" multiple style={{ display:"none" }} onChange={handleFile} />

      <div className="fr-wrap">
        <div className="fr-shell">

          {/* ── Sidebar overlay ── */}
          <div className={`fr-ov ${sidebarOpen ? "open" : ""}`} onClick={() => setSidebar(false)} />

          {/* ── Sidebar ── */}
          <div className={`fr-sb ${sidebarOpen ? "open" : ""}`}>

            {/* Header: From logo + avatar */}
            <div style={{
              padding: "clamp(22px,5vw,30px) 20px 14px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              flexShrink: 0,
            }}>
              <FromLogo size={24} color={SHUFFLED_PALETTE[logoIdx]} />
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

            {/* New chat button */}
            <div style={{ padding: "0 20px 14px", flexShrink: 0 }}>
              <button
                onClick={() => { resetConversation(); setSidebarView('nav'); setSidebar(false) }}
                style={{
                  width: "100%", padding: "11px 16px", borderRadius: 12,
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
            </div>

            {/* Fixed nav items — Explore / Bag / Collections */}
            <div style={{ padding: "4px 12px 4px", flexShrink: 0 }}>

              {/* Explore — personalised feed from history/saves */}
              <div className="fr-hi" onClick={() => {
                setSidebarView('nav')
                setSidebar(false)
                setShowExplore(true)
                const terms = searchHistory.slice(0, 3).map(h => h.query)
                const saved = savedProducts.slice(0, 2).map(p => p.title)
                const hints = [...terms, ...saved].filter(Boolean)
                if (hints.length > 0) {
                  sendMessage(`Show me a curated selection of products based on: ${hints.join(', ')}. Return products only.`, { skipHistory: true })
                }
              }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={INK3} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5z"/>
                  <path d="M19 3l.8 2.2L22 6l-2.2.8L19 9l-.8-2.2L16 6l2.2-.8z"/>
                  <path d="M5 17l.5 1.5L7 19l-1.5.5L5 21l-.5-1.5L3 19l1.5-.5z"/>
                </svg>
                Explore
              </div>

              {/* Bag (saved products) */}
              <div className={`fr-hi${sidebarView === 'saved' ? ' on' : ''}`} onClick={() => setSidebarView('saved')}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={INK3} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                  <line x1="3" y1="6" x2="21" y2="6"/>
                  <path d="M16 10a4 4 0 0 1-8 0"/>
                </svg>
                Bag
                {savedProducts.length > 0 && (
                  <span style={{ marginLeft: 'auto', fontFamily: SANS, fontSize: 11, fontWeight: 500, color: INK, background: "rgba(0,0,0,.07)", borderRadius: 20, padding: "2px 8px" }}>
                    {savedProducts.length}
                  </span>
                )}
              </div>

              {/* Collections */}
              <div className="fr-hi" onClick={() => setSidebar(false)}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={INK3} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                  <path d="M2 17l10 5 10-5"/>
                  <path d="M2 12l10 5 10-5"/>
                </svg>
                Collections
              </div>

            </div>

            {/* Divider */}
            <div style={{ height: 1, background: "rgba(0,0,0,.06)", margin: "4px 20px 8px", flexShrink: 0 }} />

            {/* Scrollable recents / bag content */}
            <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none", padding: "0 12px" }}>
              {sidebarView === 'nav' ? (
                <>
                  <p style={{ fontFamily: SANS, fontSize: 10, fontWeight: 500, letterSpacing: ".14em", textTransform: "uppercase", color: INK3, padding: "2px 8px 10px", opacity: .5 }}>Recent</p>
                  {searchHistory.length === 0
                    ? <p style={{ fontFamily: SANS, fontSize: 13, color: INK3, padding: "4px 8px", opacity: .4 }}>No recent searches</p>
                    : searchHistory.slice(0, 10).map(h => (
                        <div key={h.id} className="fr-hi"
                          style={{ userSelect: 'none', WebkitUserSelect: 'none' } as React.CSSProperties}
                          onContextMenu={e => e.preventDefault()}
                          onClick={() => {
                            if (wasLongPress.current) { wasLongPress.current = false; return }
                            sendMessage(h.query); setSidebar(false)
                          }}
                          onPointerDown={e => {
                            wasLongPress.current = false
                            const { clientX, clientY } = e
                            longPressTimer.current = setTimeout(() => {
                              wasLongPress.current = true
                              const y = clientY + 8 + 160 > window.innerHeight ? clientY - 168 : clientY + 8
                              setCtxMenu({ id: h.id, query: h.query, x: Math.min(clientX, window.innerWidth - 220), y })
                            }, 550)
                          }}
                          onPointerUp={() => { if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null } }}
                          onPointerLeave={() => { if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null } }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={INK3} strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                          {renameId === h.id
                            ? <input ref={renameRef} value={renameVal}
                                onClick={e => e.stopPropagation()}
                                onChange={e => setRenameVal(e.target.value)}
                                onBlur={() => { if (renameVal.trim()) renameHistoryEntry(h.id, renameVal.trim()); setRenameId(null) }}
                                onKeyDown={e => {
                                  e.stopPropagation()
                                  if (e.key === 'Enter') { if (renameVal.trim()) renameHistoryEntry(h.id, renameVal.trim()); setRenameId(null) }
                                  if (e.key === 'Escape') setRenameId(null)
                                }}
                                style={{ flex: 1, background: 'transparent', border: 'none', borderBottom: `1px solid ${INK3}`,
                                  fontFamily: SANS, fontSize: 16, color: INK, outline: 'none', padding: '1px 0', minWidth: 0,
                                  transform: 'scale(0.8125)', transformOrigin: 'left center' }}
                              />
                            : <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.query}</span>
                          }
                        </div>
                      ))
                  }
                </>
              ) : (
                <>
                  <p style={{ fontFamily: SANS, fontSize: 10, fontWeight: 500, letterSpacing: ".14em", textTransform: "uppercase", color: INK3, padding: "2px 8px 10px", opacity: .5 }}>Bag</p>
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

          {/* ── Header ── */}
          <div className="fr-header">
            {/* Left: hamburger + logo */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
              <div onClick={() => { resetConversation(); setShowExplore(false) }} style={{ cursor: 'pointer' }}>
                <FromLogo size={22} color={SHUFFLED_PALETTE[logoIdx]} />
              </div>
            </div>
            {/* Right: compose / new chat */}
            <button
              onClick={() => resetConversation()}
              style={{
                width: 36, height: 36, borderRadius: "50%", border: "none",
                background: "#ffffff",
                boxShadow: "0 2px 8px rgba(44,18,6,.10), inset 0 1px 0 rgba(255,255,255,.95)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", flexShrink: 0, transition: "box-shadow .15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 14px rgba(44,18,6,.14), inset 0 1px 0 #fff")}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = "0 2px 8px rgba(44,18,6,.10), inset 0 1px 0 rgba(255,255,255,.95)")}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9"/>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
            </button>
          </div>

          {/* ── Content (body + floating bar share this space) ── */}
          <div className="fr-content">

          {/* ── Body ── */}
          <div className={`fr-body${hasConversation ? '' : ' home'}`}>

            {/* Greeting — home screen only, not on Explore */}
            {!hasConversation && !showExplore && <div className={`fr-greet${loaded ? ' in' : ''}`}>
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


            {/* Loading — skeleton image grid */}
            {loading && (
              <div className="fr-grid">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} style={{
                    aspectRatio: '3/4',
                    position: 'relative',
                    overflow: 'hidden',
                    background: '#e8e4de',
                  }}>
                    {/* Shimmer: fade from base color → light → base color — no dark edges */}
                    <div style={{
                      position: 'absolute', top: 0, bottom: 0,
                      width: '60%',
                      background: 'linear-gradient(90deg, #e8e4de 0%, #edeae5 35%, #f0ece7 50%, #edeae5 65%, #e8e4de 100%)',
                      animation: `sk-sweep 2s ${i * 0.06}s ease-in-out infinite`,
                      willChange: 'transform',
                    }} />
                  </div>
                ))}
              </div>
            )}

            {/* Empty state */}
            {showEmpty && !loading && !showExplore && (
              <div style={{ padding: "48px 20px", textAlign: "center" }}>
                <p style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 300, fontStyle: "italic", color: INK3 }}>Nothing found</p>
                <span style={{ fontFamily: SANS, fontSize: 10, color: INK3, letterSpacing: ".1em", display: "block", marginTop: 6, opacity: .6 }}>Try a different search</span>
              </div>
            )}

            {/* Explore — cached products while no live results, or "build history" nudge */}
            {showExplore && !loading && searchProducts.length === 0 && (
              exploreCache.length > 0
                ? <div className="fr-grid">{exploreCache.filter(p => p.in_stock).map(p => (
                    <div key={p.id} className="fr-cell" onClick={() => setSelected(p)} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && setSelected(p)}>
                      {p.image_url ? (
                        <>
                          <div style={{ position:'absolute',inset:0,zIndex:1,overflow:'hidden',background:'#e8e4de' }}>
                            <div style={{ position:'absolute',top:0,bottom:0,width:'60%',
                              background:'linear-gradient(90deg,#e8e4de 0%,#edeae5 35%,#f0ece7 50%,#edeae5 65%,#e8e4de 100%)',
                              animation:'sk-sweep 2s ease-in-out infinite',willChange:'transform' }} />
                          </div>
                          <img src={p.image_url} alt="" loading="lazy"
                            style={{ position:'relative',zIndex:2,opacity:0 }}
                            onLoad={e => { (e.target as HTMLImageElement).style.opacity = '1' }}
                          />
                        </>
                      ) : (
                        <div style={{ width:'100%',height:'100%',background:'#e4e4e4',display:'flex',alignItems:'center',justifyContent:'center' }}>
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={INK3} strokeWidth="1.4" opacity=".4"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </div>
                      )}
                    </div>
                  ))}</div>
                : <div style={{ padding: "60px 28px", textAlign: "center" }}>
                    <p style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 300, fontStyle: "italic", color: INK3, lineHeight: 1.5 }}>Search a few things first</p>
                    <span style={{ fontFamily: SANS, fontSize: 11, color: INK3, letterSpacing: ".1em", display: "block", marginTop: 8, opacity: .5 }}>Explore personalises as you search</span>
                  </div>
            )}

            {/* Product grid */}
            {(hasConversation || showExplore) && !loading && searchProducts.length > 0 && (
              <>
                <div className="fr-grid">
                  {searchProducts.map(p => (
                    <div key={p.id} className="fr-cell" onClick={() => setSelected(p)} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && setSelected(p)}>
                      {p.image_url ? (
                        <>
                          {/* Shimmer sits behind until image is opaque */}
                          <div style={{ position:'absolute',inset:0,zIndex:1,overflow:'hidden',background:'#e8e4de' }}>
                            <div style={{ position:'absolute',top:0,bottom:0,width:'60%',
                              background:'linear-gradient(90deg,#e8e4de 0%,#edeae5 35%,#f0ece7 50%,#edeae5 65%,#e8e4de 100%)',
                              animation:'sk-sweep 2s ease-in-out infinite',willChange:'transform' }} />
                          </div>
                          <img src={p.image_url} alt=""
                            style={{ position:'relative',zIndex:2,opacity:0 }}
                            onLoad={e => { (e.target as HTMLImageElement).style.opacity = '1' }}
                          />
                        </>
                      ) : (
                        <div style={{ width:'100%',height:'100%',background:'#e4e4e4',display:'flex',alignItems:'center',justifyContent:'center' }}>
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={INK3} strokeWidth="1.4" opacity=".4"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div ref={sentinelRef} style={{ height: 1 }} />
                {lastProductMsg?.loadingMore && (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0 10px' }}>
                    <div style={{ display: "flex", gap: 4 }}>{[0,.2,.4].map((d,i) => <div key={i} style={{ width: 4, height: 4, borderRadius: "50%", background: INK, animation: `fr-bounce 1.2s ${d}s ease-in-out infinite` }}/>)}</div>
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

                {/* Subtle top-edge highlight only */}
                <div style={{
                  position: 'absolute', top: 0, left: '15%', right: '15%', height: 1,
                  pointerEvents: 'none', zIndex: 0,
                  background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.55) 40%, rgba(255,255,255,0.65) 50%, rgba(255,255,255,0.55) 60%, transparent)',
                }} />

                {/* Content — sits above overlays */}
                <div style={{ position: 'relative', zIndex: 1 }}>

                  {/* Image strip — appears above search bar when images attached */}
                  {uploadedImages.length > 0 && (
                    <div style={{
                      display: 'flex', gap: 8, overflowX: 'auto', padding: '10px 12px 0',
                      scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch',
                    }}>
                      {uploadedImages.map((img, idx) => (
                        <div key={idx} style={{ position: 'relative', flexShrink: 0 }}>
                          <img src={img.url} alt="" style={{
                            width: 72, height: 72, borderRadius: 10, objectFit: 'cover',
                            display: 'block', border: '1px solid rgba(0,0,0,0.08)',
                          }} />
                          {/* Remove button */}
                          <button
                            type="button"
                            onClick={() => removeUpload(idx)}
                            style={{
                              position: 'absolute', top: -6, right: -6,
                              width: 20, height: 20, borderRadius: '50%',
                              background: '#1E1A16', border: '1.5px solid #fff',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              cursor: 'pointer', padding: 0,
                            }}>
                            <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                              <path d="M2 2l6 6M8 2l-6 6" stroke="white" strokeWidth="1.6" strokeLinecap="round"/>
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Row 1: input */}
                  <div className="fr-bar-top">
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
          </div>{/* end fr-bar-wrap */}
          </div>{/* end fr-content */}

          {/* ── Sheet overlay — phone taps outside to close; desktop X button does it ── */}
          <div className={`fr-sheet-ov ${selectedProduct ? "vis" : ""}`} onClick={isWide ? undefined : () => setSelected(null)} />

          {/* ── History long-press context menu — Apple Liquid Glass ── */}
          {ctxMenu && (
            <>
              {/* Dismiss — invisible tap target, no blur or dim on background */}
              <div onClick={() => setCtxMenu(null)}
                style={{ position: 'fixed', inset: 0, zIndex: 9000 }} />

              {/* Glass menu — no backdrop-filter so nothing behind it blurs */}
              <div style={{
                position: 'fixed',
                left: ctxMenu.x, top: ctxMenu.y,
                zIndex: 9001,
                width: 160,
                borderRadius: 12,
                overflow: 'hidden',
                background: 'linear-gradient(160deg, rgba(255,255,255,0.96) 0%, rgba(245,245,248,0.94) 100%)',
                boxShadow: '0 0 0 0.5px rgba(255,255,255,0.9), 0 12px 36px rgba(0,0,0,0.18), 0 3px 10px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,1)',
                border: '0.5px solid rgba(180,180,190,0.35)',
                animation: 'ctxIn 0.22s cubic-bezier(0.34,1.36,0.64,1)',
                transformOrigin: 'top left',
              }}>
                {/* Specular sweep */}
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
                  background: 'linear-gradient(140deg, rgba(255,255,255,0.6) 0%, transparent 45%)' }} />

                {/* Rename */}
                <div onClick={() => { setRenameId(ctxMenu.id); setRenameVal(ctxMenu.query); setCtxMenu(null) }}
                  style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', padding: '11px 14px', cursor: 'pointer', gap: 8,
                    fontFamily: '-apple-system,BlinkMacSystemFont,system-ui,sans-serif',
                    fontSize: 14, fontWeight: 400, color: '#1C1C1E' }}
                  onPointerDown={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.07)')}
                  onPointerUp={e => (e.currentTarget.style.background = '')}
                  onPointerLeave={e => (e.currentTarget.style.background = '')}>
                  <span>Rename</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(60,60,67,0.6)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </div>

                <div style={{ height: '0.5px', background: 'rgba(60,60,67,0.15)', position: 'relative', zIndex: 1 }} />

                {/* Delete */}
                <div onClick={() => { deleteHistoryEntry(ctxMenu.id); setCtxMenu(null) }}
                  style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', padding: '11px 14px', cursor: 'pointer', gap: 8,
                    fontFamily: '-apple-system,BlinkMacSystemFont,system-ui,sans-serif',
                    fontSize: 14, fontWeight: 400, color: '#FF3B30' }}
                  onPointerDown={e => (e.currentTarget.style.background = 'rgba(255,59,48,0.08)')}
                  onPointerUp={e => (e.currentTarget.style.background = '')}
                  onPointerLeave={e => (e.currentTarget.style.background = '')}>
                  <span>Delete</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6M14 11v6"/>
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                  </svg>
                </div>
              </div>
            </>
          )}

          {/* ── Product sheet — liquid glass ── */}
          <div className="fr-sheet" style={isWide ? {
            // Desktop / tablet — centred landscape card, scale + fade
            height: "min(680px, 88vh)",
            transform: selectedProduct
              ? "translate(-50%, -50%) scale(1)"
              : "translate(-50%, -50%) scale(0.96)",
            opacity: selectedProduct ? 1 : 0,
            pointerEvents: selectedProduct ? "auto" : "none",
            transition: "transform .34s cubic-bezier(.32,.72,0,1), opacity .28s ease",
            willChange: "transform, opacity",
          } : {
            // Phone — slide up from bottom
            maxHeight: "92%",
            transform: selectedProduct
              ? `translateY(${isDragging ? sheetY : (sheetSnap === 'half' ? window.innerHeight * 0.44 : 0)}px)`
              : "translateY(100%)",
            transition: isDragging ? "none" : "transform .42s cubic-bezier(.32,.72,0,1)",
            willChange: "transform",
          }}>
            {selectedProduct && (
              <>
                {/* Drag handle — phone only; not needed on desktop (X button closes) */}
                {!isWide && (
                  <div ref={dragHandleRef} className="fr-drag" onPointerDown={onHandleDown} onPointerMove={onHandleMove} onPointerUp={onHandleUp} onPointerLeave={onHandleUp}>
                    <div className="fr-drag-pill" />
                  </div>
                )}

                {/* X close button — desktop only, floats in top-right corner of the sheet */}
                {isWide && (
                  <button onClick={() => setSelected(null)} aria-label="Close"
                    style={{ position: 'absolute', top: 14, right: 14, zIndex: 20,
                      width: 30, height: 30, borderRadius: '50%', border: 'none', cursor: 'pointer',
                      background: 'rgba(44,18,6,.07)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'background .15s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(44,18,6,.14)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(44,18,6,.07)')}>
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                      <path d="M1 1l10 10M11 1L1 11" stroke={INK} strokeWidth="1.6" strokeLinecap="round"/>
                    </svg>
                  </button>
                )}

                {isWide ? (
                  /* ── Desktop / tablet: image left + details right ── */
                  <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

                    {/* Left — full-height image, swipeable carousel */}
                    <div style={{ width: '48%', flexShrink: 0, position: 'relative', overflow: 'hidden', borderRadius: '28px 0 0 28px', background: '#ede8e3' }}
                      onPointerDown={sheetImages.length > 1 ? onImgDown : undefined}
                      onPointerMove={sheetImages.length > 1 ? (e => onImgMove(e, sheetImages.length)) : undefined}
                      onPointerUp={sheetImages.length > 1 ? (() => onImgUp(sheetImages.length)) : undefined}
                      onPointerCancel={sheetImages.length > 1 ? (() => onImgUp(sheetImages.length)) : undefined}
                    >
                      <div style={{ display: 'flex', height: '100%', transition: (imgActive.current && imgLockH.current) ? 'none' : 'transform .32s cubic-bezier(.32,.72,0,1)', transform: `translateX(calc(-${activeImg * 100}% + ${imgDX}px))` }}>
                        {sheetImages.length > 0 ? sheetImages.map((img, i) => (
                          <div key={i} style={{ width: '100%', height: '100%', flexShrink: 0 }}>
                            <img src={img} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', userSelect: 'none', pointerEvents: 'none' }} />
                          </div>
                        )) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={INK3} strokeWidth="1.4" opacity=".4"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </div>
                        )}
                      </div>
                      {sheetImages.length > 1 && (
                        <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6 }}>
                          {sheetImages.map((_, i) => (
                            <div key={i} onClick={e => { e.stopPropagation(); setActiveImg(i) }}
                              style={{ width: 7, height: 7, borderRadius: '50%', cursor: 'pointer', transition: 'background .18s',
                                background: i === activeImg ? '#fff' : 'rgba(255,255,255,.5)',
                                boxShadow: '0 1px 4px rgba(0,0,0,.35)',
                              }} />
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Right — scrollable product details */}
                    <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none' as const, display: 'flex', flexDirection: 'column', paddingBottom: 28 }}>

                      {/* Title + save + price */}
                      <div style={{ padding: '26px 24px 0' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                          <h2 style={{ fontFamily: SANS, fontSize: 14, fontWeight: 500, color: INK, lineHeight: 1.3, letterSpacing: '.06em', textTransform: 'uppercase', flex: 1 }}>
                            {selectedProduct.title}
                          </h2>
                          <button onClick={() => toggleSaved(selectedProduct)} aria-label="Save"
                            style={{ background: 'transparent', border: 'none', padding: 2, cursor: 'pointer', flexShrink: 0, marginTop: 1 }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill={savedIds.has(selectedProduct.id) ? INK : 'none'} stroke={INK} strokeWidth="1.5">
                              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                            </svg>
                          </button>
                        </div>
                        <p style={{ fontFamily: SANS, fontSize: 18, color: INK, fontWeight: 700, marginTop: 10 }}>
                          {formatMoney(selectedProduct.price, selectedProduct.currency, selectedProduct.base_currency, rates)}
                        </p>
                        <p style={{ fontFamily: SANS, fontSize: 11, color: INK3, marginTop: 3, fontWeight: 300 }}>Inclusive of all taxes</p>
                      </div>

                      {sheetColors.length > 0 && (
                        <div style={{ padding: '18px 24px 0' }}>
                          <p style={{ fontFamily: SANS, fontSize: 12, marginBottom: 10, letterSpacing: '.02em' }}>
                            <span style={{ color: INK3 }}>Colour: </span><span style={{ color: INK }}>{effectiveColor}</span>
                          </p>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {sheetColors.map(c => {
                              const on = effectiveColor === c
                              const avail = colorAvail[c] !== false
                              return (
                                <button key={c} disabled={!avail} onClick={() => avail && setColor(c)}
                                  style={{ fontFamily: SANS, fontSize: 12, color: !avail ? INK3 : on ? INK : INK3,
                                    background: '#fff', border: `1px solid ${on ? INK : BRD}`, padding: '8px 14px',
                                    cursor: avail ? 'pointer' : 'not-allowed', opacity: avail ? 1 : 0.38,
                                    textDecoration: avail ? 'none' : 'line-through', transition: 'border-color .15s' }}>
                                  {c}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      <div style={{ padding: '16px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: SANS, fontSize: 12, color: INK2 }}>
                          <span style={{ width: 7, height: 7, background: selectedProduct.in_stock ? '#3d5c3a' : '#c0392b', display: 'inline-block' }} />
                          {selectedProduct.in_stock ? 'In stock' : 'Out of stock'}
                        </span>
                      </div>

                      {sheetSizes.length > 0 && (
                        <div style={{ padding: '14px 24px 0' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(sheetSizes.length, 6)},1fr)` }}>
                            {sheetSizes.map((s, i) => {
                              const avail = sizeAvail[s] !== false
                              const on = selectedSize === s
                              return (
                                <button key={s} disabled={!avail} onClick={() => avail && setSize(on ? null : s)}
                                  className={`fr-szbox${on ? ' on' : ''}${avail ? '' : ' dis'}`}
                                  style={{ marginLeft: i % 6 === 0 ? 0 : -1 }}>
                                  {s}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      <div style={{ padding: '16px 24px 0' }}>
                        <a href={sheetSizes.length > 0 && !selectedSize ? undefined : checkoutUrl}
                          target="_blank" rel="noopener noreferrer"
                          className={`fr-add${sheetSizes.length > 0 && !selectedSize ? ' warn' : ''}`}
                          onClick={sheetSizes.length > 0 && !selectedSize ? e => e.preventDefault() : undefined}>
                          {sheetSizes.length > 0 && !selectedSize ? 'Select a size' : 'Checkout'}
                        </a>
                      </div>

                      <div style={{ padding: '14px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontFamily: SANS, fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: INK3 }}>
                          From: {sheetBrandName}
                        </span>
                        <a href={selectedProduct.store_url} target="_blank" rel="noopener noreferrer"
                          style={{ fontFamily: SANS, fontSize: 11, fontWeight: 500, letterSpacing: '.06em', textTransform: 'uppercase', color: INK, textDecoration: 'underline', textUnderlineOffset: 3 }}>
                          Visit store
                        </a>
                      </div>

                      <div key={selectedProduct.id} style={{ padding: '16px 24px 0' }}>
                        {(sheetDescHtml || sheetDesc) && (
                          <Accordion label="Description & Fit" defaultOpen>
                            {sheetDescHtml ? (
                              <div className="fr-html" dangerouslySetInnerHTML={{ __html: sheetDescHtml }} />
                            ) : (
                              <p style={{ fontFamily: SANS, fontSize: 13, color: INK2, lineHeight: 1.7, fontWeight: 300, whiteSpace: 'pre-line' }}>{sheetDesc}</p>
                            )}
                          </Accordion>
                        )}
                        {sheetSizeTable && (
                          <Accordion label="Size Guide">
                            <p style={{ fontFamily: SANS, fontSize: 11, color: INK3, marginBottom: 12, letterSpacing: '.03em' }}>Measurements may vary slightly. When in doubt, size up.</p>
                            <div className="fr-size-wrap fr-html" dangerouslySetInnerHTML={{ __html: sheetSizeTable }} />
                          </Accordion>
                        )}
                        {(sheetMaterial || sheetCareTags.length > 0) && (
                          <Accordion label="Materials & Care">
                            {sheetMaterial && (
                              <p style={{ fontFamily: SANS, fontSize: 13, color: INK2, lineHeight: 1.7, fontWeight: 300, marginBottom: sheetCareTags.length > 0 ? 12 : 0 }}>
                                {sheetMaterial}
                              </p>
                            )}
                            {sheetCareTags.length > 0 && (
                              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
                                {sheetCareTags.map((tag, i) => (
                                  <li key={i} style={{ fontFamily: SANS, fontSize: 12.5, color: INK2, display: 'flex', alignItems: 'flex-start', gap: 9, fontWeight: 300, lineHeight: 1.5 }}>
                                    <div style={{ width: 3, height: 3, borderRadius: '50%', background: INK3, flexShrink: 0, marginTop: 6 }} />
                                    {tag}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </Accordion>
                        )}
                        {sheetDetailTags.length > 0 && (
                          <Accordion label="Product Details">
                            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
                              {sheetDetailTags.slice(0, 12).map((tag, i) => (
                                <li key={i} style={{ fontFamily: SANS, fontSize: 12.5, color: INK2, display: 'flex', alignItems: 'flex-start', gap: 9, fontWeight: 300, lineHeight: 1.5 }}>
                                  <div style={{ width: 3, height: 3, borderRadius: '50%', background: INK3, flexShrink: 0, marginTop: 6 }} />
                                  {tag}
                                </li>
                              ))}
                            </ul>
                          </Accordion>
                        )}
                        <Accordion label="Delivery & Returns">
                          <p style={{ fontFamily: SANS, fontSize: 13, color: INK2, lineHeight: 1.7, fontWeight: 300 }}>
                            Shipping, payment and returns are handled directly by {sheetBrandName || 'the store'}. Delivery times and return windows vary — see their policies at checkout.
                          </p>
                        </Accordion>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* ── Phone: original stacked layout ── */
                  <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none", paddingBottom: 24 }}>
                    <div>
                      <div style={{ position: "relative", overflow: "hidden", touchAction: "pan-y" }}
                        onPointerDown={sheetImages.length > 1 ? onImgDown : undefined}
                        onPointerMove={sheetImages.length > 1 ? (e => onImgMove(e, sheetImages.length)) : undefined}
                        onPointerUp={sheetImages.length > 1 ? (() => onImgUp(sheetImages.length)) : undefined}
                        onPointerCancel={sheetImages.length > 1 ? (() => onImgUp(sheetImages.length)) : undefined}
                      >
                        <div style={{ display: "flex", transition: (imgActive.current && imgLockH.current) ? "none" : "transform .32s cubic-bezier(.32,.72,0,1)", transform: `translateX(calc(-${activeImg * 100}% + ${imgDX}px))` }}>
                          {sheetImages.length > 0 ? sheetImages.map((img, i) => (
                            <div key={i} style={{ width: "100%", flexShrink: 0 }}>
                              <img src={img} alt="" draggable={false} style={{ width: "100%", aspectRatio: "4/5", objectFit: "cover", display: "block", userSelect: "none", pointerEvents: "none" }} />
                            </div>
                          )) : (
                            <div style={{ width: "100%", aspectRatio: "4/5", background: "#ebebeb", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={INK3} strokeWidth="1.4" opacity=".4"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            </div>
                          )}
                        </div>
                        {sheetImages.length > 1 && (
                          <div style={{ position: "absolute", bottom: 12, left: 12, display: "flex", gap: 5 }}>
                            {sheetImages.map((_, i) => (
                              <div key={i} onClick={e => { e.stopPropagation(); setActiveImg(i) }}
                                style={{
                                  width: 9, height: 9, cursor: "pointer", transition: "background .18s",
                                  background: i === activeImg ? "#1A1A1A" : "rgba(255,255,255,.55)",
                                  border: i === activeImg ? "1px solid #1A1A1A" : "1px solid rgba(26,26,26,.45)",
                                  boxShadow: "0 0 0 0.5px rgba(255,255,255,.35)",
                                }} />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {sheetImages.length > 1 && (
                      <div style={{ padding: "10px 16px 0", display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none" }}>
                        {sheetImages.map((img, i) => (
                          <button key={i} onClick={() => setActiveImg(i)}
                            style={{ width: 46, height: 58, overflow: "hidden", padding: 0, border: `1.5px solid ${i === activeImg ? INK : 'transparent'}`, cursor: "pointer", background: "#ebebeb", flexShrink: 0, transition: "border-color .15s" }}>
                            <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                          </button>
                        ))}
                      </div>
                    )}

                    <div style={{ padding: "18px 20px 0" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                        <h2 style={{ fontFamily: SANS, fontSize: "clamp(14px,4vw,16px)", fontWeight: 500, color: INK, lineHeight: 1.3, letterSpacing: ".01em", textTransform: "uppercase", flex: 1 }}>
                          {selectedProduct.title}
                        </h2>
                        <button onClick={() => toggleSaved(selectedProduct)} aria-label="Save"
                          style={{ background: "transparent", border: "none", padding: 2, cursor: "pointer", flexShrink: 0, marginTop: 1 }}>
                          <svg width="22" height="22" viewBox="0 0 24 24" fill={savedIds.has(selectedProduct.id) ? INK : "none"} stroke={INK} strokeWidth="1.5">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                          </svg>
                        </button>
                      </div>
                      <p style={{ fontFamily: SANS, fontSize: "clamp(15px,4vw,17px)", color: INK, fontWeight: 700, marginTop: 8 }}>
                        {formatMoney(selectedProduct.price, selectedProduct.currency, selectedProduct.base_currency, rates)}
                      </p>
                      <p style={{ fontFamily: SANS, fontSize: 11, color: INK3, marginTop: 3, fontWeight: 300 }}>Inclusive of all taxes</p>
                    </div>

                    {sheetColors.length > 0 && (
                      <div style={{ padding: "18px 20px 0" }}>
                        <p style={{ fontFamily: SANS, fontSize: 12, marginBottom: 10, letterSpacing: ".02em" }}>
                          <span style={{ color: INK3 }}>Colour: </span><span style={{ color: INK }}>{effectiveColor}</span>
                        </p>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {sheetColors.map(c => {
                            const on = effectiveColor === c
                            const avail = colorAvail[c] !== false
                            return (
                              <button key={c} disabled={!avail} onClick={() => avail && setColor(c)}
                                style={{ fontFamily: SANS, fontSize: 12,
                                  color: !avail ? INK3 : on ? INK : INK3,
                                  background: "#fff",
                                  border: `1px solid ${on ? INK : BRD}`,
                                  padding: "9px 14px",
                                  cursor: avail ? "pointer" : "not-allowed",
                                  opacity: avail ? 1 : 0.38,
                                  textDecoration: avail ? "none" : "line-through",
                                  transition: "border-color .15s" }}>
                                {c}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    <div style={{ padding: "18px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 7, fontFamily: SANS, fontSize: 12, color: INK2 }}>
                        <span style={{ width: 7, height: 7, background: selectedProduct.in_stock ? "#3d5c3a" : "#c0392b", display: "inline-block" }} />
                        {selectedProduct.in_stock ? "In stock" : "Out of stock"}
                      </span>
                      {similarItems.length > 0 && (
                        <button onClick={() => similarRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                          style={{ fontFamily: SANS, fontSize: 11, fontWeight: 500, letterSpacing: ".06em", textTransform: "uppercase", color: INK, background: "transparent", border: "none", textDecoration: "underline", textUnderlineOffset: 3, cursor: "pointer" }}>
                          View similar
                        </button>
                      )}
                    </div>

                    {sheetSizes.length > 0 && (
                      <div style={{ padding: "14px 20px 0" }}>
                        <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(sheetSizes.length, 6)},1fr)` }}>
                          {sheetSizes.map((s, i) => {
                            const avail = sizeAvail[s] !== false
                            const on = selectedSize === s
                            return (
                              <button key={s} disabled={!avail} onClick={() => avail && setSize(on ? null : s)}
                                className={`fr-szbox${on ? " on" : ""}${avail ? "" : " dis"}`}
                                style={{ marginLeft: i % 6 === 0 ? 0 : -1 }}>
                                {s}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    <div style={{ padding: "16px 20px 0" }}>
                      <a href={sheetSizes.length > 0 && !selectedSize ? undefined : checkoutUrl}
                        target="_blank" rel="noopener noreferrer"
                        className={`fr-add${sheetSizes.length > 0 && !selectedSize ? " warn" : ""}`}
                        onClick={sheetSizes.length > 0 && !selectedSize ? e => e.preventDefault() : undefined}>
                        {sheetSizes.length > 0 && !selectedSize ? "Select a size" : "Checkout"}
                      </a>
                    </div>

                    <div style={{ padding: "16px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontFamily: SANS, fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", color: INK3 }}>
                        From: {sheetBrandName}
                      </span>
                      <a href={selectedProduct.store_url} target="_blank" rel="noopener noreferrer"
                        style={{ fontFamily: SANS, fontSize: 11, fontWeight: 500, letterSpacing: ".06em", textTransform: "uppercase", color: INK, textDecoration: "underline", textUnderlineOffset: 3 }}>
                        Visit store
                      </a>
                    </div>

                    <div key={selectedProduct.id} style={{ padding: "22px 20px 0" }}>
                      {(sheetDescHtml || sheetDesc) && (
                        <Accordion label="Description & Fit" defaultOpen>
                          {sheetDescHtml ? (
                            <div className="fr-html" dangerouslySetInnerHTML={{ __html: sheetDescHtml }} />
                          ) : (
                            <p style={{ fontFamily: SANS, fontSize: 13, color: INK2, lineHeight: 1.7, fontWeight: 300, whiteSpace: "pre-line" }}>{sheetDesc}</p>
                          )}
                        </Accordion>
                      )}
                      {sheetSizeTable && (
                        <Accordion label="Size Guide">
                          <p style={{ fontFamily: SANS, fontSize: 11, color: INK3, marginBottom: 12, letterSpacing: ".03em" }}>Measurements may vary slightly. When in doubt, size up.</p>
                          <div className="fr-size-wrap fr-html" dangerouslySetInnerHTML={{ __html: sheetSizeTable }} />
                        </Accordion>
                      )}
                      {(sheetMaterial || sheetCareTags.length > 0) && (
                        <Accordion label="Materials & Care">
                          {sheetMaterial && (
                            <p style={{ fontFamily: SANS, fontSize: 13, color: INK2, lineHeight: 1.7, fontWeight: 300, marginBottom: sheetCareTags.length > 0 ? 12 : 0 }}>
                              {sheetMaterial}
                            </p>
                          )}
                          {sheetCareTags.length > 0 && (
                            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 7 }}>
                              {sheetCareTags.map((tag, i) => (
                                <li key={i} style={{ fontFamily: SANS, fontSize: 12.5, color: INK2, display: "flex", alignItems: "flex-start", gap: 9, fontWeight: 300, lineHeight: 1.5 }}>
                                  <div style={{ width: 3, height: 3, borderRadius: "50%", background: INK3, flexShrink: 0, marginTop: 6 }} />
                                  {tag}
                                </li>
                              ))}
                            </ul>
                          )}
                        </Accordion>
                      )}
                      {sheetDetailTags.length > 0 && (
                        <Accordion label="Product Details">
                          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 7 }}>
                            {sheetDetailTags.slice(0, 12).map((tag, i) => (
                              <li key={i} style={{ fontFamily: SANS, fontSize: 12.5, color: INK2, display: "flex", alignItems: "flex-start", gap: 9, fontWeight: 300, lineHeight: 1.5 }}>
                                <div style={{ width: 3, height: 3, borderRadius: "50%", background: INK3, flexShrink: 0, marginTop: 6 }} />
                                {tag}
                              </li>
                            ))}
                          </ul>
                        </Accordion>
                      )}
                      <Accordion label="Delivery & Returns">
                        <p style={{ fontFamily: SANS, fontSize: 13, color: INK2, lineHeight: 1.7, fontWeight: 300 }}>
                          Shipping, payment and returns are handled directly by {sheetBrandName || "the store"}. Delivery times and return windows vary — see their policies at checkout.
                        </p>
                      </Accordion>
                    </div>

                    {similarItems.length > 0 && (
                      <div ref={similarRef} style={{ padding: "26px 0 0" }}>
                        <div style={{ padding: "0 20px", marginBottom: 14 }}>
                          <span style={{ fontFamily: SANS, fontSize: 12, fontWeight: 600, letterSpacing: ".07em", textTransform: "uppercase", color: INK }}>Similar items</span>
                        </div>
                        <div style={{ display: "flex", gap: 10, overflowX: "auto", scrollbarWidth: "none", padding: "0 20px 4px" }}>
                          {similarItems.map(p => (
                            <button key={p.id} onClick={() => setSelected(p)}
                              style={{ flexShrink: 0, width: 120, background: "transparent", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}>
                              <div style={{ width: 120, aspectRatio: "3/4", overflow: "hidden", background: "#ede8e3", marginBottom: 7 }}>
                                {p.image_url && <img src={p.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />}
                              </div>
                              <div style={{ fontFamily: SANS, fontSize: 11.5, color: INK, lineHeight: 1.35, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</div>
                              <div style={{ fontFamily: SANS, fontSize: 11.5, color: INK2, fontWeight: 600, marginTop: 3 }}>{formatMoney(p.price, p.currency, p.base_currency, rates)}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div style={{ height: 28 }} />
                  </div>
                )}
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
