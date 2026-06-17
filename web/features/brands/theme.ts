/**
 * Brand-side design tokens — mirrors the shopper app's warm, editorial language
 * (Cormorant Garamond display, DM Sans body, brown ink on warm paper) so the
 * merchant surfaces feel like the same product.
 */

export const INK  = '#2C1206'           // dark brown — primary text
export const INK2 = '#4A2010'           // medium brown
export const INK3 = '#9B7060'           // warm muted brown — secondary text
export const PAPER = '#F7F5F0'          // warm paper page background
export const CARD = '#FFFFFF'
export const BRD  = 'rgba(44,18,6,0.08)'
export const BRD2 = 'rgba(44,18,6,0.16)'
export const FILL = '#F7F4F2'           // input fill

export const GOOD = '#1F7A48'
export const WARN = '#9A6A1A'
export const BAD  = '#9A3030'

export const SANS  = "'DM Sans', system-ui, sans-serif"
export const SERIF = "'Cormorant Garamond', Georgia, serif"

import type { CSSProperties } from 'react'

export const page: CSSProperties = {
  fontFamily: SANS, color: INK, background: PAPER, minHeight: '100vh',
}
export const shell: CSSProperties = {
  maxWidth: 660, margin: '0 auto', padding: '0 20px 110px',
}
export const card: CSSProperties = {
  background: CARD, border: `1px solid ${BRD}`, borderRadius: 18,
  padding: 24, marginBottom: 16,
}
export const sectionLabel: CSSProperties = {
  fontFamily: SANS, fontSize: 11, fontWeight: 600, letterSpacing: '.12em',
  textTransform: 'uppercase', color: INK3, marginBottom: 14,
}
export const input: CSSProperties = {
  width: '100%', padding: '13px 15px', fontSize: 15, fontFamily: SANS,
  borderRadius: 12, border: `1px solid ${BRD2}`, background: FILL, color: INK,
  outline: 'none', boxSizing: 'border-box',
}
export function pill(disabled?: boolean): CSSProperties {
  return {
    padding: '13px 26px', fontSize: 12.5, fontWeight: 600, letterSpacing: '.1em',
    textTransform: 'uppercase', fontFamily: SANS,
    color: '#fff', background: disabled ? '#bda99e' : INK,
    border: 'none', borderRadius: 30, cursor: disabled ? 'default' : 'pointer',
    WebkitTapHighlightColor: 'transparent', transition: 'opacity .2s',
  }
}
export function pillGhost(): CSSProperties {
  return {
    padding: '13px 24px', fontSize: 12.5, fontWeight: 600, letterSpacing: '.1em',
    textTransform: 'uppercase', fontFamily: SANS,
    color: INK, background: 'transparent', border: `1px solid ${BRD2}`,
    borderRadius: 30, cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
  }
}
