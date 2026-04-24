import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'

const SESSION_MAX_AGE = 60 * 60 * 24 * 30

function getCookieDomain() {
  const explicit = process.env.NEXTAUTH_COOKIE_DOMAIN?.trim()
  if (explicit) return explicit

  const baseUrl = process.env.NEXTAUTH_URL?.trim()
  if (!baseUrl) return undefined

  try {
    const hostname = new URL(baseUrl).hostname
    if (
      hostname === 'localhost' ||
      /^\d+\.\d+\.\d+\.\d+$/.test(hostname) ||
      hostname.endsWith('.vercel.app')
    ) {
      return undefined
    }

    const parts = hostname.split('.')
    if (parts.length < 2) return undefined
    return `.${parts.slice(-2).join('.')}`
  } catch {
    return undefined
  }
}

const cookieDomain = getCookieDomain()

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  pages: {
    signIn: '/merchant/login',
    error: '/merchant/login',
  },

  session: {
    strategy: 'jwt',
    maxAge: SESSION_MAX_AGE,
    updateAge: 60 * 60 * 24,
  },

  jwt: {
    maxAge: SESSION_MAX_AGE,
  },

  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub
      }
      return session
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith(baseUrl)) return url
      if (url.startsWith('/')) return `${baseUrl}${url}`
      return `${baseUrl}/merchant/stores`
    },
  },

  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production'
        ? '__Secure-next-auth.session-token'
        : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        domain: cookieDomain,
      },
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
}
