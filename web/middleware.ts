import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  BUYER_COUNTRY_COOKIE,
  BUYER_CURRENCY_COOKIE,
  resolveBuyerContext,
} from '@/lib/buyerContext'

function withBuyerContext(request: NextRequest, response: NextResponse) {
  const context = resolveBuyerContext({
    countryHeader: request.headers.get('x-vercel-ip-country'),
    acceptLanguage: request.headers.get('accept-language'),
    cookieCountry: request.cookies.get(BUYER_COUNTRY_COOKIE)?.value,
    cookieCurrency: request.cookies.get(BUYER_CURRENCY_COOKIE)?.value,
  })

  response.cookies.set(BUYER_COUNTRY_COOKIE, context.country, {
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
  })
  response.cookies.set(BUYER_CURRENCY_COOKIE, context.currency, {
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

  return withBuyerContext(request, NextResponse.next())
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
