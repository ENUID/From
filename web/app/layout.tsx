import type { Metadata, Viewport } from 'next'
import './globals.css'
import AuthProvider from '@/components/AuthProvider'
import ConvexClientProvider from '@/components/ConvexClientProvider'
import { Analytics } from '@vercel/analytics/next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const metadata: Metadata = {
  title: 'FROM — Be Different',
  description: 'AI fashion search across 450+ independent stores. Describe what you want, discover something you\'ll actually wear.',
  metadataBase: new URL('https://from.enuid.com'),
  openGraph: {
    title: 'FROM — Be Different',
    description: 'AI fashion search across 450+ independent stores. Describe what you want, discover something you\'ll actually wear.',
    url: 'https://from.enuid.com',
    siteName: 'FROM',
    images: [
      {
        url: '/og.jpg',
        width: 1100,
        height: 880,
        alt: 'FROM',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FROM — Be Different',
    description: 'AI fashion search across 450+ independent stores. Describe what you want, discover something you\'ll actually wear.',
    images: ['/og.jpg'],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)

  return (
    <html lang="en">
      <head>
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        {/* Preload TAN Meringue so it's ready before first paint — eliminates fallback flash */}
        <link rel="preload" href="/fonts/TANMeringue.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=DM+Mono:wght@300;400&family=Outfit:wght@200;300;400&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&family=Geist:wght@300;400;500;600&family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ConvexClientProvider>
          <AuthProvider session={session}>{children}</AuthProvider>
        </ConvexClientProvider>
        <Analytics />
      </body>
    </html>
  )
}
