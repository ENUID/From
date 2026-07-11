'use client'

import { useEffect, useState } from 'react'

const PROMPTS = [
  'a linen suit for a beach wedding in Italy',
  'quiet-luxury knitwear in oatmeal and stone',
  'gorpcore shell jacket that actually looks good',
  'the perfect white tee — heavyweight, boxy',
  'something to wear to a rooftop dinner, not too try-hard',
  'wide-leg trousers with a vintage drape',
]

const INK = '#2C1206', INK3 = '#9B7060', BRD2 = 'rgba(44,18,6,0.16)'
const SANS = "'DM Sans', system-ui, sans-serif"

export default function HeroPrompt() {
  const [i, setI] = useState(0)
  const [shown, setShown] = useState('')

  useEffect(() => {
    const full = PROMPTS[i]
    let pos = 0
    let typing = true
    let hold = 0
    const id = setInterval(() => {
      if (typing) {
        pos++
        setShown(full.slice(0, pos))
        if (pos >= full.length) { typing = false; hold = 0 }
      } else {
        hold++
        if (hold > 22) {
          pos = Math.max(0, pos - 3)
          setShown(full.slice(0, pos))
          if (pos <= 0) { clearInterval(id); setI(p => (p + 1) % PROMPTS.length) }
        }
      }
    }, 45)
    return () => clearInterval(id)
  }, [i])

  function enter() { window.location.href = '/shop' }

  return (
    <div style={{ width: '100%', maxWidth: 560, margin: '0 auto' }}>
      <button
        onClick={enter}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 12, cursor: 'text',
          padding: '17px 20px', borderRadius: 40, background: '#fff',
          border: `1px solid ${BRD2}`, boxShadow: '0 10px 40px rgba(44,18,6,.08)',
          textAlign: 'left', WebkitTapHighlightColor: 'transparent',
        }}
        aria-label="Enter Discern and start searching"
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={INK3} strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
          <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
        </svg>
        <span style={{ fontFamily: SANS, fontSize: 16, color: INK, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {shown}
          <span style={{ borderLeft: `2px solid ${INK3}`, marginLeft: 1, animation: 'fromCaret 1s step-end infinite' }} />
        </span>
      </button>
      <button
        onClick={enter}
        style={{
          marginTop: 16, padding: '15px 34px', borderRadius: 40, background: INK, color: '#fff',
          border: 'none', cursor: 'pointer', fontFamily: SANS, fontSize: 13, fontWeight: 600,
          letterSpacing: '.1em', textTransform: 'uppercase', WebkitTapHighlightColor: 'transparent',
        }}
      >
        Enter Discern
      </button>
      <style>{`@keyframes fromCaret { 50% { opacity: 0 } }`}</style>
    </div>
  )
}
