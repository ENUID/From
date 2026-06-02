export type ExchangeRates = Record<string, number>;

const CACHE_KEY = 'fo_exchange_rates';
const CACHE_TTL = 3600 * 1000; // 1 hour

type CachedRates = {
  rates: ExchangeRates;
  timestamp: number;
};

// Global variable for server-side in-memory caching
let serverCache: CachedRates | null = null;

export async function getExchangeRates(): Promise<ExchangeRates> {
  const now = Date.now();

  // 1. Check server-side memory cache
  if (serverCache && now - serverCache.timestamp < CACHE_TTL) {
    return serverCache.rates;
  }

  try {
    const response = await fetch('https://open.er-api.com/v6/latest/USD', {
      next: { revalidate: 3600 }, // Next.js cache
      signal: AbortSignal.timeout(4000)
    });

    if (!response.ok) throw new Error('Failed to fetch exchange rates');

    const data = await response.json();
    const rates = data.rates as ExchangeRates;

    serverCache = {
      rates,
      timestamp: now,
    };

    return rates;
  } catch (error) {
    console.error('Exchange rate fetch error:', error);
    
    // Fallback to minimal hardcoded rates if API fails and no cache exists
    return serverCache?.rates || {
      USD: 1,
      EUR: 0.92,
      GBP: 0.79,
      JPY: 155,
      VND: 25450,
      CAD: 1.37,
      AUD: 1.52,
    };
  }
}
