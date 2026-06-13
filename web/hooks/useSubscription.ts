'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useQuery } from 'convex/react'
import { api } from '../convex/_generated/api'

export function useSubscription() {
  const { data: session } = useSession()
  const userEmail = session?.user?.email ?? undefined

  const subscription = useQuery(
    api.subscriptions.getSubscription,
    userEmail ? { userEmail } : 'skip'
  )

  // Allowlist check via the API route — checks BOTH the COMMUNITY_EMAILS env
  // var (instant, no DB) and the Convex table. Works even if Convex is down.
  const [allowed, setAllowed] = useState<boolean | null>(null)
  useEffect(() => {
    if (!userEmail) { setAllowed(false); return }
    let active = true
    fetch('/api/community/me')
      .then((r) => r.json())
      .then((d) => { if (active) setAllowed(d?.allowed === true) })
      .catch(() => { if (active) setAllowed(false) })
    return () => { active = false }
  }, [userEmail])

  const plan = subscription?.plan ?? 'free'
  const periodEnd = subscription?.currentPeriodEnd

  const hasStripePremium =
    plan === 'premium' &&
    (periodEnd === undefined || periodEnd === null || periodEnd > Date.now())

  const isPremium = hasStripePremium || allowed === true

  return {
    subscription,
    isPremium,
    plan,
    dailySearchesUsed: 0,
    dailySearchesRemaining: Infinity,
    canSearch: true,
    isLoading: subscription === undefined,
  }
}
