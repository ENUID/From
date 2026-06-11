import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import { ConvexHttpClient } from 'convex/browser'
import bcrypt from 'bcryptjs'
import { api } from '../convex/_generated/api'

function getConvex() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!url) throw new Error('NEXT_PUBLIC_CONVEX_URL is not set')
  return new ConvexHttpClient(url)
}

const SESSION_MAX_AGE = 60 * 60 * 24 * 30

// Cookie name prefix — set NEXTAUTH_COOKIE_PREFIX in env to customise (e.g. "from", "myapp").
// Leave unset to use NextAuth defaults.
const COOKIE_PREFIX = process.env.NEXTAUTH_COOKIE_PREFIX
const isProd = process.env.NODE_ENV === 'production'

// Cookie domain — set NEXTAUTH_COOKIE_DOMAIN in env (e.g. ".enuid.com" for all subdomains).
// Leave unset to let the browser use the current hostname automatically.
const COOKIE_DOMAIN = process.env.NEXTAUTH_COOKIE_DOMAIN || undefined

function makeCookies(): NextAuthOptions['cookies'] {
  if (!COOKIE_PREFIX) return undefined
  const secure = isProd ? '__Secure-' : ''
  const opts = (httpOnly: boolean) => ({
    httpOnly,
    sameSite: 'lax' as const,
    path: '/',
    secure: isProd,
    ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
  })
  return {
    sessionToken: {
      name: `${secure}${COOKIE_PREFIX}.session-token`,
      options: opts(true),
    },
    callbackUrl: {
      name: `${secure}${COOKIE_PREFIX}.callback-url`,
      options: opts(false),
    },
    csrfToken: {
      name: `${COOKIE_PREFIX}.csrf-token`,
      options: opts(false),
    },
  }
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
          if (!user) throw new Error('No account found with this email')
          const isPasswordValid = await bcrypt.compare(credentials.password, user.passwordHash)
          if (!isPasswordValid) throw new Error('Invalid password')
          return { id: user._id, name: user.name, email: user.email }
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

  cookies: makeCookies(),

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
      if (user) token.id = user.id ?? token.id ?? token.sub
      return token
    },
    async session({ session, token }) {
      if (session.user) session.user.id = (token.id ?? token.sub) as string
      return session
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith('/')) return `${baseUrl}${url}`
      if (url.startsWith(baseUrl)) return url
      try {
        const { hostname } = new URL(url)
        if (hostname === 'from.enuid.com' || hostname.endsWith('.enuid.com')) return url
      } catch {}
      return `${baseUrl}/`
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
}
