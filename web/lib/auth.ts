import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../convex/_generated/api'

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
    // Email OTP (verification code) sign-in
    CredentialsProvider({
      id: 'email-otp',
      name: 'Email OTP',
      credentials: {
        email: { label: 'Email', type: 'email' },
        code: { label: 'Code', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.code) {
          throw new Error('Email and code required')
        }

        try {
          const convex = getConvex()
          const valid = await convex.mutation(api.verificationCodes.verifyAndConsumeCode, {
            email: credentials.email.toLowerCase().trim(),
            code: credentials.code.trim(),
          })
          if (!valid) throw new Error('Invalid or expired code')
          await convex.mutation(api.users.ensureUser, {
            email: credentials.email.toLowerCase().trim(),
          })
          const user = await convex.query(api.users.getUserByEmail, {
            email: credentials.email.toLowerCase().trim(),
          }) as any
          return { id: user?._id ?? credentials.email, name: user?.name ?? null, email: credentials.email.toLowerCase().trim() }
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
            authorization: {
              params: {
                prompt: 'select_account',
                access_type: 'offline',
                response_type: 'code',
              },
            },
          }),
        ]
      : []),
  ],

  pages: {
    signIn: '/',
    error: '/',
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
    async signIn({ user }) {
      if (user?.email) {
        try {
          const convex = getConvex()
          await convex.mutation(api.users.ensureUser, {
            email: user.email,
            name: user.name || undefined,
            image: user.image || undefined,
          })
        } catch (err) {
          console.error('Failed to sync user to Convex:', err)
        }
      }
      return true
    },
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
        ? '__Secure-from.session-token'
        : 'from.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        domain: cookieDomain,
      },
    },
    callbackUrl: {
      name: process.env.NODE_ENV === 'production'
        ? '__Secure-from.callback-url'
        : 'from.callback-url',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        domain: cookieDomain,
      },
    },
    csrfToken: {
      name: process.env.NODE_ENV === 'production'
        ? '__Secure-from.csrf-token'
        : 'from.csrf-token',
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
