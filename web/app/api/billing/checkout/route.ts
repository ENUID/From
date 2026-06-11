import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const PREMIUM_PRICE_ID = process.env.STRIPE_PREMIUM_PRICE_ID!

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { interval = 'month' } = await req.json().catch(() => ({}))

  const priceId = interval === 'year'
    ? (process.env.STRIPE_PREMIUM_PRICE_ID_YEARLY ?? PREMIUM_PRICE_ID)
    : PREMIUM_PRICE_ID

  try {
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: session.user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.NEXTAUTH_URL ?? 'https://from.enuid.com'}/?upgraded=1`,
      cancel_url: `${process.env.NEXTAUTH_URL ?? 'https://from.enuid.com'}/`,
      metadata: { userEmail: session.user.email },
      subscription_data: {
        metadata: { userEmail: session.user.email },
      },
    })

    return NextResponse.json({ url: checkoutSession.url })
  } catch (err: any) {
    console.error('[billing/checkout]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
