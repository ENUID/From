const USD_RATES: Record<string, number> = {
  USD: 1,
  AED: 3.6725,
  AUD: 1.53,
  CAD: 1.37,
  CHF: 0.91,
  CNY: 7.24,
  EUR: 0.93,
  GBP: 0.8,
  HKD: 7.81,
  INR: 83.4,
  JPY: 151.2,
  KRW: 1365,
  MXN: 16.8,
  NOK: 10.8,
  NZD: 1.68,
  SAR: 3.75,
  SEK: 10.6,
  SGD: 1.35,
}

const CURRENCY_LOCALES: Record<string, string> = {
  USD: 'en-US',
  AED: 'en-AE',
  AUD: 'en-AU',
  CAD: 'en-CA',
  CHF: 'de-CH',
  CNY: 'zh-CN',
  EUR: 'de-DE',
  GBP: 'en-GB',
  HKD: 'zh-HK',
  INR: 'en-IN',
  JPY: 'ja-JP',
  KRW: 'ko-KR',
  MXN: 'es-MX',
  NOK: 'nb-NO',
  NZD: 'en-NZ',
  SAR: 'ar-SA',
  SEK: 'sv-SE',
  SGD: 'en-SG',
}

function normalizeCurrencyCode(code?: string | null) {
  return String(code ?? '').trim().toUpperCase()
}

export function isSupportedCurrency(code?: string | null) {
  const normalized = normalizeCurrencyCode(code)
  return Boolean(normalized && USD_RATES[normalized])
}

export function convertCurrencyAmount(
  amount: number,
  fromCurrency?: string | null,
  toCurrency?: string | null,
) {
  const safeAmount = Number(amount)
  if (!Number.isFinite(safeAmount)) return 0

  const from = normalizeCurrencyCode(fromCurrency) || 'USD'
  const to = normalizeCurrencyCode(toCurrency) || from

  if (from === to) return safeAmount

  const fromRate = USD_RATES[from]
  const toRate = USD_RATES[to]
  if (!fromRate || !toRate) return safeAmount

  return (safeAmount / fromRate) * toRate
}

export function formatMoney(
  amount: number,
  currency?: string | null,
  baseCurrency?: string | null,
) {
  const normalizedCurrency = normalizeCurrencyCode(currency) || 'USD'
  const normalizedBaseCurrency = normalizeCurrencyCode(baseCurrency) || normalizedCurrency
  const convertedAmount = convertCurrencyAmount(amount, normalizedBaseCurrency, normalizedCurrency)
  const locale = CURRENCY_LOCALES[normalizedCurrency] ?? 'en-US'

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: normalizedCurrency,
      maximumFractionDigits: 2,
    }).format(convertedAmount)
  } catch {
    return `${normalizedCurrency} ${convertedAmount.toFixed(2)}`
  }
}
