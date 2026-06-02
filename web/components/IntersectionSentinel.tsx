'use client'

import { useEffect, useRef } from 'react'

interface IntersectionSentinelProps {
  onIntersect: () => void
  disabled?: boolean
  rootMargin?: string
}

export default function IntersectionSentinel({
  onIntersect,
  disabled = false,
  rootMargin = '1200px'
}: IntersectionSentinelProps) {
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (disabled || !sentinelRef.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onIntersect()
        }
      },
      { rootMargin }
    )

    observer.observe(sentinelRef.current)

    return () => observer.disconnect()
  }, [disabled, onIntersect, rootMargin])

  return <div ref={sentinelRef} style={{ height: 1, width: '100%', opacity: 0 }} aria-hidden="true" />
}
