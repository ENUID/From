'use client'

import { useSession } from 'next-auth/react'
import { useQuery } from 'convex/react'
import { api } from '../convex/_generated/api'

const FREE_DAILY_LIMIT = 5

export function useSubscription() {
  const { data: session } = useSession()
  const userEmail = session?.user?.email ?? undefined

  const subscription = useQuery(
    api.subscriptions.getSubscription,
    userEmail ? { userEmail } : 'skip'
  )

  const dailyCount = useQuery(
    api.subscriptions.getDailySearchCount,
    userEmail ? { userEmail } : 'skip'
  )

  const plan = subscription?.plan ?? 'free'
  const periodEnd = subscription?.currentPeriodEnd

  const isPremium =
    plan === 'premium' &&
    (periodEnd === undefined || periodEnd === null || periodEnd > Date.now())

  const dailySearchesUsed = dailyCount ?? 0
  const dailySearchesRemaining = isPremium
    ? Infinity
    : Math.max(0, FREE_DAILY_LIMIT - dailySearchesUsed)

  const canSearch = isPremium || dailySearchesRemaining > 0

  return {
    subscription,
    isPremium,
    plan,
    dailySearchesUsed,
    dailySearchesRemaining,
    canSearch,
    isLoading: subscription === undefined,
  }
}
