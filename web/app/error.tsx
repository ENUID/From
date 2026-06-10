'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'DM Sans', system-ui, sans-serif",
      background: '#FFFFFF',
      padding: '24px',
      textAlign: 'center',
    }}>
      <p style={{ fontSize: 13, color: '#9B7060', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 12 }}>
        Something went wrong
      </p>
      <h1 style={{ fontSize: 22, fontWeight: 400, color: '#2C1206', marginBottom: 20, fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
        From couldn&apos;t load
      </h1>
      <button
        onClick={reset}
        style={{
          padding: '10px 24px',
          background: '#2C1206',
          color: '#fff',
          border: 'none',
          borderRadius: 12,
          fontSize: 13,
          fontFamily: "'DM Sans', system-ui, sans-serif",
          cursor: 'pointer',
          letterSpacing: '.02em',
        }}
      >
        Try again
      </button>
    </div>
  )
}
