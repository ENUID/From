import { NextRequest, NextResponse } from 'next/server'
import { randomInt } from 'crypto'
import { ConvexHttpClient } from 'convex/browser'
import { Resend } from 'resend'
import { api } from '@/convex/_generated/api'

export const runtime = 'nodejs'

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'FROM <noreply@from.enuid.com>'

function generateCode(): string {
  return String(randomInt(100000, 1000000))
}

function codeEmail(code: string): string {
  return `<!DOCTYPE html>
<html>
<body style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:420px;margin:0 auto;padding:40px 24px;color:#2C1206;background:#fff">
  <div style="margin-bottom:28px">
    <span style="font-size:20px;font-weight:400;letter-spacing:0.04em">FROM</span>
  </div>
  <h2 style="font-size:22px;font-weight:400;margin:0 0 10px;letter-spacing:0.01em">Your sign-in code</h2>
  <p style="font-size:14px;color:#9B7060;margin:0 0 28px;line-height:1.6">Enter this code to sign in to FROM. It expires in 15 minutes.</p>
  <div style="background:#F7F4F2;border-radius:12px;padding:20px;text-align:center;margin-bottom:28px">
    <span style="font-size:36px;font-weight:700;letter-spacing:0.25em;color:#2C1206">${code}</span>
  </div>
  <p style="font-size:12px;color:#9B7060;line-height:1.6;margin:0">If you didn't request this, you can ignore this email. Your account is secure.</p>
</body>
</html>`
}

export async function POST(req: NextRequest) {
  // Guard: surface missing config immediately instead of cryptic "Internal error"
  if (!process.env.RESEND_API_KEY) {
    console.error('[send-code] RESEND_API_KEY is not set')
    return NextResponse.json({ error: 'Email service not configured' }, { status: 503 })
  }
  if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
    console.error('[send-code] NEXT_PUBLIC_CONVEX_URL is not set')
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL)
  const resend = new Resend(process.env.RESEND_API_KEY)
  try {
    const { email } = await req.json()
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()
    const code = generateCode()

    try {
      await convex.mutation(api.verificationCodes.createCode, {
        email: normalizedEmail,
        code,
      })
    } catch (e: any) {
      // Convex errors can be structured differently — extract message from all known shapes
      const msg: string = e?.message || e?.data?.message || (typeof e?.data === 'string' ? e.data : '') || ''
      const detail = msg || String(e) || 'unknown'
      console.error('[send-code] createCode failed:', detail, e)
      if (msg.toLowerCase().includes('wait') || msg.toLowerCase().includes('moment')) {
        return NextResponse.json({ error: 'Please wait 60 seconds before requesting a new code.' }, { status: 429 })
      }
      return NextResponse.json({ error: `Sign-in error: ${detail}` }, { status: 500 })
    }

    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `${code} — your FROM sign-in code`,
      html: codeEmail(code),
    })

    if (error) {
      console.error('[send-code] Resend error:', error)
      // Delete the code we just created so the user can retry immediately
      try { await convex.mutation(api.verificationCodes.deleteCode, { email: normalizedEmail }) } catch {}
      const msg = (error as any)?.message ?? JSON.stringify(error)
      return NextResponse.json({ error: `Email could not be sent. Check your Resend configuration. (${msg})` }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[send-code]', err)
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
  }
}
