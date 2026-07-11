'use client'

import { useEffect, useState } from 'react'

export type AuthProof = { email: string; expiresAt: number; signature: string }

// Fetches a signed Convex auth proof (see lib/convexAuthProof.ts /
// convex/lib/authProof.ts) once signed in, and refreshes it before it
// expires — proofs live 10 minutes, refreshed every 7 to leave headroom.
// Every Convex query/mutation that touches per-user data now requires one
// of these; pass `undefined` while signed out and every caller naturally
// skips (existing `authProof ? {...} : 'skip'` query pattern) rather than
// firing with a stale or missing proof.
export function useConvexAuthProof(email: string | undefined): AuthProof | null {
  const [authProof, setAuthProof] = useState<AuthProof | null>(null)

  useEffect(() => {
    if (!email) { setAuthProof(null); return }
    let cancelled = false
    const fetchProof = () => {
      fetch('/api/auth/convex-token')
        .then(r => r.json())
        .then(d => { if (!cancelled && d?.authProof) setAuthProof(d.authProof) })
        .catch(() => {})
    }
    fetchProof()
    const interval = setInterval(fetchProof, 7 * 60 * 1000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [email])

  return authProof
}
