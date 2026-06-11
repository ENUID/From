import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import { Resend } from 'resend'

export const runtime = 'nodejs'
export const maxDuration = 300

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)
const resend = new Resend(process.env.RESEND_API_KEY)
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'FROM <noreply@from.enuid.com>'
const APP_URL = process.env.NEXTAUTH_URL ?? 'https://from.enuid.com'
const PRICE_DROP_THRESHOLD = 0.10 // 10% drop triggers alert
const CRON_SECRET = process.env.CRON_SECRET

async function fetchCurrentPrice(storeUrl: string, productHandle: string | undefined): Promise<number | null> {
  if (!storeUrl) return null
  try {
    const u = new URL(storeUrl)
    const handle = productHandle || u.pathname.split('/products/')[1]?.split('?')[0]
    if (!handle) return null
    const apiUrl = `https://${u.hostname}/products/${handle}.json`
    const res = await fetch(apiUrl, {
      headers: { 'User-Agent': 'FROM-PriceCheck/1.0' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const data = await res.json()
    const variants: any[] = data?.product?.variants || []
    if (!variants.length) return null
    const prices = variants.map((v: any) => parseFloat(v.price)).filter((p: number) => !isNaN(p) && p > 0)
    return prices.length ? Math.min(...prices) : null
  } catch {
    return null
  }
}

function priceDropEmail(product: any, currentPrice: number, savedPrice: number): string {
  const drop = Math.round((1 - currentPrice / savedPrice) * 100)
  return `
<!DOCTYPE html>
<html>
<body style="font-family:'Helvetica Neue',sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#2C1206">
  <h2 style="font-size:22px;font-weight:400;letter-spacing:0.02em;margin:0 0 8px">Price drop — ${product.title}</h2>
  <p style="font-size:14px;color:#9B7060;margin:0 0 24px">Saved from ${product.vendor || 'your bag'}</p>
  <div style="background:#F7F4F2;border-radius:12px;padding:20px 20px;margin-bottom:24px;display:flex;gap:16px;align-items:center">
    ${product.image_url ? `<img src="${product.image_url}" width="80" height="100" style="border-radius:6px;object-fit:cover;flex-shrink:0" />` : ''}
    <div>
      <div style="font-size:15px;font-weight:600;margin-bottom:6px">${product.title}</div>
      <div style="font-size:13px;color:#9B7060;margin-bottom:4px">Was <s>$${savedPrice}</s></div>
      <div style="font-size:18px;font-weight:700;color:#2C1206">$${currentPrice} <span style="font-size:13px;color:#3d7a3a;font-weight:600">↓ ${drop}% off</span></div>
    </div>
  </div>
  <a href="${product.store_url || APP_URL}" style="display:block;background:#2C1206;color:#fff;text-decoration:none;text-align:center;padding:14px;border-radius:10px;font-size:14px;font-weight:600;letter-spacing:0.01em">View on FROM →</a>
  <p style="font-size:11px;color:#9B7060;text-align:center;margin-top:20px">You saved this item to your FROM bag. <a href="${APP_URL}" style="color:#9B7060">Visit FROM</a></p>
</body>
</html>`
}

export async function GET(req: NextRequest) {
  // Verify cron secret to prevent unauthorized calls
  const authHeader = req.headers.get('authorization')
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let checked = 0
  let alerts = 0
  const errors: string[] = []

  try {
    const premiumUsers = await convex.query(api.shop.getPremiumSavedProductsForCron, {})

    for (const { email, products } of premiumUsers) {
      for (const product of products) {
        const savedPrice = typeof product.price === 'number' ? product.price : parseFloat(product.price)
        if (!savedPrice || isNaN(savedPrice)) continue

        const handle = product.store_url
          ? new URL(product.store_url).pathname.split('/products/')[1]?.split('?')[0]
          : undefined

        checked++
        const currentPrice = await fetchCurrentPrice(product.store_url, handle)
        if (currentPrice === null) continue

        const drop = (savedPrice - currentPrice) / savedPrice
        if (drop < PRICE_DROP_THRESHOLD) continue

        // Send price drop email
        try {
          await resend.emails.send({
            from: FROM_EMAIL,
            to: email,
            subject: `↓ ${Math.round(drop * 100)}% off — ${product.title?.slice(0, 50) || 'saved item'}`,
            html: priceDropEmail(product, currentPrice, savedPrice),
          })
          alerts++
        } catch (e: any) {
          errors.push(`email to ${email}: ${e.message}`)
        }
      }
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }

  return NextResponse.json({ checked, alerts, errors: errors.slice(0, 10) })
}
