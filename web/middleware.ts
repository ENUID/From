import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  SHOPPER_COUNTRY_COOKIE,
  SHOPPER_CURRENCY_COOKIE,
  resolveShopperContext,
} from '@/lib/shopperContext'

function withShopperContext(request: NextRequest, response: NextResponse) {
  const context = resolveShopperContext({
    countryHeader: request.headers.get('x-vercel-ip-country'),
    acceptLanguage: request.headers.get('accept-language'),
    cookieCountry: request.cookies.get(SHOPPER_COUNTRY_COOKIE)?.value,
    cookieCurrency: request.cookies.get(SHOPPER_CURRENCY_COOKIE)?.value,
  })

  response.cookies.set(SHOPPER_COUNTRY_COOKIE, context.country, {
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
  })
  response.cookies.set(SHOPPER_CURRENCY_COOKIE, context.currency, {
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
  })

  return response
}

export function middleware(request: NextRequest) {
  const url = request.nextUrl

  if (
    url.pathname.startsWith('/_next') ||
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/static') ||
    url.pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  return withShopperContext(request, NextResponse.next())
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
