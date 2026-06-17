import { cookies, headers } from 'next/headers'
import FromPage from '@/features/from/FromPage'
import BottomNav from '@/components/BottomNav'
import {
  SHOPPER_COUNTRY_COOKIE,
  SHOPPER_CURRENCY_COOKIE,
  resolveShopperContext,
} from '@/lib/shopperContext'
import { getExchangeRates } from '@/lib/exchangeRates'

export default async function Page() {
  const headerStore = await headers()
  const cookieStore = await cookies()

  const shopperContext = resolveShopperContext({
    countryHeader: headerStore.get('x-vercel-ip-country'),
    acceptLanguage: headerStore.get('accept-language'),
    cookieCountry: cookieStore.get(SHOPPER_COUNTRY_COOKIE)?.value,
    cookieCurrency: cookieStore.get(SHOPPER_CURRENCY_COOKIE)?.value,
  })

  const rates = await getExchangeRates()

  return (
    <>
      <FromPage
        initialShopperContext={shopperContext}
        initialRates={rates}
      />
      <BottomNav active="search" />
    </>
  )
}
