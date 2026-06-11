import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'

export const runtime = 'nodejs'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

function getPeriodEnd(sub: any): number {
  // Field name changed across Stripe API versions; fall back to 30 days from now
  const ts: number =
    sub.current_period_end ??
    sub.billing_cycle_anchor ??
    Math.floor(Date.now() / 1000) + 30 * 24 * 3600
  return ts * 1000
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')
  if (!sig) return NextResponse.json({ error: 'Missing signature' }, { status: 400 })

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err: any) {
    console.error('[webhook] signature verification failed:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode !== 'subscription') break
        const userEmail = session.metadata?.userEmail
        if (!userEmail) break

        const rawSub = await stripe.subscriptions.retrieve(session.subscription as string)
        const sub = rawSub as any

        await convex.mutation(api.subscriptions.upgradeSubscription, {
          userEmail,
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: sub.id,
          currentPeriodEnd: getPeriodEnd(sub),
        })
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as any
        const customerId = sub.customer as string
        if (sub.status === 'active') {
          // First cancel existing record, then re-upgrade with fresh period end
          await convex.mutation(api.subscriptions.cancelSubscriptionByStripeCustomer, {
            stripeCustomerId: customerId,
          })
          const userEmail = sub.metadata?.userEmail as string | undefined
          if (userEmail) {
            await convex.mutation(api.subscriptions.upgradeSubscription, {
              userEmail,
              stripeCustomerId: customerId,
              stripeSubscriptionId: sub.id as string,
              currentPeriodEnd: getPeriodEnd(sub),
            })
          }
        } else if (['canceled', 'unpaid', 'past_due'].includes(sub.status)) {
          await convex.mutation(api.subscriptions.cancelSubscriptionByStripeCustomer, {
            stripeCustomerId: customerId,
          })
        }
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as any
        await convex.mutation(api.subscriptions.cancelSubscriptionByStripeCustomer, {
          stripeCustomerId: sub.customer as string,
        })
        break
      }
    }
  } catch (err) {
    console.error('[webhook] handler error:', err)
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
