import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'
import AuthProvider from '@/components/AuthProvider'
import ConvexClientProvider from '@/components/ConvexClientProvider'

export const metadata: Metadata = {
  title: 'From - Shop Independent',
  description: 'Search across independent stores through natural language. Describe what you need and discover unique finds from verified shops.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
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
          <AuthProvider>{children}</AuthProvider>
        </ConvexClientProvider>
        <Script 
          src="https://s.skimresources.com/js/303928X1792065.skimlinks.js" 
          strategy="afterInteractive" 
        />
      </body>
    </html>
  )
}
