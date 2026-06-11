import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  const COMMUNITY_PRICE_ID = process.env.STRIPE_COMMUNITY_PRICE_ID!

  try {
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: session.user.email,
      line_items: [{ price: COMMUNITY_PRICE_ID, quantity: 1 }],
      success_url: `${process.env.NEXTAUTH_URL ?? 'https://from.enuid.com'}/?upgraded=1`,
      cancel_url: `${process.env.NEXTAUTH_URL ?? 'https://from.enuid.com'}/`,
      metadata: { userEmail: session.user.email },
    })

    return NextResponse.json({ url: checkoutSession.url })
  } catch (err: any) {
    console.error('[billing/checkout]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
