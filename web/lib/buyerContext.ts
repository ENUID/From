export const BUYER_COUNTRY_COOKIE = 'fo_buyer_country'
export const BUYER_CURRENCY_COOKIE = 'fo_buyer_currency'

export type BuyerContext = {
  country: string
  currency: string
  source: 'geo' | 'locale' | 'cookie' | 'default'
}

const EURO_COUNTRIES = new Set([
  'AT', 'BE', 'CY', 'DE', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'IE', 'IT',
  'LT', 'LU', 'LV', 'MT', 'NL', 'PT', 'SI', 'SK',
])

const COUNTRY_TO_CURRENCY: Record<string, string> = {
  AE: 'AED',
  AU: 'AUD',
  CA: 'CAD',
  CH: 'CHF',
  CN: 'CNY',
  GB: 'GBP',
  HK: 'HKD',
  IN: 'INR',
  JP: 'JPY',
  KR: 'KRW',
  MX: 'MXN',
  NO: 'NOK',
  NZ: 'NZD',
  SA: 'SAR',
  SE: 'SEK',
  SG: 'SGD',
  US: 'USD',
}

function normalizeCode(value?: string | null) {
  return String(value ?? '').trim().toUpperCase()
}

export function currencyForCountry(country?: string | null) {
  const normalizedCountry = normalizeCode(country)
  if (!normalizedCountry) return 'USD'
  if (EURO_COUNTRIES.has(normalizedCountry)) return 'EUR'
  return COUNTRY_TO_CURRENCY[normalizedCountry] ?? 'USD'
}

export function countryFromAcceptLanguage(headerValue?: string | null) {
  const raw = String(headerValue ?? '').trim()
  if (!raw) return ''

  const firstLocale = raw.split(',')[0]?.trim()
  if (!firstLocale) return ''

  const regionMatch = firstLocale.match(/[-_]([A-Za-z]{2})\b/)
  return normalizeCode(regionMatch?.[1])
}

export function resolveBuyerContext(input: {
  countryHeader?: string | null
  acceptLanguage?: string | null
  cookieCountry?: string | null
  cookieCurrency?: string | null
}): BuyerContext {
  const headerCountry = normalizeCode(input.countryHeader)
  if (headerCountry) {
    return {
      country: headerCountry,
      currency: currencyForCountry(headerCountry),
      source: 'geo',
    }
  }

  const cookieCountry = normalizeCode(input.cookieCountry)
  const cookieCurrency = normalizeCode(input.cookieCurrency)
  if (cookieCountry && cookieCurrency) {
    return {
      country: cookieCountry,
      currency: cookieCurrency,
      source: 'cookie',
    }
  }

  const localeCountry = countryFromAcceptLanguage(input.acceptLanguage)
  if (localeCountry) {
    return {
      country: localeCountry,
      currency: currencyForCountry(localeCountry),
      source: 'locale',
    }
  }

  return {
    country: 'US',
    currency: 'USD',
    source: 'default',
  }
}
