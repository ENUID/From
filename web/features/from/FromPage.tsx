'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useFromChat } from './hooks/useFromChat'
import { formatMoney } from '@/lib/currency'
import type { ShopperContext } from '@/lib/shopperContext'
import { ExchangeRates } from '@/lib/exchangeRates'
import type { Product } from '@/components/ProductCard'
import { BRAND_NAMES } from '@/lib/stores'
import { TAGLINES, shuffledIndices } from './taglines'

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

// Map the few .myshopify.com registry domains to their real storefront so the
// logo service can resolve them; everything else uses its own domain.
const LOGO_DOMAIN: Record<string, string> = {
  'gymsharkusa.myshopify.com': 'gymshark.com',
  'skimsbody.myshopify.com': 'skims.com',
  'bombas.myshopify.com': 'bombas.com',
  'chubbies.myshopify.com': 'chubbiesshorts.com',
  'faherty.myshopify.com': 'fahertybrand.com',
  'spanx-com.myshopify.com': 'spanx.com',
  'slvrlake.myshopify.com': 'slvrlake-denim.com',
  'hommeyusa.myshopify.com': 'gethommey.com.au',
  'senso.myshopify.com': 'senso.com.au',
  'jeffs.myshopify.com': 'studiojeffs.com',
  'asos.myshopify.com': 'asos.com',
}
function logoDomain(domain: string): string {
  return LOGO_DOMAIN[domain] || domain
}

// Brand logo with a graceful typographic monogram fallback.
function BrandLogo({ domain, name, size = 44 }: { domain: string; name: string; size?: number }) {
  const [failed, setFailed] = useState(false)
  const initial = (name.replace(/[^A-Za-z0-9]/g, '').charAt(0) || '?').toUpperCase()
  if (failed) {
    return (
      <div style={{ width: size, height: size, borderRadius: '50%', background: '#F2EDE9',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        fontFamily: SERIF, fontSize: size * 0.46, fontWeight: 500, color: '#2C1206' }}>
        {initial}
      </div>
    )
  }
  return (
    <img src={`https://logo.clearbit.com/${logoDomain(domain)}`} alt="" loading="lazy"
      onError={() => setFailed(true)}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'contain',
        background: '#fff', border: '1px solid rgba(44,18,6,0.08)', flexShrink: 0 }} />
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

const SIZE_TABLE_KWS = /\b(size|chest|waist|hip|inseam|sleeve|shoulder|length|neck|bust|height|weight|measurements?|XS|XL|XXL)\b/i

// ── Unit conversion ───────────────────────────────────────────────────────────
const FRAC_TO_DEC: Record<string, number> = {
  '½': 0.5, '¼': 0.25, '¾': 0.75,
  '⅓': 0.333, '⅔': 0.667,
  '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
}

function parseMeasNum(s: string): number {
  const lastChar = s.slice(-1)
  const frac = FRAC_TO_DEC[lastChar] ?? 0
  const base = parseFloat(frac > 0 ? s.slice(0, -1) : s)
  return isNaN(base) ? NaN : base + frac
}

function fmtConverted(n: number, toUnit: 'in' | 'cm'): string {
  if (toUnit === 'cm') return Math.round(n).toString()
  const rounded = Math.round(n * 2) / 2
  const whole = Math.floor(rounded)
  return rounded === whole ? String(whole) : `${whole}½`
}

function convertMeasurement(v: string, fromUnit: 'in' | 'cm' | '', toUnit: 'in' | 'cm'): string {
  if (!fromUnit || fromUnit === toUnit || !v || v === '—') return v
  const factor = fromUnit === 'in' ? 2.54 : 1 / 2.54
  if (v.includes('×')) {
    return v.replace(/\d+(?:[.,]\d+)?(?:[½¼¾⅓⅔⅛⅜⅝⅞])?/g, m => {
      const n = parseMeasNum(m); return isNaN(n) ? m : fmtConverted(n * factor, toUnit)
    })
  }
  const rng = v.match(/^(\d[\d½¼¾⅓⅔⅛⅜⅝⅞]*)\s*[-–]\s*(\d[\d½¼¾⅓⅔⅛⅜⅝⅞]*)$/)
  if (rng) {
    const a = parseMeasNum(rng[1]), b = parseMeasNum(rng[2])
    if (!isNaN(a) && !isNaN(b)) return `${fmtConverted(a * factor, toUnit)}–${fmtConverted(b * factor, toUnit)}`
  }
  const n = parseMeasNum(v)
  return isNaN(n) ? v : fmtConverted(n * factor, toUnit)
}

// ── International size reference data ────────────────────────────────────────
const INTL_W_HDR = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
const INTL_W: { sys: string; vals: string[] }[] = [
  { sys: 'US',    vals: ['0–2',  '4–6',  '8–10', '12–14', '16',  '18–20'] },
  { sys: 'UK',    vals: ['4–6',  '8–10', '12–14','16–18', '20',  '22–24'] },
  { sys: 'EU',    vals: ['32–34','36–38','40–42', '44–46', '48',  '50–52'] },
  { sys: 'IT',    vals: ['36–38','40–42','44–46', '48–50', '52',  '54–56'] },
  { sys: 'AU/NZ', vals: ['6–8',  '10–12','14–16', '18–20', '22',  '24–26'] },
  { sys: 'JP',    vals: ['5–7',  '9–11', '13–15', '17–19', '21',  '23–25'] },
]
const INTL_M_HDR = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL']
const INTL_M: { sys: string; vals: string[] }[] = [
  { sys: 'EU/IT', vals: ['44',  '46',  '48–50', '52', '54–56', '58', '60'] },
  { sys: 'UK',    vals: ['34',  '36',  '38–40', '42', '44–46', '48', '50'] },
  { sys: 'JP',    vals: ['S',   'M',   'L',     'LL', '3L',    '4L', '5L'] },
]

function extractSizeTables(html: string): string | null {
  const found: string[] = []
  // HTML tables with size keywords
  const tableRe = /<table[\s\S]*?<\/table>/gi
  let m: RegExpExecArray | null
  while ((m = tableRe.exec(html)) !== null) {
    if (SIZE_TABLE_KWS.test(m[0])) found.push(m[0])
  }
  if (found.length) return found.join('')

  // Images whose src/alt suggests a size chart (common: brand embeds a chart image in description)
  const imgRe = /<img[^>]+>/gi
  while ((m = imgRe.exec(html)) !== null) {
    const tag = m[0]
    if (/size.?chart|size.?guide|sizing|measurement/i.test(tag) && /src=/i.test(tag)) {
      const srcMatch = tag.match(/src=["']([^"']+)["']/i)
      if (srcMatch && !srcMatch[1].startsWith('data:')) {
        found.push(tag.replace(/<img/, '<img style="max-width:100%;height:auto;display:block"'))
      }
    }
  }
  return found.length ? `<div>${found.join('')}</div>` : null
}

function stripSizeTables(html: string): string {
  return html
    .replace(/<table[\s\S]*?<\/table>/gi, t => SIZE_TABLE_KWS.test(t) ? '' : t)
    // Also strip size chart images already shown in the size guide section
    .replace(/<img[^>]+>/gi, tag => /size.?chart|size.?guide|sizing|measurement/i.test(tag) ? '' : tag)
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

// ── Internal Shopify tag patterns — never shown to shoppers ──────────────────
const INTERNAL_TAG_RE = /^(akeneo|categorybatch|online.?pos|offline.?pos|price_|tt_|fb_|ig_|ggl_|_label_|all.?product|new.?arrival|build.?your|bundl|wishlist|oos_|featured_|pf_)/i
const INTERNAL_TAG_EXACT = new Set([
  'online-pos', 'offline-pos', 'all-products', 'new-arrivals', 'sale', 'clearance',
  'build-your-wishlist', 'featured', 'trending', 'bundle', 'bundleable',
  'all', 'new',
])
const HEX_IN_TAG   = /#[0-9a-fA-F]{3,8}/
const TIMESTAMP_IN_TAG = /\b\d{9,10}\b/

function isInternalTag(t: string): boolean {
  if (HEX_IN_TAG.test(t)) return true
  if (TIMESTAMP_IN_TAG.test(t)) return true
  if (INTERNAL_TAG_RE.test(t)) return true
  if (INTERNAL_TAG_EXACT.has(t.toLowerCase())) return true
  // colon-value tags where value is purely numeric (akeneo_updated_at:1746219500)
  if (/:\d+$/.test(t)) return true
  // long hyphenated/underscored machine codes (4+ segments, 20+ chars)
  if (/^[a-z0-9_-]+$/.test(t) && t.split(/[-_]/).length > 3 && t.length > 20) return true
  return false
}

function humanizeTagValue(t: string): string {
  // "key:value" format — extract the value
  if (t.includes(':') && !t.startsWith('http')) {
    const value = t.split(':').slice(1).join(':').trim()
    if (!value || /^\d+$/.test(value)) return ''  // skip bare numbers
    return value.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }
  // kebab-case / snake_case → Title Case
  return t.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim()
}

function extractCareTags(p: Product): string[] {
  return (p.tags || [])
    .filter(t => CARE_KW.test(t))
    .map(t => {
      const raw = t.split('=>').pop()?.trim() || t
      return humanizeTagValue(raw)
    })
    .filter(Boolean)
}

function extractDetailTags(p: Product): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const t of (p.tags || [])) {
    if (!t || t.length < 2 || t.length > 100) continue
    if (MATERIAL_KW.test(t) || CARE_KW.test(t)) continue
    if (t.includes('=>')) continue
    if (isInternalTag(t)) continue
    const display = humanizeTagValue(t)
    if (!display || display.length < 2) continue
    const key = display.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(display)
  }
  return result
}
// Normalize verbose size names → standard abbreviations for display only.
// Internal state / variant matching always uses the raw Shopify value.
const SIZE_ABBREV: Record<string, string> = {
  'extra small':                           'XS',
  'x-small':                               'XS',
  'x small':                               'XS',
  'small':                                 'S',
  'medium':                                'M',
  'large':                                 'L',
  'extra large':                           'XL',
  'x-large':                               'XL',
  'x large':                               'XL',
  'extra extra large':                     'XXL',
  'double extra large':                    'XXL',
  'xx-large':                              'XXL',
  'xx large':                              'XXL',
  '2x-large':                              'XXL',
  'extra extra extra large':               'XXXL',
  'triple extra large':                    'XXXL',
  'xxx-large':                             'XXXL',
  'xxx large':                             'XXXL',
  '3x-large':                              'XXXL',
  'extra extra extra extra large':         '4XL',
  'xxxx-large':                            '4XL',
  '4x-large':                              '4XL',
  'extra extra extra extra extra large':   '5XL',
  'xxxxx-large':                           '5XL',
  '5x-large':                              '5XL',
  '6x-large':                              '6XL',
  'extra extra extra extra extra extra large': '6XL',
}
function normalizeSizeLabel(raw: string): string {
  return SIZE_ABBREV[raw.toLowerCase().trim()] ?? raw
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
// ── Size guide parsing ────────────────────────────────────────────────────────
type SizeRow   = { label: string; values: string[] }
type SizeTable = { label: string; headers: string[]; rows: SizeRow[]; unit: 'in' | 'cm' | '' }

function sgStripTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim()
}

// Recognises standard garment size labels including composite forms:
// "S", "XL", "S (0-4)", "M/L", "S/M (0-6)", "XXL", "1X", "38", etc.
const SG_SIZE_CORE = /^(XXS|XS|S|M|L|XL|XXL|XXXL|XXXXL|4XL|5XL|6XL|1X|2X|3X|4X|\d{1,3}|One ?Size|OS|OSFA)/i
function isSizeLike(s: string): boolean {
  const clean = s.trim()
  // Must START with a known size token; optional suffix like "/M", " (0-4)", " - XL"
  if (!SG_SIZE_CORE.test(clean)) return false
  // Must not be a plain measurement word like "Natural Waist", "Low Hip", etc.
  if (/waist|chest|bust|hip|inseam|sleeve|shoulder|neck|length|height|weight/i.test(clean)) return false
  return true
}

