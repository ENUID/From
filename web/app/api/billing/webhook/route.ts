import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'

export const runtime = 'nodejs'

function getPeriodEnd(sub: any): number {
  // Field name changed across Stripe API versions; fall back to 30 days from now
  const ts: number =
    sub.current_period_end ??
    sub.billing_cycle_anchor ??
    Math.floor(Date.now() / 1000) + 30 * 24 * 3600
  return ts * 1000
}

export async function POST(req: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)
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
        const userEmail = session.metadata?.userEmail
        if (!userEmail) break

        // One-time payment — lifetime community access, no expiry
        await convex.mutation(api.subscriptions.upgradeSubscription, {
          userEmail,
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: session.id,
          currentPeriodEnd: 99999999999999, // lifetime — never expires
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
