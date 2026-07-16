'use client'

import { useEffect, useState } from 'react'

export type AuthProof = { email: string; expiresAt: number; signature: string }

// One-shot imperative fetch of a fresh proof. Exposed so a save handler can
// recover on demand when the cached proof is momentarily absent, instead of
// hard-failing on a timing gap (see saveProfile).
export async function fetchConvexAuthProof(): Promise<AuthProof | null> {
  try {
    const r = await fetch('/api/auth/convex-token', { cache: 'no-store' })
    const d = await r.json()
    return (d?.authProof as AuthProof) ?? null
  } catch {
    return null
  }
}

// Fetches a signed Convex auth proof (see lib/convexAuthProof.ts /
// convex/lib/authProof.ts) once signed in, and keeps it fresh — proofs live
// 10 minutes. Every Convex query/mutation that touches per-user data needs
// one; pass `undefined` while signed out and every caller naturally skips
// (existing `authProof ? {...} : 'skip'` query pattern).
//
// Refresh strategy matters: a single failed/empty fetch (a transient error,
// or the session cookie not yet readable right after sign-in) must NOT leave
// the user without a proof — and therefore unable to save their profile or
// sync — for minutes. So we retry quickly with capped backoff on failure, and
// on success schedule the next refresh off the proof's OWN expiry (a bit
// early) rather than a fixed interval that could drift past the 10-min TTL.
export function useConvexAuthProof(email: string | undefined): AuthProof | null {
  const [authProof, setAuthProof] = useState<AuthProof | null>(null)

  useEffect(() => {
    setAuthProof(null) // clear any proof from a previous (or absent) email before fetching the new one
    if (!email) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let attempt = 0

    const schedule = (ms: number) => {
      if (cancelled) return
      timer = setTimeout(run, ms)
    }

    const run = async () => {
      if (cancelled) return
      const proof = await fetchConvexAuthProof()
      if (cancelled) return
      if (proof) {
        attempt = 0
        setAuthProof(proof)
        // Refresh ~2.5 min before the 10-min proof actually expires; clamp so
        // it's never longer than 7 min and never shorter than 30s.
        const lead = 2.5 * 60 * 1000
        const wait = Math.min(7 * 60 * 1000, Math.max(30 * 1000, proof.expiresAt - Date.now() - lead))
        schedule(wait)
      } else {
        // Failed or empty — retry soon (1.5s, 3s, 6s… capped at 30s) instead of
        // leaving the user proofless (and unable to save) until the next fixed
        // refresh minutes away.
        attempt++
        const backoff = Math.min(30 * 1000, 1500 * 2 ** (attempt - 1))
        schedule(backoff)
      }
    }

    run()
    return () => { cancelled = true; if (timer) clearTimeout(timer) }
  }, [email])

  return authProof
}