// Flip a table so sizes become column headers and measurements become row labels.
// Input:  headers=["NECK","CHEST","WAIST"], rows=[{label:"XS", values:[…]}, …]
// Output: headers=["XS","S","M",…],         rows=[{label:"NECK", values:[…]}, …]
function transposeTable(t: { headers: string[]; rows: SizeRow[] }): { headers: string[]; rows: SizeRow[] } {
  return {
    headers: t.rows.map(r => r.label),
    rows: t.headers.map((h, hi) => ({
      label: h,
      values: t.rows.map(r => r.values[hi] ?? ''),
    })),
  }
}

// Infer a human-readable section label from measurement names in the table.
function inferTableLabel(measurementLabels: string[]): string {
  const txt = measurementLabels.join(' ').toLowerCase()
  const hasInseam  = /inseam|leg\b|rise\b/.test(txt)
  const hasBust    = /bust|chest/.test(txt)
  const hasSleeve  = /sleeve/.test(txt)
  const hasHip     = /\bhip\b/.test(txt)
  const hasWaist   = /waist/.test(txt)
  if (hasInseam)               return 'Bottoms'
  if (hasSleeve || hasBust)    return 'Tops'
  if (hasHip && hasWaist && !hasBust) return 'Bottoms'
  if (hasHip && !hasBust)      return 'Bottoms'
  return ''
}

// Strip noisy prefixes like "Measurements for", "*All sizes are approximate"
function cleanSectionLabel(raw: string): string {
  return raw
    .replace(/^\*?\s*measurements?\s+(?:for\s+)?/i, '')
    .replace(/^\*?\s*all\s+sizes\s+are\s+approximate\s*/i, '')
    .replace(/\*.*$/, '')  // remove trailing asterisk notes
    .trim()
}

