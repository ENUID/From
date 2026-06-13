'use client'

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

  const onAllowlist = useQuery(
    api.subscriptions.isOnAllowlist,
    userEmail ? { email: userEmail } : 'skip'
  )

  const plan = subscription?.plan ?? 'free'
  const periodEnd = subscription?.currentPeriodEnd

  const hasStripePremium =
    plan === 'premium' &&
    (periodEnd === undefined || periodEnd === null || periodEnd > Date.now())

  const isPremium = hasStripePremium || onAllowlist === true

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
