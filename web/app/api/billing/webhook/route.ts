import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'

export const runtime = 'nodejs'

function getPeriodEnd(sub: Stripe.Subscription): number {
  const ts: number =
    (sub as any).current_period_end ??
    sub.billing_cycle_anchor ??
    Math.floor(Date.now() / 1000) + 30 * 24 * 3600
  return ts * 1000
}

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET || !process.env.NEXT_PUBLIC_CONVEX_URL || !process.env.CONVEX_AUTH_SECRET) {
    console.error('[webhook] Missing required env vars')
    return NextResponse.json({ error: 'Not configured' }, { status: 500 })
  }
  const serverSecret = process.env.CONVEX_AUTH_SECRET
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL)
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')
  if (!sig) return NextResponse.json({ error: 'Missing signature' }, { status: 400 })

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err: any) {
    console.error('[webhook] signature verification failed:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userEmail = session.metadata?.userEmail
        if (!userEmail) {
          console.warn('[webhook] checkout.session.completed missing userEmail in metadata')
          break
        }

        // Fetch the subscription to get the real billing period end
        if (!session.subscription) {
          console.warn('[webhook] checkout.session.completed missing subscription id')
          break
        }
        const sub = await stripe.subscriptions.retrieve(session.subscription as string)
        await convex.mutation(api.subscriptions.upgradeSubscription, {
          userEmail,
          stripeCustomerId: (session.customer as string | null) ?? session.customer_email ?? userEmail,
          stripeSubscriptionId: sub.id,
          currentPeriodEnd: getPeriodEnd(sub),
          serverSecret,
        })
        break
      }

      case 'customer.subscription.updated': {
        // Fires on renewal — extend the period end so the user stays premium
        const sub = event.data.object as Stripe.Subscription
        if (sub.status !== 'active') break
        const customer = await stripe.customers.retrieve(sub.customer as string) as Stripe.Customer
        if (!customer.email) break
        await convex.mutation(api.subscriptions.upgradeSubscription, {
          userEmail: customer.email,
          stripeCustomerId: sub.customer as string,
          stripeSubscriptionId: sub.id,
          currentPeriodEnd: getPeriodEnd(sub),
          serverSecret,
        })
        break
      }

      case 'customer.subscription.deleted': {
        // Subscription cancelled — downgrade to free
        const sub = event.data.object as Stripe.Subscription
        await convex.mutation(api.subscriptions.cancelSubscriptionByStripeCustomer, {
          stripeCustomerId: sub.customer as string,
          serverSecret,
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