// Extract the last meaningful title/heading from the HTML preceding a <table>.
// Handles any gap (paragraphs, disclaimers) between the heading and the table.
function extractSectionLabel(prev: string): string {
  // 1. Heading tags: h1-h6, caption — most semantic, search whole chunk
  const hMatches = Array.from(prev.matchAll(/<(?:h[1-6]|caption)[^>]*>([\s\S]*?)<\/(?:h[1-6]|caption)>/gi))
  if (hMatches.length > 0) {
    const text = cleanSectionLabel(sgStripTags(hMatches[hMatches.length - 1][1]))
    if (text.length >= 2 && text.length <= 80) return text
  }
  // 2. strong / b tags
  const sMatches = Array.from(prev.matchAll(/<(?:strong|b)[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi))
  for (let j = sMatches.length - 1; j >= 0; j--) {
    const text = cleanSectionLabel(sgStripTags(sMatches[j][1]))
    if (text.length >= 2 && text.length <= 80 && /[A-Za-z]/.test(text)) return text
  }
  // 3. p / div tags that look like short titles (not measurement disclaimers)
  const pMatches = Array.from(prev.matchAll(/<(?:p|div)[^>]*>([\s\S]*?)<\/(?:p|div)>/gi))
  for (let j = pMatches.length - 1; j >= 0; j--) {
    const text = cleanSectionLabel(sgStripTags(pMatches[j][1]))
    if (text.length >= 3 && text.length <= 60 && /^[A-Z]/.test(text) &&
        !/approximate|disclaimer|note\b|inch|cm\b/i.test(text)) return text
  }
  return ''
}

function parseOneTable(tableHtml: string): { headers: string[]; rows: SizeRow[] } | null {
  const rawRows: string[][] = []
  const trRe = /<tr(?:\s[^>]*)?>[\s\S]*?<\/tr>/gi
  let trM: RegExpExecArray | null
  while ((trM = trRe.exec(tableHtml)) !== null) {
    const cells: string[] = []
    const tdRe = /<(?:th|td)(?:\s[^>]*)?>[\s\S]*?<\/(?:th|td)>/gi
    let tdM: RegExpExecArray | null
    while ((tdM = tdRe.exec(trM[0])) !== null) {
      const inner = tdM[0].replace(/^<(?:th|td)[^>]*>/, '').replace(/<\/(?:th|td)>$/, '')
      cells.push(sgStripTags(inner))
    }
    if (cells.length > 1) rawRows.push(cells)
  }
  if (rawRows.length < 2) return null
  const headers = rawRows[0].slice(1).filter(h => h.length > 0)
  if (!headers.length) return null
  const rows = rawRows.slice(1)
    .map(r => ({ label: r[0] ?? '', values: r.slice(1, headers.length + 1) }))
    .filter(r => r.label.trim() && r.values.some(v => v.trim()))
  return rows.length ? { headers, rows } : null
}

function parseSizeGuideHtml(html: string): SizeTable[] {
  const tables: SizeTable[] = []
  const sections = html.split(/<table(?:\s[^>]*)?>/)
  for (let i = 1; i < sections.length; i++) {
    const tableHtml = '<table>' + sections[i].split('</table>')[0] + '</table>'
    if (!SIZE_TABLE_KWS.test(tableHtml)) continue
    const parsed = parseOneTable(tableHtml)
    if (!parsed) continue

    // Find the last meaningful heading anywhere in the preceding HTML chunk
    const label = extractSectionLabel(sections[i - 1])

    // Auto-orient: if majority of row labels are size names (XS, S, M…),
    // the table is stored sizes-as-rows — transpose so sizes become columns.
    const sizeLikeCount = parsed.rows.filter(r => isSizeLike(r.label)).length
    const tbl = sizeLikeCount > parsed.rows.length / 2 ? transposeTable(parsed) : parsed

    // If heading extraction found nothing, infer from measurement names in the table
    const finalLabel = label || inferTableLabel(tbl.rows.map(r => r.label))

    tables.push(normalizeTable({ label: finalLabel, ...tbl, unit: '' }))
  }
  return tables
}

// Split headers into groups of 3 for the range selector buttons
function chunkHeaders(headers: string[], size = 3): string[][] {
  const chunks: string[][] = []
  for (let i = 0; i < headers.length; i += size) chunks.push(headers.slice(i, i + size))
  return chunks
}

// ── Size-table normalization ────────────────────────────────────────────────

// Title-case a measurement row label; preserve size abbreviations (XS, S/M…)
function titleCaseLabel(s: string): string {
  if (!s) return s
  if (isSizeLike(s.trim())) return s.trim().toUpperCase()
  return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

// Detect a unit mentioned anywhere in a string
function detectUnit(s: string): 'in' | 'cm' | '' {
  if (/\bcm\b/i.test(s)) return 'cm'
  if (/\binch(es)?\b|^\s*in\s*$|"/i.test(s)) return 'in'
  return ''
}

// Strip unit annotation from a column header; return clean text + detected unit
function cleanHeader(h: string): { clean: string; unit: 'in' | 'cm' | '' } {
  const unit = detectUnit(h)
  const clean = h
    .replace(/\s*[\(\[]\s*in\s+cm\s*[\)\]]/gi, '')
    .replace(/\s*[\(\[]\s*centimetres?\s*[\)\]]/gi, '')
    .replace(/\s*[\(\[]\s*cm\s*[\)\]]/gi, '')
    .replace(/\s*[\(\[]\s*in\s+inch(es)?\s*[\)\]]/gi, '')
    .replace(/\s*[\(\[]\s*inch(es)?\s*[\)\]]/gi, '')
    .replace(/\s*[\(\[]\s*"\s*[\)\]]/gi, '')
    .replace(/\s*-\s*cm$/i, '').replace(/\s*\(cm\)$/i, '')
    .replace(/\s*-\s*in$/i, '').replace(/\s*\(in\)$/i, '')
    .trim()
  return { clean: clean || h.trim(), unit }
}

// Format cell values: replace "x" dimension separator with "×"
function humanizeValue(v: string): string {
  if (!v || v === '—') return v
  return v.replace(/(\d[\d.,½¼¾⅓⅔⅛⅜⅝⅞]*)\s*[xX]\s*(\d[\d.,½¼¾⅓⅔⅛⅜⅝⅞]*)/g, '$1 × $2')
}

// Normalize a full table: clean headers, title-case labels, format values, infer unit
function normalizeTable(t: SizeTable): SizeTable {
  // 1. Strip unit suffixes from column headers and collect the unit
  let unit: 'in' | 'cm' | '' = ''
  const cleanedHeaders = t.headers.map(h => {
    const { clean, unit: u } = cleanHeader(h)
    if (u && !unit) unit = u
    return clean
  })

  // 2. Try row labels
  if (!unit) unit = detectUnit(t.rows.map(r => r.label).join(' '))

  // 3. Try cell values
  if (!unit) {
    outer: for (const row of t.rows) {
      for (const v of row.values) {
        const u = detectUnit(v)
        if (u) { unit = u; break outer }
      }
    }
  }

  // 4. Infer from value magnitudes for garment tables
  if (!unit) {
    const isGarment = t.rows.some(r =>
      /\b(chest|waist|hip|inseam|sleeve|bust|body|shoulder|neck|length)\b/i.test(r.label)
    )
    if (isGarment) {
      const nums: number[] = []
      for (const row of t.rows)
        for (const v of row.values) {
          const m = v.match(/(\d+(?:\.\d+)?)/)
          if (m) nums.push(parseFloat(m[1]))
        }
      if (nums.length > 0) {
        const avg = nums.reduce((a, b) => a + b, 0) / nums.length
        unit = avg < 70 ? 'in' : 'cm'
      }
    }
  }

  const cleanedRows = t.rows.map(row => ({
    label: titleCaseLabel(row.label),
    values: row.values.map(humanizeValue),
  }))

  return { ...t, headers: cleanedHeaders, rows: cleanedRows, unit }
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
  const [inputHint, setInputHint]       = useState<string | null>(null)
  const [fetchedSizeGuide, setFetchedSizeGuide] = useState<string | null>(null)
  const [sizeGuideLoading, setSizeGuideLoading] = useState(false)
  const [sizeGuideOpen, setSizeGuideOpen]       = useState(false)
  const [sgTableIdx, setSgTableIdx]             = useState(0)
  const [sgGroupIdx, setSgGroupIdx]             = useState(0)
  const [sgDisplayUnit, setSgDisplayUnit]       = useState<'in' | 'cm' | null>(null)
  const [sgIntlGender, setSgIntlGender]         = useState<'w' | 'm'>('w')
  const [cleanDesc, setCleanDesc]               = useState<string | null>(null)
  const [cleanDescLoading, setCleanDescLoading] = useState(false)
  const [shippingInfo, setShippingInfo]         = useState<{ shipping: string; returns: string } | null>(null)
  const [fetchedProductImages, setFetchedProductImages] = useState<string[]>([])
  const [loaded, setLoaded]             = useState(false)
  const [showExplore, setShowExplore]   = useState(false)
  const [exploreToast, setExploreToast] = useState(false)
  const [exploreToastOut, setExploreToastOut] = useState(false)
  const [exploreCache, setExploreCache] = useState<Product[]>(() => {
    try { return JSON.parse(localStorage.getItem('from:explore') || '[]') } catch { return [] }
  })
  const [logoIdx, setLogoIdx] = useState(0)
  const [ctxMenu, setCtxMenu] = useState<{ id: string; query: string; x: number; y: number; above: boolean } | null>(null)
  const [productCtxMenu, setProductCtxMenu] = useState<{ product: Product; x: number; y: number; above: boolean } | null>(null)
  const [bagCtxMenu, setBagCtxMenu] = useState<{ product: Product; x: number; y: number; above: boolean } | null>(null)
  const [brandsOpen, setBrandsOpen]     = useState(false)
  const [brandQuery, setBrandQuery]     = useState('')
  const [activeBrand, setActiveBrand]   = useState<{ name: string; domain: string } | null>(null)
  const allBrands = useMemo(() =>
    Object.entries(BRAND_NAMES)
      .map(([domain, name]) => ({ domain, name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  [])
  const filteredBrands = useMemo(() => {
    const q = brandQuery.trim().toLowerCase()
    return q ? allBrands.filter(b => b.name.toLowerCase().includes(q)) : allBrands
  }, [allBrands, brandQuery])
  const openBrand = (b: { name: string; domain: string }) => {
    setBrandsOpen(false); setBrandQuery('')
    setActiveBrand(b)
    setShowExplore(false)
    sendMessage(b.name)
    setSidebar(false)
  }
  const [renameId, setRenameId]         = useState<string | null>(null)
  const [renameVal, setRenameVal]       = useState("")
  const [isWide, setIsWide]             = useState(false)
  const [liveRates, setLiveRates]       = useState<ExchangeRates>(rates)
  const [tagText, setTagText]           = useState(TAGLINES[0])  // SSR-safe hero line; randomised client-side in effect
  const [tagVis, setTagVis]             = useState(true)
  const tagOrderRef                     = useRef<number[]>([])

  // ── Stylist sheet — conversational AI over specific product(s) ──────────────
  type StylistComparison = { rows: { label: string; values: string[] }[]; pick?: { index: number; reason: string } }
  type StylistMsg = { role: 'user' | 'assistant'; content: string; comparison?: StylistComparison }
  const [stylistOpen, setStylistOpen]       = useState(false)
  const [stylistProducts, setStylistProducts] = useState<Product[]>([])
  const [stylistMsgs, setStylistMsgs]       = useState<StylistMsg[]>([])
  const [stylistInput, setStylistInput]     = useState('')
  const [stylistLoading, setStylistLoading] = useState(false)
  const stylistScrollRef                    = useRef<HTMLDivElement>(null)
  // Products attached to the search bar — sending a query with these opens the stylist.
  const [barProducts, setBarProducts]       = useState<Product[]>([])

  const addBarProduct = (p: Product) => {
    setBarProducts(prev => (prev.some(x => x.id === p.id) || prev.length >= 4) ? prev : [...prev, p])
    setInputHint('Ask about your selection…')
    setTimeout(() => taRef.current?.focus(), 80)
  }
  const removeBarProduct = (id: string) => setBarProducts(prev => {
    const next = prev.filter(p => p.id !== id)
    if (next.length === 0) setInputHint(null)
    return next
  })
  const removeStylistProduct = (id: string) => {
    setStylistProducts(prev => prev.filter(p => p.id !== id))
  }
  const sendStylist = async (q: string, productsArg?: Product[], historyArg?: StylistMsg[]) => {
    const question = q.trim()
    const products = productsArg ?? stylistProducts
    const history  = historyArg ?? stylistMsgs
    if (!question || stylistLoading || products.length === 0) return
    setStylistInput('')
    setStylistMsgs(prev => [...prev, { role: 'user', content: question }])
    setStylistLoading(true)
    try {
      const payloadProducts = products.map(p => ({
        id: p.id, title: p.title, vendor: p.vendor, price: p.price, currency: p.currency,
        material: extractMaterial(p) || undefined,
        description: (getDescriptionText(p) || '').slice(0, 900) || undefined,
        tags: (p.tags || []).filter(t => !isInternalTag(t)).slice(0, 20),
        options: p.options,
      }))
      const res = await fetch('/api/ai/stylist', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          products: payloadProducts,
          messages: history.map(m => ({ role: m.role, content: m.content })),
          question,
          buyerCurrency: shopperContext.currency,
        }),
      })
      const data = await res.json()
      if (data?.reply) {
        setStylistMsgs(prev => [...prev, { role: 'assistant', content: data.reply, comparison: data.comparison || undefined }])
      } else {
        setStylistMsgs(prev => [...prev, { role: 'assistant', content: "I couldn't read enough detail on that one — try asking another way." }])
      }
    } catch {
      setStylistMsgs(prev => [...prev, { role: 'assistant', content: 'Something went wrong reaching the stylist. Give it another go in a moment.' }])
    } finally {
      setStylistLoading(false)
    }
  }
  // Open the stylist page with attached products and immediately ask the query.
  const openStylistWith = (products: Product[], query: string) => {
    setStylistProducts(products)
    setStylistMsgs([])
    setStylistOpen(true)
    sendStylist(query, products, [])
  }

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
  const longPressStart = useRef<{ x: number; y: number } | null>(null)
  const productLongTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const productWasLong   = useRef(false)
  const productLongStart = useRef<{ x: number; y: number } | null>(null)
  // Long-press duration for the product / bag context menus (deliberate hold).
  const LONG_PRESS_MS = 2000


  // Search results
  const lastProductMsg      = [...messages].reverse().find(m => m.role === 'assistant' && m.products?.length)
  const lastProductMsgIndex = lastProductMsg ? messages.lastIndexOf(lastProductMsg as any) : -1
  const searchProducts: Product[] = (lastProductMsg?.products || []).filter((p: Product) => p.in_stock)
  const lastAssistantText   = [...messages].reverse().find(m => m.role === 'assistant')?.content || ''
  const showEmpty = hasConversation && searchProducts.length === 0 && !loading
  const canSend   = input.trim().length > 0 || uploadedImages.length > 0 || barProducts.length > 0
  const hasName   = userName.length > 0

  // Keep refs up-to-date every render so the observer callback always sees current values
  canLoadMoreRef.current = !loading && !!lastProductMsg && !lastProductMsg.loadingMore && !lastProductMsg.hasNoMore && lastProductMsgIndex >= 0
  loadMoreRef.current = loadMoreProducts

  // Fetch live exchange rates on mount — server caches for 1 h so this is cheap
  useEffect(() => {
    fetch('/api/rates')
      .then(r => r.ok ? r.json() : null)
      .then(fresh => { if (fresh && typeof fresh === 'object') setLiveRates(fresh) })
      .catch(() => {})
  }, [])

  useEffect(() => { setTimeout(() => setLoaded(true), 60) }, [])
  useEffect(() => {
    const check = () => setIsWide(window.innerWidth >= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Block native browser context menu (image long-press sheet in Chrome/Brave/Firefox)
  // for any touch on a product card. Must be a native listener so it fires before
  // the browser decides to show its own menu.
  useEffect(() => {
    const block = (e: MouseEvent) => {
      if ((e.target as Element | null)?.closest('.fr-cell')) e.preventDefault()
    }
    document.addEventListener('contextmenu', block)
    return () => document.removeEventListener('contextmenu', block)
  }, [])

  // Rotating greeting tagline — changes every 13s, no repeats until all 12,000+
  // have cycled. Only runs while the home greeting is visible.
  const homeVisible = !hasConversation && !showExplore
  useEffect(() => {
    if (!homeVisible) return
    const order = shuffledIndices(TAGLINES.length)
    tagOrderRef.current = order
    let pos = 0
    // Immediately show a random tagline so every page load feels fresh
    setTagText(TAGLINES[order[pos]])
    const id = window.setInterval(() => {
      setTagVis(false)
      window.setTimeout(() => {
        pos = (pos + 1) % order.length
        setTagText(TAGLINES[order[pos]])
        setTagVis(true)
      }, 420)
    }, 13000)
    return () => window.clearInterval(id)
  }, [homeVisible])

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
  // Keep the stylist conversation scrolled to the latest message
  useEffect(() => { if (stylistScrollRef.current) stylistScrollRef.current.scrollTop = stylistScrollRef.current.scrollHeight }, [stylistMsgs, stylistLoading])
  useEffect(() => { if (selectedProduct) { setSize(null); setColor(null); setActiveImg(0); setSheetY(0); setSheetSnap('full'); setSizeGuideOpen(false); setSgTableIdx(0); setSgGroupIdx(0); setCleanDesc(null); setShippingInfo(null); setFetchedProductImages([]) } }, [selectedProduct])
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
      { rootMargin: '4000px', threshold: 0 }
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
    // Products attached → take the query to the stylist page instead of searching.
    if (barProducts.length > 0) {
      const q = input.trim() || (barProducts.length > 1 ? 'Compare these for me' : 'Tell me about this piece')
      openStylistWith(barProducts, q)
      setBarProducts([]); setInput(''); setInputHint(null)
      return
    }
    const names = uploadedImages.map(u => u.name).join(' ')
    const q = [input.trim(), names].filter(Boolean).join(' '); if (!q) return
    setShowExplore(false); setActiveBrand(null)
    sendMessage(q); setUploaded([]); setInputHint(null)
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
  const removeUpload = (idx: number) => setUploaded(prev => {
    const next = prev.filter((_, i) => i !== idx)
    if (next.length === 0) setInputHint(null)
    return next
  })
  const saveName = () => {
    const n = nameInput.trim()
    setUserName(n)
    localStorage.setItem('from_user_name', n)
    setIsEditing(false)
  }
  const kd = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); doSearch() } }
  const handleReset = () => { resetConversation(); setInputHint(null); setActiveBrand(null) }

  // Merge catalog images with the full gallery fetched from product.json.
  // Fetched images take precedence (higher quality, more complete); any catalog
  // images not already present are appended so nothing is lost.
  const _catalogImages = selectedProduct ? getProductImages(selectedProduct) : []
  const sheetImages = fetchedProductImages.length > 0
    ? (() => {
        const fetchedSet = new Set(fetchedProductImages)
        const extra = _catalogImages.filter(u => !fetchedSet.has(u))
        return [...fetchedProductImages, ...extra]
      })()
    : _catalogImages
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
  // Open the brand's checkout in a centered popup window so From stays open
  // behind it. (The brand's checkout lives on its own domain and blocks being
  // embedded in an iframe, so a popup window is as close to in-app as possible.)
  const openCheckout = (url: string) => {
    if (!url || url === '#') return
    const w = 460, h = 760
    const left = Math.round(window.screenX + Math.max(0, (window.outerWidth - w) / 2))
    const top  = Math.round(window.screenY + Math.max(0, (window.outerHeight - h) / 2))
    const popup = window.open(url, 'fromCheckout', `popup=yes,width=${w},height=${h},left=${left},top=${top}`)
    if (popup) { try { popup.opener = null } catch {} popup.focus?.() }
    else window.open(url, '_blank', 'noopener,noreferrer') // popup blocked → fall back to a tab
  }
  // Link straight to this product's own page so the shopper lands on the exact
  // item (where the brand's own size guide / fit info lives), not a generic page.
  const sizeGuideUrl  = selectedProduct?.store_url || null
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

  // Restore/persist unit preference across products
  useEffect(() => {
    const s = localStorage.getItem('from:sg-unit')
    if (s === 'in' || s === 'cm') setSgDisplayUnit(s)
  }, [])

  // Fetch size guide inline — runs after sheetSizeTable is derived, so ref is valid
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!selectedProduct || sheetSizeTable) { setFetchedSizeGuide(null); setSizeGuideLoading(false); return }
    const storeUrl = selectedProduct.store_url
    if (!storeUrl) { setFetchedSizeGuide(null); return }
    let cancelled = false
    setSizeGuideLoading(true)
    setFetchedSizeGuide(null)
    fetch(`/api/sizeguide?url=${encodeURIComponent(storeUrl)}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) setFetchedSizeGuide(d.html ?? null) })
      .catch(() => { if (!cancelled) setFetchedSizeGuide(null) })
      .finally(() => { if (!cancelled) setSizeGuideLoading(false) })
    return () => { cancelled = true }
  }, [selectedProduct?.id, sheetSizeTable])

  useEffect(() => {
    if (sgDisplayUnit) localStorage.setItem('from:sg-unit', sgDisplayUnit)
  }, [sgDisplayUnit])

  // AI-clean the product description — strips marketing fluff, CTAs, shipping text
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const raw = sheetDesc.trim()
    if (!selectedProduct || !raw) { setCleanDesc(null); return }
    let cancelled = false
    setCleanDescLoading(true)
    fetch('/api/description', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: selectedProduct.id,
        title: selectedProduct.title,
        vendor: selectedProduct.vendor,
        type: selectedProduct.product_type,
        rawText: raw,
      }),
    })
      .then(r => r.json())
      .then(d => { if (!cancelled) setCleanDesc(d.text || null) })
      .catch(() => { if (!cancelled) setCleanDesc(null) })
      .finally(() => { if (!cancelled) setCleanDescLoading(false) })
    return () => { cancelled = true }
  }, [selectedProduct?.id])

  // Fetch shipping & returns from brand policy pages
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const storeUrl = selectedProduct?.store_url
    if (!storeUrl) { setShippingInfo(null); return }
    let cancelled = false
    fetch(`/api/shipping?url=${encodeURIComponent(storeUrl)}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) setShippingInfo(d.data ?? null) })
      .catch(() => { if (!cancelled) setShippingInfo(null) })
    return () => { cancelled = true }
  }, [selectedProduct?.id])

  // Fetch full product image gallery from Shopify product.json.
  // The Catalog API often returns only 1 image; this fills in the rest.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setFetchedProductImages([])
    const storeUrl = selectedProduct?.store_url
    if (!storeUrl) return
    let cancelled = false
    fetch(`/api/product-images?url=${encodeURIComponent(storeUrl)}`)
      .then(r => r.json())
      .then(d => { if (!cancelled && Array.isArray(d.images) && d.images.length > 0) setFetchedProductImages(d.images) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [selectedProduct?.id])

  // Parse size guide HTML into structured interactive data
  const parsedSizeTables = useMemo(() => {
    const html = sheetSizeTable || fetchedSizeGuide
    if (!html) return []
    return parseSizeGuideHtml(html)
  }, [sheetSizeTable, fetchedSizeGuide])

  const sgTable   = parsedSizeTables[sgTableIdx] ?? null
  const sgEffectiveUnit = sgDisplayUnit ?? (sgTable?.unit || null)
  const sgChunks  = sgTable ? chunkHeaders(sgTable.headers) : []

  // Which columns of the international reference to show — only the letter sizes
  // the brand actually carries. If no letter sizes in headers, intl section is hidden.
  const sgIntlCols = useMemo(() => {
    if (!sgTable) return null
    const brandHdrs = new Set(sgTable.headers.map(h => h.toUpperCase().trim()))
    const refHdr = sgIntlGender === 'w' ? INTL_W_HDR : INTL_M_HDR
    const cols = refHdr
      .map((h, i) => ({ h, i }))
      .filter(({ h }) => brandHdrs.has(h))
    return cols.length > 0 ? cols : null
  }, [sgTable, sgIntlGender])
  const sgChunk   = sgChunks[sgGroupIdx] ?? []
  // Indices of current chunk's columns in the full headers array
  const sgColStart = sgGroupIdx * 3

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
        .fr-body{position:absolute;inset:0;overflow-y:auto;overflow-x:hidden;scrollbar-width:none;display:flex;flex-direction:column;padding-bottom:120px;overscroll-behavior-y:contain;}
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
        .fr-cell{aspect-ratio:3/4;position:relative;overflow:hidden;cursor:pointer;background:#ede8e3;-webkit-touch-callout:none;user-select:none;-webkit-user-select:none;touch-action:manipulation;}
        .fr-cell img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .4s,opacity .35s;-webkit-touch-callout:none;pointer-events:none;user-select:none;-webkit-user-select:none;}
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
          display:flex;align-items:center;justify-content:center;touch-action:manipulation;
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
          width:36px;height:36px;border-radius:50%;border:none;touch-action:manipulation;
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
        /* Size guide modal */
        .fr-sz-modal{font-family:'DM Sans',sans-serif;}
        .fr-sz-modal table{width:auto;min-width:max-content;white-space:nowrap;border-collapse:collapse;font-size:12px;}
        .fr-sz-modal th{background:rgba(44,18,6,.05);font-weight:600;text-transform:uppercase;letter-spacing:.05em;font-size:10px;color:${INK};padding:9px 14px;border:1px solid rgba(44,18,6,.1);text-align:left;vertical-align:middle;}
        .fr-sz-modal td{padding:9px 14px;border:1px solid rgba(44,18,6,.1);text-align:left;vertical-align:middle;color:${INK2};font-weight:300;}
        .fr-sz-modal tr:nth-child(even) td{background:rgba(44,18,6,.025);}
        .fr-sz-modal img{max-width:100%;height:auto;display:block;}

        /* ADD button — full width */
        .fr-add{display:block;width:100%;padding:17px;border:none;cursor:pointer;touch-action:manipulation;
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
        @keyframes toastIn{0%{opacity:0;transform:translateX(-50%) translateY(18px) scale(0.88);}60%{opacity:1;transform:translateX(-50%) translateY(-4px) scale(1.03);}80%{transform:translateX(-50%) translateY(2px) scale(0.99);}100%{opacity:1;transform:translateX(-50%) translateY(0) scale(1);}}
        @keyframes toastOut{0%{opacity:1;transform:translateX(-50%) translateY(0) scale(1);}100%{opacity:0;transform:translateX(-50%) translateY(14px) scale(0.88);}}
        @keyframes sheetUp{0%{transform:translateY(100%);}100%{transform:translateY(0);}}
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
                onClick={() => { handleReset(); setSidebarView('nav'); setSidebar(false) }}
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

              {/* Explore — coming soon */}
              <div className="fr-hi" onClick={() => {
                setSidebar(false)
                setExploreToastOut(false)
                setExploreToast(true)
                setTimeout(() => setExploreToastOut(true), 2200)
                setTimeout(() => setExploreToast(false), 2650)
              }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={INK3} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5z"/>
                  <path d="M19 3l.8 2.2L22 6l-2.2.8L19 9l-.8-2.2L16 6l2.2-.8z"/>
                  <path d="M5 17l.5 1.5L7 19l-1.5.5L5 21l-.5-1.5L3 19l1.5-.5z"/>
                </svg>
                Explore
              </div>

              {/* Brands — full roster with logos */}
              <div className="fr-hi" onClick={() => { setBrandQuery(''); setBrandsOpen(true) }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={INK3} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                  <line x1="7" y1="7" x2="7.01" y2="7"/>
                </svg>
                Brands
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
            <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none", padding: "0 12px", overscrollBehaviorY: "contain" }}>
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
                              const menuW = 220; const menuH = 120
                              const above = clientY + 8 + menuH > window.innerHeight
                              const y = Math.max(8, above ? clientY - menuH - 4 : clientY + 8)
                              const x = Math.max(8, Math.min(clientX, window.innerWidth - menuW - 8))
                              setCtxMenu({ id: h.id, query: h.query, x, y, above })
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
                        <div key={p.id} className="fr-hi"
                          style={{ gap: 10, userSelect: 'none', WebkitUserSelect: 'none' } as React.CSSProperties}
                          onContextMenu={e => e.preventDefault()}
                          onClick={() => {
                            if (wasLongPress.current) { wasLongPress.current = false; return }
                            setSelected(p); setSidebar(false)
                          }}
                          onPointerDown={e => {
                            wasLongPress.current = false
                            longPressStart.current = { x: e.clientX, y: e.clientY }
                            const { clientX, clientY } = e
                            longPressTimer.current = setTimeout(() => {
                              wasLongPress.current = true
                              const menuW = 190; const menuH = 90
                              const above = clientY + 8 + menuH > window.innerHeight
                              const y = Math.max(8, above ? clientY - menuH - 4 : clientY + 8)
                              const x = Math.max(8, Math.min(clientX, window.innerWidth - menuW - 8))
                              setBagCtxMenu({ product: p, x, y, above })
                            }, LONG_PRESS_MS)
                          }}
                          onPointerMove={e => {
                            const s = longPressStart.current
                            if (s && longPressTimer.current && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 10) {
                              clearTimeout(longPressTimer.current); longPressTimer.current = null
                            }
                          }}
                          onPointerUp={() => { if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null } }}
                          onPointerLeave={() => { if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null } }}
                        >
                          <div style={{ width: 34, height: 42, borderRadius: 7, overflow: 'hidden', flexShrink: 0, background: '#e8e8e8' }}>
                            {p.image_url && <img src={p.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 500, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                            <div style={{ fontFamily: SANS, fontSize: 11, color: INK3, marginTop: 2 }}>{formatMoney(p.price, p.currency, p.base_currency, liveRates)}</div>
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
              <div onClick={() => { handleReset(); setShowExplore(false) }} style={{ cursor: 'pointer' }}>
                <FromLogo size={22} color={SHUFFLED_PALETTE[logoIdx]} />
              </div>
            </div>
            {/* Right: compose / new chat */}
            <button
              onClick={() => handleReset()}
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
              <p style={{
                fontFamily: SANS, fontSize: "clamp(9px,2.2vw,11px)", letterSpacing: ".16em",
                textTransform: "uppercase", color: INK3, lineHeight: 1.7,
                maxWidth: 360, minHeight: "3.4em",
                opacity: tagVis ? .5 : 0, transition: "opacity .42s ease",
              }}>
                {tagText}
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
                    <div key={p.id} className="fr-cell"
                      role="button" tabIndex={0}
                      onContextMenu={e => e.preventDefault()}
                      onPointerDown={e => {
                        productWasLong.current = false
                        productLongStart.current = { x: e.clientX, y: e.clientY }
                        const { clientX, clientY } = e
                        productLongTimer.current = setTimeout(() => {
                          productWasLong.current = true
                          const menuW = 200; const menuH = 160
                          const above = clientY + 8 + menuH > window.innerHeight
                          const y = Math.max(8, above ? clientY - menuH - 4 : clientY + 8)
                          const x = Math.max(8, Math.min(clientX, window.innerWidth - menuW - 8))
                          setProductCtxMenu({ product: p, x, y, above })
                        }, LONG_PRESS_MS)
                      }}
                      onPointerMove={e => {
                        const s = productLongStart.current
                        if (s && productLongTimer.current && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 10) {
                          clearTimeout(productLongTimer.current); productLongTimer.current = null
                        }
                      }}
                      onPointerUp={() => { if (productLongTimer.current) { clearTimeout(productLongTimer.current); productLongTimer.current = null } }}
                      onPointerLeave={() => { if (productLongTimer.current) { clearTimeout(productLongTimer.current); productLongTimer.current = null } }}
                      onPointerCancel={() => { if (productLongTimer.current) { clearTimeout(productLongTimer.current); productLongTimer.current = null } }}
                      onClick={() => { if (productWasLong.current) { productWasLong.current = false; return }; setSelected(p) }}
                      onKeyDown={e => e.key === 'Enter' && setSelected(p)}>
                      {p.image_url ? (
                        <>
                          <div style={{ position:'absolute',inset:0,zIndex:1,overflow:'hidden',background:'#e8e4de' }}>
                            <div style={{ position:'absolute',top:0,bottom:0,width:'60%',
                              background:'linear-gradient(90deg,#e8e4de 0%,#edeae5 35%,#f0ece7 50%,#edeae5 65%,#e8e4de 100%)',
                              animation:'sk-sweep 2s ease-in-out infinite',willChange:'transform' }} />
                          </div>
                          <img src={p.image_url} alt="" loading="lazy" draggable={false}
                            style={{ position:'relative',zIndex:2,opacity:0 }}
                            onLoad={e => { (e.target as HTMLImageElement).style.opacity = '1' }}
                          />
                          {/* Transparent overlay — touch target is this div, not the <img>,
                              so Chrome/Brave never fires its image long-press context menu */}
                          <div style={{ position:'absolute',inset:0,zIndex:3,WebkitTouchCallout:'none' } as React.CSSProperties} />
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

            {/* Brand profile header — shown when viewing a brand's catalog */}
            {activeBrand && (hasConversation || loading) && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '22px 24px 18px', gap: 10 }}>
                <BrandLogo domain={activeBrand.domain} name={activeBrand.name} size={64} />
                <div>
                  <h2 style={{ fontFamily: SEASON, fontSize: 'clamp(22px,6vw,28px)', fontWeight: 400, color: INK, letterSpacing: '.01em', lineHeight: 1.1 }}>{activeBrand.name}</h2>
                  <p style={{ fontFamily: SANS, fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: INK3, marginTop: 6 }}>
                    {loading ? 'Loading collection…' : `${searchProducts.length} ${searchProducts.length === 1 ? 'piece' : 'pieces'}`}
                  </p>
                </div>
                <div style={{ width: 36, height: 1, background: BRD, marginTop: 2 }} />
              </div>
            )}

            {/* Product grid */}
            {(hasConversation || showExplore) && !loading && searchProducts.length > 0 && (
              <>
                <div className="fr-grid">
                  {searchProducts.map(p => (
                    <div key={p.id} className="fr-cell"
                      role="button" tabIndex={0}
                      onContextMenu={e => e.preventDefault()}
                      onPointerDown={e => {
                        productWasLong.current = false
                        productLongStart.current = { x: e.clientX, y: e.clientY }
                        const { clientX, clientY } = e
                        productLongTimer.current = setTimeout(() => {
                          productWasLong.current = true
                          const menuW = 200; const menuH = 160
                          const above = clientY + 8 + menuH > window.innerHeight
                          const y = Math.max(8, above ? clientY - menuH - 4 : clientY + 8)
                          const x = Math.max(8, Math.min(clientX, window.innerWidth - menuW - 8))
                          setProductCtxMenu({ product: p, x, y, above })
                        }, LONG_PRESS_MS)
                      }}
                      onPointerMove={e => {
                        const s = productLongStart.current
                        if (s && productLongTimer.current && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 10) {
                          clearTimeout(productLongTimer.current); productLongTimer.current = null
                        }
                      }}
                      onPointerUp={() => { if (productLongTimer.current) { clearTimeout(productLongTimer.current); productLongTimer.current = null } }}
                      onPointerLeave={() => { if (productLongTimer.current) { clearTimeout(productLongTimer.current); productLongTimer.current = null } }}
                      onPointerCancel={() => { if (productLongTimer.current) { clearTimeout(productLongTimer.current); productLongTimer.current = null } }}
                      onClick={() => { if (productWasLong.current) { productWasLong.current = false; return }; setSelected(p) }}
                      onKeyDown={e => e.key === 'Enter' && setSelected(p)}>
                      {p.image_url ? (
                        <>
                          {/* Shimmer sits behind until image is opaque */}
                          <div style={{ position:'absolute',inset:0,zIndex:1,overflow:'hidden',background:'#e8e4de' }}>
                            <div style={{ position:'absolute',top:0,bottom:0,width:'60%',
                              background:'linear-gradient(90deg,#e8e4de 0%,#edeae5 35%,#f0ece7 50%,#edeae5 65%,#e8e4de 100%)',
                              animation:'sk-sweep 2s ease-in-out infinite',willChange:'transform' }} />
                          </div>
                          <img src={p.image_url} alt="" draggable={false}
                            loading="lazy" decoding="async"
                            style={{ position:'relative',zIndex:2,opacity:0 }}
                            onLoad={e => { (e.target as HTMLImageElement).style.opacity = '1' }}
                          />
                          {/* Transparent overlay — touch target is this div, not the <img>,
                              so Chrome/Brave never fires its image long-press context menu */}
                          <div style={{ position:'absolute',inset:0,zIndex:3,WebkitTouchCallout:'none' } as React.CSSProperties} />
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

                  {/* Product strip — attached products that send the query to the stylist */}
                  {barProducts.length > 0 && (
                    <div style={{
                      display: 'flex', gap: 8, overflowX: 'auto', padding: '10px 12px 0',
                      scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch',
                    } as React.CSSProperties}>
                      {barProducts.map(p => (
                        <div key={p.id} style={{ position: 'relative', flexShrink: 0 }}>
                          <div style={{ width: 56, height: 70, borderRadius: 10, overflow: 'hidden', background: BG2, border: '1px solid rgba(0,0,0,0.08)' }}>
                            {getProductImages(p)[0] && <img src={getProductImages(p)[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                          </div>
                          <button type="button" onClick={() => removeBarProduct(p.id)}
                            style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: '#1E1A16', border: '1.5px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
                            <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M2 2l6 6M8 2l-6 6" stroke="white" strokeWidth="1.6" strokeLinecap="round"/></svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

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
                      placeholder={inputHint ?? "What are you looking for?"}
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
                transformOrigin: ctxMenu.above ? 'bottom left' : 'top left',
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

          {/* ── Brands roster — all working brands with logo + name ── */}
          {brandsOpen && (
            <div onClick={() => setBrandsOpen(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 9992, background: 'rgba(0,0,0,0.42)', display: 'flex', alignItems: 'flex-end', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' } as React.CSSProperties}>
              <div onClick={e => e.stopPropagation()}
                style={{ width: '100%', maxWidth: 680, margin: '0 auto', background: '#fff', borderRadius: '18px 18px 0 0', display: 'flex', flexDirection: 'column', maxHeight: '92vh', animation: 'sheetUp .34s cubic-bezier(.32,.72,0,1)' }}>

                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px 12px', flexShrink: 0 }}>
                  <div>
                    <span style={{ fontFamily: SANS, fontSize: 11, fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: INK }}>Brands</span>
                    <span style={{ fontFamily: SANS, fontSize: 11, color: INK3, marginLeft: 8 }}>{allBrands.length}</span>
                  </div>
                  <button onClick={() => setBrandsOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: INK3, lineHeight: 0 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>

                {/* Search */}
                <div style={{ padding: '0 20px 12px', flexShrink: 0 }}>
                  <input value={brandQuery} onChange={e => setBrandQuery(e.target.value)} placeholder="Search brands…"
                    style={{ width: '100%', fontFamily: SANS, fontSize: 14, color: INK, border: `1px solid ${BRD}`, borderRadius: 22, padding: '10px 16px', outline: 'none', background: BG2 }} />
                </div>

                {/* List */}
                <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '4px 12px 32px' } as React.CSSProperties}>
                  {filteredBrands.length === 0 ? (
                    <p style={{ fontFamily: SANS, fontSize: 13, color: INK3, padding: '20px 8px', opacity: .6 }}>No brands match “{brandQuery}”.</p>
                  ) : filteredBrands.map(b => (
                    <div key={b.domain} onClick={() => openBrand(b)} className="fr-hi"
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 8px', cursor: 'pointer' }}>
                      <BrandLogo domain={b.domain} name={b.name} size={40} />
                      <span style={{ fontFamily: SANS, fontSize: 14, fontWeight: 500, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</span>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={INK3} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto', flexShrink: 0, opacity: .5 }}><polyline points="9 18 15 12 9 6"/></svg>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Stylist sheet — conversational AI over specific product(s) ── */}
          {stylistOpen && (
            <div onClick={() => setStylistOpen(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 9990, background: 'rgba(0,0,0,0.42)', display: 'flex', alignItems: 'flex-end', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' } as React.CSSProperties}>
              <div onClick={e => e.stopPropagation()}
                style={{ width: '100%', maxWidth: 680, margin: '0 auto', background: '#fff', borderRadius: '18px 18px 0 0', display: 'flex', flexDirection: 'column', maxHeight: '90vh', animation: 'sheetUp .34s cubic-bezier(.32,.72,0,1)' }}>

                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px 12px', borderBottom: `1px solid ${BRD}`, flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill={INK} stroke="none"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/></svg>
                    <span style={{ fontFamily: SANS, fontSize: 11, fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: INK }}>Your Stylist</span>
                  </div>
                  <button onClick={() => setStylistOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: INK3, lineHeight: 0 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>

                {/* Pinned products */}
                <div style={{ display: 'flex', gap: 10, padding: '12px 20px', overflowX: 'auto', flexShrink: 0, borderBottom: `1px solid ${BRD}`, scrollbarWidth: 'none' } as React.CSSProperties}>
                  {stylistProducts.map(p => (
                    <div key={p.id} style={{ position: 'relative', flexShrink: 0, width: 116 }}>
                      <div onClick={() => { setStylistOpen(false); setSelected(p) }} style={{ width: 116, height: 145, borderRadius: 10, overflow: 'hidden', background: BG2, cursor: 'pointer' }}>
                        {getProductImages(p)[0] && <img src={getProductImages(p)[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                      </div>
                      <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 500, color: INK, marginTop: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                      <div style={{ fontFamily: SANS, fontSize: 10, color: INK3 }}>{formatMoney(p.price, p.currency, p.base_currency, liveRates)}</div>
                      {stylistProducts.length > 1 && (
                        <button onClick={() => removeStylistProduct(p.id)} style={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,.55)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Conversation */}
                <div ref={stylistScrollRef} style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', WebkitOverflowScrolling: 'touch', minHeight: 130 } as React.CSSProperties}>
                  {stylistMsgs.length === 0 && !stylistLoading && (
                    <p style={{ fontFamily: SERIF, fontSize: 18, color: INK3, lineHeight: 1.4 }}>
                      Ask anything about {stylistProducts.length > 1 ? 'these pieces' : 'this piece'}.
                    </p>
                  )}
                  {stylistMsgs.map((m, i) => (
                    <div key={i} style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                      <div style={{ maxWidth: '88%', fontFamily: SANS, fontSize: 14, lineHeight: 1.55,
                        padding: m.role === 'user' ? '9px 14px' : 0,
                        background: m.role === 'user' ? INK : 'transparent',
                        color: m.role === 'user' ? '#fff' : INK2,
                        borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : 0,
                        whiteSpace: 'pre-wrap' }}>
                        {m.content}
                      </div>
                      {m.comparison && m.comparison.rows.length > 0 && (
                        <div style={{ marginTop: 10, width: '100%', border: `1px solid ${BRD}`, borderRadius: 12, overflow: 'hidden' }}>
                          <div style={{ display: 'flex', borderBottom: `1px solid ${BRD}` }}>
                            <div style={{ width: 88, flexShrink: 0 }} />
                            {stylistProducts.map((p, ci) => (
                              <div key={p.id} style={{ flex: 1, padding: '10px 6px', textAlign: 'center', borderLeft: `1px solid ${BRD}`, background: m.comparison!.pick?.index === ci ? 'rgba(44,18,6,0.05)' : 'transparent' }}>
                                <div style={{ width: 38, height: 48, margin: '0 auto', borderRadius: 6, overflow: 'hidden', background: BG2 }}>
                                  {getProductImages(p)[0] && <img src={getProductImages(p)[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                                </div>
                                {m.comparison!.pick?.index === ci && (
                                  <div style={{ fontFamily: SANS, fontSize: 8, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: INK, marginTop: 4 }}>Best pick</div>
                                )}
                              </div>
                            ))}
                          </div>
                          {m.comparison.rows.map((row, ri) => (
                            <div key={ri} style={{ display: 'flex', borderBottom: ri < m.comparison!.rows.length - 1 ? `1px solid ${BRD}` : 'none' }}>
                              <div style={{ width: 88, flexShrink: 0, padding: '9px 10px', fontFamily: SANS, fontSize: 10, fontWeight: 600, letterSpacing: '.03em', textTransform: 'uppercase', color: INK3 }}>{row.label}</div>
                              {stylistProducts.map((p, ci) => (
                                <div key={ci} style={{ flex: 1, padding: '9px 8px', textAlign: 'center', fontFamily: SANS, fontSize: 12, color: INK2, borderLeft: `1px solid ${BRD}`, background: m.comparison!.pick?.index === ci ? 'rgba(44,18,6,0.05)' : 'transparent' }}>
                                  {row.values[ci] ?? '—'}
                                </div>
                              ))}
                            </div>
                          ))}
                          {m.comparison.pick?.reason && stylistProducts[m.comparison.pick.index] && (
                            <div style={{ padding: '10px 12px', fontFamily: SANS, fontSize: 12, color: INK2, lineHeight: 1.5, background: 'rgba(44,18,6,0.03)', borderTop: `1px solid ${BRD}` }}>
                              <strong style={{ fontWeight: 600 }}>{stylistProducts[m.comparison.pick.index].title}:</strong> {m.comparison.pick.reason}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  {stylistLoading && (
                    <div style={{ display: 'flex', gap: 5, padding: '4px 2px' }}>
                      {[0, 1, 2].map(d => <span key={d} style={{ width: 7, height: 7, borderRadius: '50%', background: INK3, animation: `fr-bounce 1.2s ${d * 0.15}s infinite` }} />)}
                    </div>
                  )}
                </div>

                {/* Input */}
                <div style={{ flexShrink: 0, padding: '12px 16px calc(12px + env(safe-area-inset-bottom))', borderTop: `1px solid ${BRD}`, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input value={stylistInput} onChange={e => setStylistInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); sendStylist(stylistInput) } }}
                    placeholder="Ask your stylist…"
                    style={{ flex: 1, fontFamily: SANS, fontSize: 14, color: INK, border: `1px solid ${BRD}`, borderRadius: 22, padding: '11px 16px', outline: 'none', background: BG2 }} />
                  <button onClick={() => sendStylist(stylistInput)} disabled={!stylistInput.trim() || stylistLoading}
                    style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: stylistInput.trim() && !stylistLoading ? INK : 'rgba(44,18,6,.2)', color: '#fff', cursor: stylistInput.trim() && !stylistLoading ? 'pointer' : 'default', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Size Guide modal — interactive ── */}
          {sizeGuideOpen && (
            <div onClick={() => setSizeGuideOpen(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.42)', display: 'flex', alignItems: 'flex-end', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' } as React.CSSProperties}>
              <div onClick={e => e.stopPropagation()}
                style={{ width: '100%', maxWidth: 680, margin: '0 auto', background: '#fff', borderRadius: '18px 18px 0 0', display: 'flex', flexDirection: 'column', maxHeight: '86vh' }}>

                {/* ── Header ── */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px 14px', borderBottom: '1px solid rgba(44,18,6,0.08)', flexShrink: 0 }}>
                  <div>
                    <span style={{ fontFamily: SANS, fontSize: 11, fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: INK }}>Size Guide</span>
                    {parsedSizeTables.length === 1 && parsedSizeTables[0].label && (
                      <p style={{ fontFamily: SANS, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: INK3, marginTop: 3 }}>{parsedSizeTables[0].label}</p>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {sgTable?.unit && (
                      <div style={{ display: 'flex', border: `1px solid rgba(44,18,6,0.18)`, overflow: 'hidden', borderRadius: 4 }}>
                        {(['in', 'cm'] as const).map(u => {
                          const active = (sgDisplayUnit ?? sgTable!.unit) === u
                          return (
                            <button key={u} onClick={() => setSgDisplayUnit(u === sgTable!.unit && !sgDisplayUnit ? u : u)}
                              style={{ padding: '5px 11px', fontFamily: SANS, fontSize: 10, fontWeight: 500,
                                letterSpacing: '.06em', border: 'none', cursor: 'pointer',
                                background: active ? INK : 'transparent',
                                color: active ? '#fff' : INK3, transition: 'all .15s' }}>
                              {u}
                            </button>
                          )
                        })}
                      </div>
                    )}
                    <button onClick={() => setSizeGuideOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: INK3, lineHeight: 0 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                </div>

                {sizeGuideLoading && !sheetSizeTable && !fetchedSizeGuide ? (
                  <p style={{ fontFamily: SANS, fontSize: 13, color: INK3, padding: '24px 20px', fontWeight: 300 }}>Loading…</p>
                ) : parsedSizeTables.length > 0 ? (
                  <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>

                    {/* ── Section tabs (multiple tables, e.g. Tops / Bottoms) ── */}
                    {parsedSizeTables.length > 1 && (
                      <div style={{ display: 'flex', borderBottom: '1px solid rgba(44,18,6,0.08)', flexShrink: 0, overflowX: 'auto', scrollbarWidth: 'none' }}>
                        {parsedSizeTables.map((t, i) => (
                          <button key={i} onClick={() => { setSgTableIdx(i); setSgGroupIdx(0) }}
                            style={{ flexShrink: 0, padding: '13px 16px', fontFamily: SANS, fontSize: 11, fontWeight: sgTableIdx === i ? 600 : 400,
                              letterSpacing: '.08em', textTransform: 'uppercase', color: sgTableIdx === i ? INK : INK3,
                              background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                              borderBottom: sgTableIdx === i ? `2px solid ${INK}` : '2px solid transparent',
                              marginBottom: -1 }}>
                            {t.label || `Table ${i + 1}`}
                          </button>
                        ))}
                      </div>
                    )}

                    {sgTable && (
                      <>
                        {/* ── Range selector — e.g. "XS – M | L – XXL | XXXL" ── */}
                        {sgChunks.length > 1 && (
                          <div style={{ padding: '20px 20px 0', flexShrink: 0 }}>
                            <p style={{ fontFamily: SANS, fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: INK3, marginBottom: 10 }}>Select size range</p>
                            <div style={{ display: 'flex', gap: 8 }}>
                              {sgChunks.map((chunk, i) => {
                                const label = chunk.length > 1 ? `${chunk[0]} - ${chunk[chunk.length - 1]}` : chunk[0]
                                const on = sgGroupIdx === i
                                return (
                                  <button key={i} onClick={() => setSgGroupIdx(i)}
                                    style={{ flex: 1, padding: '11px 6px', fontFamily: SANS, fontSize: 11, fontWeight: 500,
                                      letterSpacing: '.04em', color: on ? '#fff' : INK,
                                      background: on ? INK : 'transparent',
                                      border: `1.5px solid ${on ? INK : 'rgba(44,18,6,0.20)'}`,
                                      borderRadius: 0, cursor: 'pointer', transition: 'all .15s' }}>
                                    {label}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {/* ── Measurement table ── */}
                        <div style={{ padding: '20px 20px 40px' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: SANS }}>
                            <thead>
                              <tr>
                                <th style={{ textAlign: 'left', padding: '0 0 16px', fontFamily: SANS, fontSize: 10, fontWeight: 400, letterSpacing: '.06em', textTransform: 'uppercase', color: INK3 }} />
                                {sgChunk.map(h => (
                                  <th key={h} style={{ textAlign: 'center', padding: '0 4px 16px', fontFamily: SANS, fontSize: 12, fontWeight: 700, letterSpacing: '.06em', color: INK }}>
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {sgTable.rows
                                .filter(row => row.values.slice(sgColStart, sgColStart + sgChunk.length).some(v => v.trim()))
                                .map((row, ri) => (
                                  <tr key={ri} style={{ borderTop: '1px solid rgba(44,18,6,0.07)' }}>
                                    <td style={{ padding: '14px 0', fontFamily: SANS, fontSize: 12, fontWeight: 600, color: INK, letterSpacing: '.02em' }}>
                                      {row.label}
                                    </td>
                                    {sgChunk.map((_, ci) => (
                                      <td key={ci} style={{ padding: '14px 4px', textAlign: 'center', fontFamily: SANS, fontSize: 12, fontWeight: 300, color: INK2 }}>
                                        {sgDisplayUnit ? convertMeasurement(row.values[sgColStart + ci] ?? '—', sgTable.unit, sgDisplayUnit) : (row.values[sgColStart + ci] ?? '—')}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                          <p style={{ fontFamily: SANS, fontSize: 10, color: INK3, letterSpacing: '.04em', marginTop: 16, lineHeight: 1.6 }}>
                            {sgEffectiveUnit
                              ? `All measurements in ${sgEffectiveUnit === 'in' ? 'inches' : 'centimetres'}. `
                              : ''}
                            Measurements may vary slightly. When in doubt, size up.
                          </p>
                          {/* ── International size reference — only shown when brand uses letter sizes ── */}
                          {sgIntlCols && (
                            <div style={{ marginTop: 28, borderTop: '1px solid rgba(44,18,6,0.07)', paddingTop: 18 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                                <span style={{ fontFamily: SANS, fontSize: 10, fontWeight: 600, letterSpacing: '.10em', textTransform: 'uppercase', color: INK2 }}>
                                  International Sizes
                                </span>
                                <div style={{ display: 'flex', border: `1px solid rgba(44,18,6,0.18)`, overflow: 'hidden', borderRadius: 4 }}>
                                  {(['Women', 'Men'] as const).map((g, gi) => {
                                    const gkey = gi === 0 ? 'w' : 'm'
                                    const on = sgIntlGender === gkey
                                    return (
                                      <button key={g} onClick={() => setSgIntlGender(gkey as 'w' | 'm')}
                                        style={{ padding: '5px 11px', fontFamily: SANS, fontSize: 10, fontWeight: 500,
                                          letterSpacing: '.04em', border: 'none', cursor: 'pointer',
                                          background: on ? INK : 'transparent',
                                          color: on ? '#fff' : INK3, transition: 'all .15s' }}>
                                        {g}
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>
                              <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
                                <table style={{ borderCollapse: 'collapse', fontFamily: SANS, fontSize: 11, minWidth: '100%' }}>
                                  <thead>
                                    <tr>
                                      <th style={{ textAlign: 'left', padding: '0 10px 8px 0', fontFamily: SANS, fontSize: 10, fontWeight: 500, color: INK3, whiteSpace: 'nowrap' }} />
                                      {sgIntlCols.map(({ h }) => (
                                        <th key={h} style={{ textAlign: 'center', padding: '0 6px 8px', fontFamily: SANS, fontSize: 11, fontWeight: 700, letterSpacing: '.04em', color: INK }}>
                                          {h}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(sgIntlGender === 'w' ? INTL_W : INTL_M).map(row => (
                                      <tr key={row.sys} style={{ borderTop: '1px solid rgba(44,18,6,0.06)' }}>
                                        <td style={{ padding: '8px 10px 8px 0', fontFamily: SANS, fontSize: 11, fontWeight: 600, color: INK2, whiteSpace: 'nowrap' }}>
                                          {row.sys}
                                        </td>
                                        {sgIntlCols.map(({ i }) => (
                                          <td key={i} style={{ textAlign: 'center', padding: '8px 6px', fontFamily: SANS, fontSize: 11, fontWeight: 300, color: INK3 }}>
                                            {row.vals[i]}
                                          </td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                              <p style={{ fontFamily: SANS, fontSize: 9, color: INK3, letterSpacing: '.04em', marginTop: 10, lineHeight: 1.6 }}>
                                Standard reference only. Brands vary — always check the measurements above.
                              </p>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ) : (sheetSizeTable || fetchedSizeGuide) ? (
                  // Fallback: image-based size guide
                  <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 40px' } as React.CSSProperties}>
                    <div className="fr-sz-modal" dangerouslySetInnerHTML={{ __html: (sheetSizeTable || fetchedSizeGuide)! }} />
                  </div>
                ) : (
                  <div style={{ padding: '24px 20px 40px' }}>
                    <p style={{ fontFamily: SANS, fontSize: 13, color: INK3, fontWeight: 300, lineHeight: 1.7, marginBottom: 16 }}>
                      {sizeGuideLoading ? 'Loading size guide…' : "We couldn't load the size guide for this product."}
                    </p>
                    {!sizeGuideLoading && sizeGuideUrl && (
                      <a href={sizeGuideUrl} target="_blank" rel="noopener noreferrer"
                        style={{ fontFamily: SANS, fontSize: 13, color: INK, fontWeight: 500, textDecoration: 'underline', textUnderlineOffset: 3 }}>
                        View this product on {sheetBrandName || sheetStoreHost} →
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Explore coming-soon toast ── */}
          {exploreToast && (
            <div style={{ position: 'fixed', bottom: 96, left: '50%', zIndex: 9999,
              background: INK, color: '#fff', borderRadius: 24,
              padding: '11px 22px', display: 'flex', alignItems: 'center', gap: 10,
              fontFamily: SANS, fontSize: 13, fontWeight: 400, letterSpacing: '.01em',
              boxShadow: '0 8px 32px rgba(44,18,6,0.32), 0 2px 8px rgba(44,18,6,0.18)', whiteSpace: 'nowrap',
              animation: `${exploreToastOut ? 'toastOut 0.42s cubic-bezier(0.4,0,1,1)' : 'toastIn 0.52s cubic-bezier(0.34,1.36,0.64,1)'} forwards`,
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: .7 }}>
                <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5z"/>
              </svg>
              Explore — coming soon
            </div>
          )}

          {/* ── Bag item long-press menu — Ask stylist + Remove ── */}
          {bagCtxMenu && (
            <>
              <div onClick={() => setBagCtxMenu(null)} style={{ position: 'fixed', inset: 0, zIndex: 9000 }} />
              <div style={{
                position: 'fixed', left: bagCtxMenu.x, top: bagCtxMenu.y, zIndex: 9001,
                width: 190, borderRadius: 12, overflow: 'hidden',
                background: 'linear-gradient(160deg, rgba(255,255,255,0.96) 0%, rgba(245,245,248,0.94) 100%)',
                boxShadow: '0 0 0 0.5px rgba(255,255,255,0.9), 0 12px 36px rgba(0,0,0,0.18), 0 3px 10px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,1)',
                border: '0.5px solid rgba(180,180,190,0.35)',
                animation: 'ctxIn 0.22s cubic-bezier(0.34,1.36,0.64,1)',
                transformOrigin: bagCtxMenu.above ? 'bottom left' : 'top left',
              }}>
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
                  background: 'linear-gradient(140deg, rgba(255,255,255,0.6) 0%, transparent 45%)' }} />
                {/* Ask your stylist */}
                <div onClick={() => {
                    addBarProduct(bagCtxMenu.product)
                    setSidebar(false)
                    setBagCtxMenu(null)
                  }}
                  style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', padding: '11px 14px', cursor: 'pointer', gap: 8,
                    fontFamily: '-apple-system,BlinkMacSystemFont,system-ui,sans-serif',
                    fontSize: 14, fontWeight: 400, color: '#1C1C1E' }}
                  onPointerDown={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.07)')}
                  onPointerUp={e => (e.currentTarget.style.background = '')}
                  onPointerLeave={e => (e.currentTarget.style.background = '')}>
                  <span>Ask your stylist</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(60,60,67,0.6)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
                  </svg>
                </div>
                <div style={{ height: '0.5px', background: 'rgba(60,60,67,0.15)', position: 'relative', zIndex: 1 }} />
                {/* Remove from bag */}
                <div onClick={() => { toggleSaved(bagCtxMenu.product); setBagCtxMenu(null) }}
                  style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', padding: '11px 14px', cursor: 'pointer', gap: 8,
                    fontFamily: '-apple-system,BlinkMacSystemFont,system-ui,sans-serif',
                    fontSize: 14, fontWeight: 400, color: '#FF3B30' }}
                  onPointerDown={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.07)')}
                  onPointerUp={e => (e.currentTarget.style.background = '')}
                  onPointerLeave={e => (e.currentTarget.style.background = '')}>
                  <span>Remove from bag</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,59,48,0.8)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                  </svg>
                </div>
              </div>
            </>
          )}

          {/* ── Product card long-press context menu — Liquid Glass ── */}
          {productCtxMenu && (
            <>
              <div onClick={() => setProductCtxMenu(null)}
                style={{ position: 'fixed', inset: 0, zIndex: 9000 }} />
              <div style={{
                position: 'fixed',
                left: productCtxMenu.x, top: productCtxMenu.y,
                zIndex: 9001,
                width: 190,
                borderRadius: 12,
                overflow: 'hidden',
                background: 'linear-gradient(160deg, rgba(255,255,255,0.96) 0%, rgba(245,245,248,0.94) 100%)',
                boxShadow: '0 0 0 0.5px rgba(255,255,255,0.9), 0 12px 36px rgba(0,0,0,0.18), 0 3px 10px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,1)',
                border: '0.5px solid rgba(180,180,190,0.35)',
                animation: 'ctxIn 0.22s cubic-bezier(0.34,1.36,0.64,1)',
                transformOrigin: productCtxMenu.above ? 'bottom left' : 'top left',
              }}>
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
                  background: 'linear-gradient(140deg, rgba(255,255,255,0.6) 0%, transparent 45%)' }} />

                {/* Ask your stylist — opens the conversational stylist sheet */}
                <div onClick={() => {
                    addBarProduct(productCtxMenu.product)
                    setProductCtxMenu(null)
                  }}
                  style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', padding: '11px 14px', cursor: 'pointer', gap: 8,
                    fontFamily: '-apple-system,BlinkMacSystemFont,system-ui,sans-serif',
                    fontSize: 14, fontWeight: 400, color: '#1C1C1E' }}
                  onPointerDown={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.07)')}
                  onPointerUp={e => (e.currentTarget.style.background = '')}
                  onPointerLeave={e => (e.currentTarget.style.background = '')}>
                  <span>Ask your stylist</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(60,60,67,0.6)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
                  </svg>
                </div>

                <div style={{ height: '0.5px', background: 'rgba(60,60,67,0.15)', position: 'relative', zIndex: 1 }} />

                {/* Bag it / In your bag */}
                <div onClick={() => {
                    toggleSaved(productCtxMenu.product)
                    setProductCtxMenu(null)
                  }}
                  style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', padding: '11px 14px', cursor: 'pointer', gap: 8,
                    fontFamily: '-apple-system,BlinkMacSystemFont,system-ui,sans-serif',
                    fontSize: 14, fontWeight: 400, color: '#1C1C1E' }}
                  onPointerDown={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.07)')}
                  onPointerUp={e => (e.currentTarget.style.background = '')}
                  onPointerLeave={e => (e.currentTarget.style.background = '')}>
                  <span>{savedIds.has(productCtxMenu.product.id) ? 'In your bag ✓' : 'Bag it!'}</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill={savedIds.has(productCtxMenu.product.id) ? 'rgba(60,60,67,0.6)' : 'none'} stroke="rgba(60,60,67,0.6)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
                  </svg>
                </div>

                <div style={{ height: '0.5px', background: 'rgba(60,60,67,0.15)', position: 'relative', zIndex: 1 }} />

                {/* Find similar */}
                <div onClick={() => {
                    setProductCtxMenu(null)
                    sendMessage(`Find products similar to ${productCtxMenu.product.title}`)
                  }}
                  style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', padding: '11px 14px', cursor: 'pointer', gap: 8,
                    fontFamily: '-apple-system,BlinkMacSystemFont,system-ui,sans-serif',
                    fontSize: 14, fontWeight: 400, color: '#1C1C1E' }}
                  onPointerDown={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.07)')}
                  onPointerUp={e => (e.currentTarget.style.background = '')}
                  onPointerLeave={e => (e.currentTarget.style.background = '')}>
                  <span>Find similar</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(60,60,67,0.6)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><path d="M11 8v6M8 11h6"/>
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


                {isWide ? (
                  /* ── Desktop / tablet: image left + details right ── */
                  <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

                    {/* Left — full-height image, swipeable carousel */}
                    <div style={{ width: '48%', flexShrink: 0, position: 'relative', overflow: 'hidden', borderRadius: '28px 0 0 28px', background: '#ede8e3', touchAction: sheetImages.length > 1 ? 'none' : 'auto' }}
                      onPointerDown={sheetImages.length > 1 ? onImgDown : undefined}
                      onPointerMove={sheetImages.length > 1 ? (e => onImgMove(e, sheetImages.length)) : undefined}
                      onPointerUp={sheetImages.length > 1 ? (() => onImgUp(sheetImages.length)) : undefined}
                      onPointerCancel={sheetImages.length > 1 ? (() => onImgUp(sheetImages.length)) : undefined}
                    >
                      <div style={{ display: 'flex', height: '100%', transition: (imgActive.current && imgLockH.current) ? 'none' : 'transform .32s cubic-bezier(.32,.72,0,1)', transform: `translateX(calc(-${activeImg * 100}% + ${imgDX}px))` }}>
                        {sheetImages.length > 0 ? sheetImages.map((img, i) => (
                          <div key={i} style={{ width: '100%', height: '100%', flexShrink: 0 }}>
                            <img src={img} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', userSelect: 'none', pointerEvents: 'none' }} />
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
                    <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none' as const, display: 'flex', flexDirection: 'column', paddingBottom: 28, overscrollBehaviorY: 'contain' }}>

                      {/* Close row — X sits alone at the top, no overlap with content */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '14px 14px 0' }}>
                        <button onClick={() => setSelected(null)} aria-label="Close"
                          style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', cursor: 'pointer', flexShrink: 0,
                            background: 'rgba(44,18,6,.07)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'background .15s' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(44,18,6,.14)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(44,18,6,.07)')}>
                          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                            <path d="M1 1l10 10M11 1L1 11" stroke={INK} strokeWidth="1.6" strokeLinecap="round"/>
                          </svg>
                        </button>
                      </div>

                      {/* Title + save + price */}
                      <div style={{ padding: '12px 24px 0' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                          <h2 style={{ fontFamily: SANS, fontSize: 14, fontWeight: 500, color: INK, lineHeight: 1.3, letterSpacing: '.06em', textTransform: 'uppercase', flex: 1 }}>
                            {selectedProduct.title}
                          </h2>
                          <button onClick={() => toggleSaved(selectedProduct)} aria-label={savedIds.has(selectedProduct.id) ? 'In your bag' : 'Bag it'}
                            style={{ background: 'transparent', border: 'none', padding: '2px 4px', cursor: 'pointer', flexShrink: 0, marginTop: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                            <svg width="19" height="19" viewBox="0 0 24 24" fill={savedIds.has(selectedProduct.id) ? INK : 'none'} stroke={INK} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
                            </svg>
                            <span style={{ fontFamily: SANS, fontSize: 8.5, letterSpacing: '.09em', textTransform: 'uppercase', color: INK, lineHeight: 1 }}>
                              {savedIds.has(selectedProduct.id) ? 'Bagged' : 'Bag it'}
                            </span>
                          </button>
                        </div>
                        <p style={{ fontFamily: SANS, fontSize: 18, color: INK, fontWeight: 700, marginTop: 10 }}>
                          {formatMoney(selectedProduct.price, selectedProduct.currency, selectedProduct.base_currency, liveRates)}
                        </p>
                        {selectedProduct.currency !== selectedProduct.base_currency ? (
                          <p style={{ fontFamily: SANS, fontSize: 11, color: INK3, marginTop: 3, fontWeight: 300 }}>
                            {formatMoney(selectedProduct.price, selectedProduct.base_currency, selectedProduct.base_currency, liveRates)} · Live rate
                          </p>
                        ) : (
                          <p style={{ fontFamily: SANS, fontSize: 11, color: INK3, marginTop: 3, fontWeight: 300 }}>Prices at checkout may vary</p>
                        )}
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
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <span style={{ fontFamily: SANS, fontSize: 11, color: INK3, letterSpacing: '.04em', textTransform: 'uppercase' }}>Size</span>
                            <button onClick={() => setSizeGuideOpen(true)} style={{ fontFamily: SANS, fontSize: 11, color: INK3, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline', textUnderlineOffset: 3, letterSpacing: '.03em' }}>
                              {sizeGuideLoading && !sheetSizeTable && !fetchedSizeGuide ? 'Loading…' : 'Size Guide'}
                            </button>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(sheetSizes.length, 6)},1fr)` }}>
                            {sheetSizes.map((s, i) => {
                              const avail = sizeAvail[s] !== false
                              const on = selectedSize === s
                              return (
                                <button key={s} disabled={!avail} onClick={() => avail && setSize(on ? null : s)}
                                  className={`fr-szbox${on ? ' on' : ''}${avail ? '' : ' dis'}`}
                                  style={{ marginLeft: i % 6 === 0 ? 0 : -1 }}>
                                  {normalizeSizeLabel(s)}
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
                          onClick={e => { e.preventDefault(); if (sheetSizes.length > 0 && !selectedSize) return; openCheckout(checkoutUrl) }}>
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
                        {(sheetDesc || sheetDescHtml) && (
                          <Accordion label="Description & Fit" defaultOpen>
                            {cleanDescLoading && !cleanDesc ? (
                              <p style={{ fontFamily: SANS, fontSize: 13, color: INK3, fontWeight: 300, lineHeight: 1.7 }}>…</p>
                            ) : cleanDesc ? (
                              <p style={{ fontFamily: SANS, fontSize: 13, color: INK2, lineHeight: 1.75, fontWeight: 300, whiteSpace: 'pre-line' }}>{cleanDesc}</p>
                            ) : sheetDescHtml ? (
                              <div className="fr-html" dangerouslySetInnerHTML={{ __html: sheetDescHtml }} />
                            ) : (
                              <p style={{ fontFamily: SANS, fontSize: 13, color: INK2, lineHeight: 1.75, fontWeight: 300, whiteSpace: 'pre-line' }}>{sheetDesc}</p>
                            )}
                          </Accordion>
                        )}
                        {(sheetMaterial || sheetCareTags.length > 0) && (
                          <Accordion label="Materials & Care">
                            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {sheetMaterial && sheetMaterial.split(/[,;]+/).map(m => m.trim()).filter(Boolean).map((m, i) => (
                                <li key={`mat-${i}`} style={{ fontFamily: SANS, fontSize: 13, color: INK2, fontWeight: 300, lineHeight: 1.5 }}>
                                  {'• '}{m.charAt(0).toUpperCase() + m.slice(1)}
                                </li>
                              ))}
                              {sheetCareTags.map((tag, i) => (
                                <li key={`care-${i}`} style={{ fontFamily: SANS, fontSize: 13, color: INK2, fontWeight: 300, lineHeight: 1.5 }}>
                                  {'• '}{tag}
                                </li>
                              ))}
                            </ul>
                          </Accordion>
                        )}
                        {sheetDetailTags.length > 0 && (
                          <Accordion label="Product Details">
                            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
                              {sheetDetailTags.slice(0, 16).map((tag, i) => (
                                <li key={i} style={{ fontFamily: SANS, fontSize: 13, color: INK2, fontWeight: 300, lineHeight: 1.5 }}>
                                  {'• '}{tag}
                                </li>
                              ))}
                            </ul>
                          </Accordion>
                        )}
                        <Accordion label="Delivery & Returns">
                          {shippingInfo ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                              {shippingInfo.shipping && (
                                <div>
                                  <p style={{ fontFamily: SANS, fontSize: 10, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: INK3, marginBottom: 8 }}>Shipping</p>
                                  {shippingInfo.shipping.split('\n').filter(l => l.trim()).map((line, i) => (
                                    <p key={i} style={{ fontFamily: SANS, fontSize: 13, color: INK2, fontWeight: 300, lineHeight: 1.6, marginBottom: 4 }}>{line.trim()}</p>
                                  ))}
                                </div>
                              )}
                              {shippingInfo.returns && (
                                <div>
                                  <p style={{ fontFamily: SANS, fontSize: 10, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: INK3, marginBottom: 8 }}>Returns</p>
                                  {shippingInfo.returns.split('\n').filter(l => l.trim()).map((line, i) => (
                                    <p key={i} style={{ fontFamily: SANS, fontSize: 13, color: INK2, fontWeight: 300, lineHeight: 1.6, marginBottom: 4 }}>{line.trim()}</p>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : (
                            <p style={{ fontFamily: SANS, fontSize: 13, color: INK2, lineHeight: 1.7, fontWeight: 300 }}>
                              Shipping and returns are handled directly by {sheetBrandName || 'the store'}. Delivery times and return windows vary. Check their policies at checkout.
                            </p>
                          )}
                        </Accordion>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* ── Phone: original stacked layout ── */
                  <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none", paddingBottom: 24, overscrollBehaviorY: "contain" }}>
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
                              <img src={img} alt="" draggable={false} style={{ width: "100%", aspectRatio: "4/5", objectFit: "contain", background: "#f5f4f2", display: "block", userSelect: "none", pointerEvents: "none" }} />
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
                        <button onClick={() => toggleSaved(selectedProduct)} aria-label={savedIds.has(selectedProduct.id) ? 'In your bag' : 'Bag it'}
                          style={{ background: "transparent", border: "none", padding: "2px 4px", cursor: "pointer", flexShrink: 0, marginTop: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                          <svg width="21" height="21" viewBox="0 0 24 24" fill={savedIds.has(selectedProduct.id) ? INK : "none"} stroke={INK} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
                          </svg>
                          <span style={{ fontFamily: SANS, fontSize: 8.5, letterSpacing: ".09em", textTransform: "uppercase", color: INK, lineHeight: 1 }}>
                            {savedIds.has(selectedProduct.id) ? 'Bagged' : 'Bag it'}
                          </span>
                        </button>
                      </div>
                      <p style={{ fontFamily: SANS, fontSize: "clamp(15px,4vw,17px)", color: INK, fontWeight: 700, marginTop: 8 }}>
                        {formatMoney(selectedProduct.price, selectedProduct.currency, selectedProduct.base_currency, liveRates)}
                      </p>
                      {selectedProduct.currency !== selectedProduct.base_currency ? (
                        <p style={{ fontFamily: SANS, fontSize: 11, color: INK3, marginTop: 3, fontWeight: 300 }}>
                          {formatMoney(selectedProduct.price, selectedProduct.base_currency, selectedProduct.base_currency, liveRates)} · Live rate
                        </p>
                      ) : (
                        <p style={{ fontFamily: SANS, fontSize: 11, color: INK3, marginTop: 3, fontWeight: 300 }}>Prices at checkout may vary</p>
                      )}
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
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <span style={{ fontFamily: SANS, fontSize: 11, color: INK3, letterSpacing: ".04em", textTransform: "uppercase" }}>Size</span>
                          <button onClick={() => setSizeGuideOpen(true)} style={{ fontFamily: SANS, fontSize: 11, color: INK3, background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline", textUnderlineOffset: 3, letterSpacing: ".03em" }}>
                            {sizeGuideLoading && !sheetSizeTable && !fetchedSizeGuide ? 'Loading…' : 'Size Guide'}
                          </button>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(sheetSizes.length, 6)},1fr)` }}>
                          {sheetSizes.map((s, i) => {
                            const avail = sizeAvail[s] !== false
                            const on = selectedSize === s
                            return (
                              <button key={s} disabled={!avail} onClick={() => avail && setSize(on ? null : s)}
                                className={`fr-szbox${on ? " on" : ""}${avail ? "" : " dis"}`}
                                style={{ marginLeft: i % 6 === 0 ? 0 : -1 }}>
                                {normalizeSizeLabel(s)}
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
                        onClick={e => { e.preventDefault(); if (sheetSizes.length > 0 && !selectedSize) return; openCheckout(checkoutUrl) }}>
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
                      {(sheetDesc || sheetDescHtml) && (
                        <Accordion label="Description & Fit" defaultOpen>
                          {cleanDescLoading && !cleanDesc ? (
                            <p style={{ fontFamily: SANS, fontSize: 13, color: INK3, fontWeight: 300, lineHeight: 1.7 }}>…</p>
                          ) : cleanDesc ? (
                            <p style={{ fontFamily: SANS, fontSize: 13, color: INK2, lineHeight: 1.75, fontWeight: 300, whiteSpace: "pre-line" }}>{cleanDesc}</p>
                          ) : sheetDescHtml ? (
                            <div className="fr-html" dangerouslySetInnerHTML={{ __html: sheetDescHtml }} />
                          ) : (
                            <p style={{ fontFamily: SANS, fontSize: 13, color: INK2, lineHeight: 1.75, fontWeight: 300, whiteSpace: "pre-line" }}>{sheetDesc}</p>
                          )}
                        </Accordion>
                      )}
                      {(sheetMaterial || sheetCareTags.length > 0) && (
                        <Accordion label="Materials & Care">
                          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
                            {sheetMaterial && sheetMaterial.split(/[,;]+/).map(m => m.trim()).filter(Boolean).map((m, i) => (
                              <li key={`mat-${i}`} style={{ fontFamily: SANS, fontSize: 13, color: INK2, fontWeight: 300, lineHeight: 1.5 }}>
                                {'• '}{m.charAt(0).toUpperCase() + m.slice(1)}
                              </li>
                            ))}
                            {sheetCareTags.map((tag, i) => (
                              <li key={`care-${i}`} style={{ fontFamily: SANS, fontSize: 13, color: INK2, fontWeight: 300, lineHeight: 1.5 }}>
                                {'• '}{tag}
                              </li>
                            ))}
                          </ul>
                        </Accordion>
                      )}
                      {sheetDetailTags.length > 0 && (
                        <Accordion label="Product Details">
                          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 7 }}>
                            {sheetDetailTags.slice(0, 16).map((tag, i) => (
                              <li key={i} style={{ fontFamily: SANS, fontSize: 13, color: INK2, fontWeight: 300, lineHeight: 1.5 }}>
                                {'• '}{tag}
                              </li>
                            ))}
                          </ul>
                        </Accordion>
                      )}
                      <Accordion label="Delivery & Returns">
                        {shippingInfo ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                            {shippingInfo.shipping && (
                              <div>
                                <p style={{ fontFamily: SANS, fontSize: 10, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: INK3, marginBottom: 8 }}>Shipping</p>
                                {shippingInfo.shipping.split('\n').filter(l => l.trim()).map((line, i) => (
                                  <p key={i} style={{ fontFamily: SANS, fontSize: 13, color: INK2, fontWeight: 300, lineHeight: 1.6, marginBottom: 4 }}>{line.trim()}</p>
                                ))}
                              </div>
                            )}
                            {shippingInfo.returns && (
                              <div>
                                <p style={{ fontFamily: SANS, fontSize: 10, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: INK3, marginBottom: 8 }}>Returns</p>
                                {shippingInfo.returns.split('\n').filter(l => l.trim()).map((line, i) => (
                                  <p key={i} style={{ fontFamily: SANS, fontSize: 13, color: INK2, fontWeight: 300, lineHeight: 1.6, marginBottom: 4 }}>{line.trim()}</p>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <p style={{ fontFamily: SANS, fontSize: 13, color: INK2, lineHeight: 1.7, fontWeight: 300 }}>
                            Shipping and returns are handled directly by {sheetBrandName || "the store"}. Delivery times and return windows vary. Check their policies at checkout.
                          </p>
                        )}
                      </Accordion>
                    </div>

                    {similarItems.length > 0 && (
                      <div ref={similarRef} style={{ padding: "26px 0 0" }}>
                        <div style={{ padding: "0 20px", marginBottom: 14 }}>
                          <span style={{ fontFamily: SANS, fontSize: 12, fontWeight: 600, letterSpacing: ".07em", textTransform: "uppercase", color: INK }}>Similar items</span>
                        </div>
                        <div style={{ display: "flex", gap: 10, overflowX: "auto", scrollbarWidth: "none", padding: "0 20px 4px", touchAction: "pan-x", overscrollBehaviorX: "contain" }}>
                          {similarItems.map(p => (
                            <button key={p.id} onClick={() => setSelected(p)}
                              style={{ flexShrink: 0, width: 120, background: "transparent", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}>
                              <div style={{ width: 120, aspectRatio: "3/4", overflow: "hidden", background: "#ede8e3", marginBottom: 7 }}>
                                {p.image_url && <img src={p.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />}
                              </div>
                              <div style={{ fontFamily: SANS, fontSize: 11.5, color: INK, lineHeight: 1.35, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</div>
                              <div style={{ fontFamily: SANS, fontSize: 11.5, color: INK2, fontWeight: 600, marginTop: 3 }}>{formatMoney(p.price, p.currency, p.base_currency, liveRates)}</div>
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
