import { cookies, headers } from 'next/headers'
import BuyerWorkspacePage from '@/features/buyer/BuyerWorkspacePage'
import {
  BUYER_COUNTRY_COOKIE,
  BUYER_CURRENCY_COOKIE,
  resolveBuyerContext,
} from '@/lib/buyerContext'

export default async function Page() {
  const headerStore = await headers()
  const cookieStore = await cookies()

  const buyerContext = resolveBuyerContext({
    countryHeader: headerStore.get('x-vercel-ip-country'),
    acceptLanguage: headerStore.get('accept-language'),
    cookieCountry: cookieStore.get(BUYER_COUNTRY_COOKIE)?.value,
    cookieCurrency: cookieStore.get(BUYER_CURRENCY_COOKIE)?.value,
  })

  return <BuyerWorkspacePage initialBuyerContext={buyerContext} />
}
