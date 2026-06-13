import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ConvexHttpClient } from 'convex/browser'
import { anyApi } from 'convex/server'

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

function parseDevice(ua: string): { deviceType: string; browser: string; os: string } {
  const deviceType = /Mobile|Android|iPhone|iPad/i.test(ua)
    ? /iPad/i.test(ua) ? 'tablet' : 'mobile'
    : 'desktop'

  const browser =
    /Edg\//i.test(ua) ? 'Edge' :
    /OPR|Opera/i.test(ua) ? 'Opera' :
    /Chrome/i.test(ua) ? 'Chrome' :
    /Firefox/i.test(ua) ? 'Firefox' :
    /Safari/i.test(ua) ? 'Safari' : 'Other'

  const os =
    /Windows NT/i.test(ua) ? 'Windows' :
    /Mac OS X/i.test(ua) ? 'macOS' :
    /Android/i.test(ua) ? 'Android' :
    /iPhone|iPad/i.test(ua) ? 'iOS' :
    /Linux/i.test(ua) ? 'Linux' : 'Other'

  return { deviceType, browser, os }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const email = session?.user?.email
    if (!email) return NextResponse.json({ ok: false }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const { consentAnalytics, consentLocation, lat, lng } = body

    // IP from request headers (Vercel sets x-forwarded-for)
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      '0.0.0.0'

    const ua = req.headers.get('user-agent') || ''
    const language = req.headers.get('accept-language')?.split(',')[0]?.split(';')[0]?.trim() || ''
    const { deviceType, browser, os } = parseDevice(ua)

    // Geo lookup from IP (free, no key required, 45 req/min limit)
    let country = '', countryCode = '', city = '', timezone = ''
    if (ip && ip !== '0.0.0.0' && ip !== '127.0.0.1' && ip !== '::1') {
      try {
        const geo = await Promise.race([
          fetch(`https://ipapi.co/${ip}/json/`).then(r => r.json()),
          new Promise((_, reject) => setTimeout(() => reject('timeout'), 2000)),
        ]) as any
        country = geo?.country_name || ''
        countryCode = geo?.country_code || ''
        city = geo?.city || ''
        timezone = geo?.timezone || ''
      } catch { /* geo lookup is best-effort */ }
    }

    // Save consent flags first
    await convex.mutation(anyApi.users.recordConsent, {
      email,
      consentAnalytics: consentAnalytics ?? false,
      consentLocation: consentLocation ?? false,
    })

    // Save identity data if analytics consent given
    if (consentAnalytics) {
      await convex.mutation(anyApi.users.recordIdentity, {
        email,
        country,
        countryCode,
        city,
        timezone,
        lat: consentLocation && lat ? Number(lat) : undefined,
        lng: consentLocation && lng ? Number(lng) : undefined,
        deviceType,
        browser,
        os,
        language,
        ipAddress: ip !== '0.0.0.0' ? ip : undefined,
      })
    }

    return NextResponse.json({ ok: true, country, city, deviceType })
  } catch (err) {
    console.error('[identify]', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
