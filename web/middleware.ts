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
  const hostname = request.headers.get('host') || ''

  // 1. Define your base domain (replace with your actual domain in production)
  // For Vercel, it often contains 'vercel.app' or your custom domain.
  const isMerchantSubdomain = hostname.startsWith('store.')
  const isBuyerSubdomain = hostname.startsWith('from.')
  const isOldBuyerSubdomain = hostname.startsWith('fo.')

  // Redirect old fo. subdomain to new from. subdomain
  if (isOldBuyerSubdomain) {
    return NextResponse.redirect(new URL(`https://from.enuid.com${url.pathname}${url.search}`, request.url))
  }

  // 2. Exclude internal paths, API routes, and static files from routing logic
  if (
    url.pathname.startsWith('/_next') ||
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/static') ||
    url.pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // 3. Merchant Subdomain Logic: store.enuid.com
  if (isMerchantSubdomain) {
    // If accessing root, rewrite to /merchant (landing page)
    if (url.pathname === '/' || url.pathname === '') {
      return withBuyerContext(request, NextResponse.rewrite(new URL('/merchant', request.url)))
    }
    
    // If the path doesn't start with /merchant or /api, rewrite it to include /merchant
    if (!url.pathname.startsWith('/merchant') && !url.pathname.startsWith('/api')) {
      const newUrl = new URL(`/merchant${url.pathname}`, request.url)
      return withBuyerContext(request, NextResponse.rewrite(newUrl))
    }

    return withBuyerContext(request, NextResponse.next())
  }

  // 4. Buyer Subdomain Logic: from.enuid.com
  if (isBuyerSubdomain) {
    // If buyer tries to access merchant-specific paths, redirect to merchant subdomain
    const merchantPaths = ['/merchant', '/dashboard', '/onboarding', '/stores', '/products', '/login']
    if (merchantPaths.some(path => url.pathname.startsWith(path))) {
      const newUrl = new URL(request.url)
      newUrl.hostname = hostname.replace('fo.', 'store.')
      
      // Ensure the path starts with /merchant if it doesn't already
      if (!newUrl.pathname.startsWith('/merchant')) {
        newUrl.pathname = `/merchant${newUrl.pathname}`
      }
      
      return withBuyerContext(request, NextResponse.redirect(newUrl))
    }
    return withBuyerContext(request, NextResponse.next())
  }

  // 5. Cross-Subdomain Protection for Custom Domain
  const isCustomDomain = hostname.includes('enuid.com')
  if (isCustomDomain && !isMerchantSubdomain && !isBuyerSubdomain) {
    // If somehow on enuid.com apex (though it should host another site), 
    // we don't interfere, but if it hits this project, redirect to buyer.
    const newUrl = new URL(request.url)
    newUrl.hostname = `fo.${hostname}`
    return withBuyerContext(request, NextResponse.redirect(newUrl))
  }

  return withBuyerContext(request, NextResponse.next())
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
