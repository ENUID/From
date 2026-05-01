import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import { ConvexHttpClient } from 'convex/browser'
import bcrypt from 'bcryptjs'
import { api } from './convexApi'

function getConvex() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!url) throw new Error('NEXT_PUBLIC_CONVEX_URL is not set')
  return new ConvexHttpClient(url)
}

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

function getSafeDefaultRedirect(baseUrl: string) {
  return `${baseUrl}/`
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Please enter email and password')
        }

        try {
          const convex = getConvex()
          const user = await convex.query(api.users.getUserByEmail, {
            email: credentials.email.toLowerCase().trim(),
          }) as any

          if (!user) {
            throw new Error('No account found with this email')
          }

          const isPasswordValid = await bcrypt.compare(
            credentials.password,
            user.passwordHash
          )

          if (!isPasswordValid) {
            throw new Error('Invalid password')
          }

          return {
            id: user._id,
            name: user.name,
            email: user.email,
          }
        } catch (err: any) {
          throw new Error(err.message || 'Authentication failed')
        }
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
  ],

  pages: {
    signIn: '/signin',
    error: '/signin',
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
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id ?? token.id ?? token.sub
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id ?? token.sub) as string
      }
      return session
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith(baseUrl)) return url
      if (url.startsWith('/')) return `${baseUrl}${url}`
      return getSafeDefaultRedirect(baseUrl)
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
