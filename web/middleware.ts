import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const url = request.nextUrl
  const hostname = request.headers.get('host') || ''

  // 1. Define your base domain (replace with your actual domain in production)
  // For Vercel, it often contains 'vercel.app' or your custom domain.
  const isMerchantSubdomain = hostname.startsWith('merchant.')

  // 2. Exclude internal paths, API routes, and static files from routing logic
  if (
    url.pathname.startsWith('/_next') ||
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/static') ||
    url.pathname.includes('.') // matches files like favicon.ico, images, etc.
  ) {
    return NextResponse.next()
  }

  // 3. Subdomain Logic: merchant.fluidorbit.app
  if (isMerchantSubdomain) {
    // If they are on the root of merchant subdomain, show the merchant home
    if (url.pathname === '/' || url.pathname === '') {
      return NextResponse.rewrite(new URL('/merchant', request.url))
    }
    // Other paths like /dashboard, /onboarding are already top-level,
    // so they will work naturally under the subdomain.
    return NextResponse.next()
  }

  // 4. Protection: If user tries to access merchant-related paths from the main domain
  const merchantPaths = ['/merchant', '/dashboard', '/onboarding']
  if (merchantPaths.some(path => url.pathname.startsWith(path))) {
    // ONLY redirect to subdomain if we are on a custom domain (non-vercel, non-localhost)
    const isCustomDomain = !hostname.includes('vercel.app') && !hostname.includes('localhost')
    
    if (isCustomDomain) {
      const newUrl = new URL(request.url)
      newUrl.hostname = `merchant.${newUrl.hostname}`
      return NextResponse.redirect(newUrl)
    }

    return NextResponse.next()
  }

  return NextResponse.next()
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
