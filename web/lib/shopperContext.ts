export const SHOPPER_COUNTRY_COOKIE = 'fo_buyer_country'
export const SHOPPER_CURRENCY_COOKIE = 'fo_buyer_currency'

export type ShopperContext = {
  country: string
  currency: string
  source: 'geo' | 'locale' | 'cookie' | 'default'
}

const EURO_COUNTRIES = new Set([
  'AT', 'BE', 'CY', 'DE', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'IE', 'IT',
  'LT', 'LU', 'LV', 'MT', 'NL', 'PT', 'SI', 'SK',
])

import getCurrency from 'country-to-currency';

function normalizeCode(value?: string | null) {
  return String(value ?? '').trim().toUpperCase()
}

export function currencyForCountry(country?: string | null) {
  const normalizedCountry = normalizeCode(country);
  if (!normalizedCountry) return 'USD';

  try {
    const currency = (getCurrency as Record<string, string>)[normalizedCountry];
    return currency || 'USD';
  } catch (error) {
    return 'USD';
  }
}

export function countryFromAcceptLanguage(headerValue?: string | null) {
  const raw = String(headerValue ?? '').trim()
  if (!raw) return ''

  const firstLocale = raw.split(',')[0]?.trim()
  if (!firstLocale) return ''

  const regionMatch = firstLocale.match(/[-_]([A-Za-z]{2})\b/)
  return normalizeCode(regionMatch?.[1])
}

export function resolveShopperContext(input: {
  countryHeader?: string | null
  acceptLanguage?: string | null
  cookieCountry?: string | null
  cookieCurrency?: string | null
}): ShopperContext {
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
