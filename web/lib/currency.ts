import { ExchangeRates } from './exchangeRates';

const CURRENCY_LOCALES: Record<string, string> = {
  AED: 'en-AE', ARS: 'es-AR', AUD: 'en-AU', BDT: 'bn-BD',
  BRL: 'pt-BR', CAD: 'en-CA', CHF: 'de-CH', CLP: 'es-CL',
  CNY: 'zh-CN', COP: 'es-CO', CZK: 'cs-CZ', DKK: 'da-DK',
  EGP: 'ar-EG', EUR: 'de-DE', GBP: 'en-GB', GHS: 'en-GH',
  HKD: 'zh-HK', HUF: 'hu-HU', IDR: 'id-ID', ILS: 'he-IL',
  INR: 'en-IN', JPY: 'ja-JP', KES: 'sw-KE', KRW: 'ko-KR',
  KWD: 'ar-KW', MXN: 'es-MX', MYR: 'ms-MY', NGN: 'en-NG',
  NOK: 'nb-NO', NZD: 'en-NZ', PEN: 'es-PE', PHP: 'en-PH',
  PKR: 'ur-PK', PLN: 'pl-PL', QAR: 'ar-QA', RON: 'ro-RO',
  SAR: 'ar-SA', SEK: 'sv-SE', SGD: 'en-SG', THB: 'th-TH',
  TRY: 'tr-TR', TWD: 'zh-TW', USD: 'en-US', VND: 'vi-VN',
  ZAR: 'en-ZA',
}

function normalizeCurrencyCode(code?: string | null) {
  return String(code ?? '').trim().toUpperCase()
}

export function isSupportedCurrency(code: string | null, rates?: ExchangeRates) {
  const normalized = normalizeCurrencyCode(code)
  if (!normalized) return false
  if (rates) return Boolean(rates[normalized])
  return normalized.length === 3
}

export function convertCurrencyAmount(
  amount: number,
  fromCurrency: string | null | undefined,
  toCurrency: string | null | undefined,
  rates?: ExchangeRates,
) {
  const safeAmount = Number(amount)
  if (!Number.isFinite(safeAmount)) return 0

  const from = normalizeCurrencyCode(fromCurrency) || 'USD'
  const to = normalizeCurrencyCode(toCurrency) || from

  if (from === to) return safeAmount
  if (!rates) return safeAmount

  const fromRate = rates[from]
  const toRate = rates[to]
  
  if (!fromRate || !toRate) return safeAmount

  return (safeAmount / fromRate) * toRate
}

export function formatMoney(
  amount: number,
  currency: string | null | undefined,
  baseCurrency: string | null | undefined,
  rates?: ExchangeRates,
) {
  const normalizedCurrency = normalizeCurrencyCode(currency) || 'USD'
  const normalizedBaseCurrency = normalizeCurrencyCode(baseCurrency) || normalizedCurrency
  
  const convertedAmount = convertCurrencyAmount(amount, normalizedBaseCurrency, normalizedCurrency, rates)
  const locale = CURRENCY_LOCALES[normalizedCurrency] || 'en-US'

  // Currencies that conventionally display without decimal places
  const ZERO_DECIMAL = new Set(['VND', 'JPY', 'KRW', 'IDR', 'CLP', 'HUF', 'TWD', 'BIF', 'GNF', 'ISK', 'KMF', 'PYG', 'RWF', 'UGX', 'XAF', 'XOF'])
  const decimals = ZERO_DECIMAL.has(normalizedCurrency) ? 0 : 2
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: normalizedCurrency,
      maximumFractionDigits: decimals,
    }).format(convertedAmount)
  } catch {
    return `${normalizedCurrency} ${convertedAmount.toFixed(decimals)}`
  }
}
