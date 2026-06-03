import { getExchangeRates } from '../exchangeRates';

export type UcpProduct = {
  id: string;
  title: string;
  vendor: string;
  price: number;
  currency: string;
  store_url: string;
  image_url: string;
  in_stock: boolean;
  tags: string[];
  description?: string;
  options?: { name: string; values: string[] }[];
  media?: Array<{ type: string; url: string }>;
  variants?: Array<{
    id: string;
    title: string;
    price: number;
    availability: boolean;
    options: Array<{ name: string; label: string }>;
    media?: Array<{ url: string }>;
  }>;
}

type ProductSort = 'price_asc' | 'price_desc' | 'relevance';

type CatalogSearchFilters = {
  budgetMax?: number | null;
  budgetCurrency?: string | null;
  excludeIds?: string[];
  mandatoryConcepts?: string[][];
  sort?: ProductSort;
  limit: number;
  rates: Record<string, number>;
};

export type CatalogSearchDebug = {
  catalogFetched?: boolean;
  loadMorePage?: number;
  loadMoreQuery?: string;
};

type CatalogSearchOptions = {
  refreshReserve?: boolean;
  fastFirstPage?: boolean;
  loadMore?: boolean;
  debug?: CatalogSearchDebug;
};

const CACHE_TTL_MS = 15 * 60 * 1000;
const FAST_PAGE_LIMIT = 24;
const CATALOG_PAGE_LIMIT = 30;
const REFRESH_PAGE_LIMIT = 60;
const FAST_SUBQUERY_LIMIT = 3;
const INITIAL_RESULT_LIMIT = 20;
const LOAD_MORE_RESULT_LIMIT = 10;
const searchCache = new Map<string, { timestamp: number, products: UcpProduct[] }>();

const COUNTRY_MAP: { [key: string]: string } = {
  IN: 'India',
  VN: 'Vietnam',
  US: 'United States',
  GB: 'United Kingdom',
  CA: 'Canada',
  AU: 'Australia',
  JP: 'Japan',
  KR: 'Korea',
  SG: 'Singapore',
  FR: 'France',
  DE: 'Germany',
  IT: 'Italy',
  ES: 'Spain'
};

const ZERO_DECIMAL_CURRENCIES = new Set(['VND', 'JPY', 'KRW']);

function normalizeCatalogQuery(query: string) {
  return query.trim().replace(/\s+/g, ' ');
}

function splitCatalogQuery(query: string) {
  return normalizeCatalogQuery(query)
    .split(/\s+OR\s+/i)
    .map(part => part.trim())
    .filter(Boolean)
    .slice(0, 6);
}

function uniqueById<T extends { id?: string }>(items: T[]) {
  const seen = new Set<string>();
  const unique: T[] = [];

  for (const item of items) {
    if (!item.id || seen.has(item.id)) continue;
    seen.add(item.id);
    unique.push(item);
  }

  return unique;
}

function normalizeImageUrl(url?: string): string {
  if (!url) return '';
  let normalized = url.startsWith('//') ? `https:${url}` : url;
  if (normalized.includes('cdn.shopify.com')) {
    try {
      const urlObj = new URL(normalized);
      urlObj.searchParams.set('width', '400');
      normalized = urlObj.toString();
    } catch {}
  }
  return normalized;
}

function normalizeCurrency(code?: string | null) {
  return String(code || 'USD').trim().toUpperCase() || 'USD';
}

function convertProductPrice(product: UcpProduct, targetCurrency: string, rates: Record<string, number>) {
  const currency = (product.currency || 'USD').toUpperCase();
  const target = normalizeCurrency(targetCurrency);
  if (currency === target) return product.price;

  const productRate = rates[currency];
  const targetRate = rates[target];
  if (!productRate || !targetRate) return product.price;

  return (product.price / productRate) * targetRate;
}



function searchableProductText(product: UcpProduct) {
  return [
    product.title,
    product.description,
    product.vendor,
    ...(product.tags || []),
    ...(product.options?.flatMap(option => [option.name, ...option.values]) || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function applyCatalogFilters(products: UcpProduct[], filters: CatalogSearchFilters) {
  const excludeIds = new Set(filters.excludeIds || []);
  const sort = filters.sort || 'price_asc';
  const budgetCurrency = normalizeCurrency(filters.budgetCurrency);

  let filtered = products.filter(product => {
    if (excludeIds.has(product.id)) return false;
    if (
      filters.budgetMax &&
      filters.budgetMax > 0 &&
      convertProductPrice(product, budgetCurrency, filters.rates) > filters.budgetMax
    ) {
      return false;
    }

    if (filters.mandatoryConcepts && filters.mandatoryConcepts.length > 0) {
      const text = searchableProductText(product);
      const matchesAllConcepts = filters.mandatoryConcepts.every(conceptGroup => {
        if (!conceptGroup || conceptGroup.length === 0) return true;
        return conceptGroup.some(word => text.includes(word.toLowerCase().trim()));
      });
      if (!matchesAllConcepts) return false;
    }

    return true;
  });

  if (sort !== 'relevance') {
    filtered = [...filtered].sort((a, b) => {
      const priceA = convertProductPrice(a, budgetCurrency, filters.rates);
      const priceB = convertProductPrice(b, budgetCurrency, filters.rates);
      return sort === 'price_desc' ? priceB - priceA : priceA - priceB;
    });
  }

  return filtered.slice(0, filters.limit);
}

function applyCatalogFiltersWithRetry(products: UcpProduct[], filters: CatalogSearchFilters) {
  let result = applyCatalogFilters(products, filters);
  if (result.length > 0) return result;

  if (filters.budgetMax && filters.budgetMax > 0) {
    result = applyCatalogFilters(products, {
      ...filters,
      budgetMax: null,
    });
    if (result.length > 0) {
      console.log('[GlobalCatalog] relaxed budget filter');
      return result;
    }
  }

  return [];
}

export class GlobalCatalogService {
  static async search(
    query: string, 
    budgetMax?: number | null, 
    excludeIds: string[] = [], 
    countryCode?: string | null,
    isClothing?: boolean,
    mandatoryConcepts: string[][] = [],
    sort: ProductSort = 'price_asc',
    budgetCurrency: string | null = 'USD',
    options: CatalogSearchOptions = {}
  ): Promise<UcpProduct[]> {
    const isFastFirstPage = Boolean(options.fastFirstPage && !options.refreshReserve);
    const limit = options.loadMore || options.refreshReserve
      ? LOAD_MORE_RESULT_LIMIT
      : INITIAL_RESULT_LIMIT;
    const catalogPageLimit = options.refreshReserve
      ? REFRESH_PAGE_LIMIT
      : isFastFirstPage
        ? FAST_PAGE_LIMIT
        : CATALOG_PAGE_LIMIT;
    const normalizedQuery = normalizeCatalogQuery(query);
    if (!normalizedQuery) return [];

    const normalizedCountryCode = countryCode?.trim().toUpperCase() || null;
    const cacheKey = `${normalizedQuery.toLowerCase()}:${normalizedCountryCode || 'global'}`;
    const cached = searchCache.get(cacheKey);
    const rates = await getExchangeRates().catch(() => ({} as Record<string, number>));

    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      const filteredCache = applyCatalogFilters(cached.products, {
        budgetMax,
        budgetCurrency,
        excludeIds,
        mandatoryConcepts,
        sort,
        limit,
        rates,
      });
      
      if (filteredCache.length >= limit || (!options.refreshReserve && filteredCache.length > 0)) {
        console.log(`[GlobalCatalog] cache hit for "${cacheKey}" (${filteredCache.length} products)`);
        return filteredCache;
      }
    }

    if (options.loadMore || options.refreshReserve) {
      console.log(`[GlobalCatalog] catalog fetch (loadMore=${Boolean(options.loadMore)}, refresh=${Boolean(options.refreshReserve)})`);
      if (options.debug) options.debug.catalogFetched = true;
    }

    const catalogTimeoutMs = isFastFirstPage ? 6000 : 8000;

    const fetchFromCatalog = async (q: string) => {
      const filters: any = { available: true };
      if (normalizedCountryCode) {
        filters.ships_to = { country: normalizedCountryCode };
      }

      const payload = {
        jsonrpc: "2.0",
        method: "tools/call",
        id: "1",
        params: {
          name: "search_catalog",
          arguments: {
            meta: {
              "ucp-agent": {
                profile: "https://shopify.dev/ucp/agent-profiles/2026-04-08/valid-with-capabilities.json"
              }
            },
            catalog: {
              query: q,
              filters,
              pagination: { limit: catalogPageLimit }
            }
          }
        }
      };

      try {
        const res = await fetch('https://catalog.shopify.com/api/ucp/mcp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(catalogTimeoutMs)
        });
        if (!res.ok) return [];
        const rawJson = await res.json();
        return rawJson.result?.structuredContent?.products || [];
      } catch (err) {
        console.error(`Error querying catalog for "${q}":`, err);
        return [];
      }
    };

    const parseProduct = (p: any): UcpProduct | null => {
      try {
        const variant = p.variants?.[0] || {};
        const priceAmount = variant.price?.amount ?? p.price_range?.min?.amount ?? 0;
        const currency = variant.price?.currency ?? p.price_range?.min?.currency ?? 'USD';
        
        let vendor = 'Independent Seller';
        if (variant.seller?.name) vendor = variant.seller.name;
        else if (variant.seller?.domain) vendor = variant.seller.domain;

        let store_url = variant.url || p.url || `https://${variant.seller?.domain}/products/${p.id.split('/').pop()}`;
        
        try {
          const urlObj = new URL(store_url);
          urlObj.searchParams.set('ref', 'from_ai_affiliate');
          store_url = urlObj.toString();
        } catch {}

        const textOptions = [
          p.description?.plain,
          p.variants?.[0]?.description?.plain,
          p.metadata?.tech_specs
        ].filter((text): text is string => typeof text === 'string' && text.trim().length > 0);
        
        const desc = textOptions.length > 0 
          ? textOptions.reduce((longest, current) => current.length > longest.length ? current : longest, '') 
          : undefined;
        
        const parsedOptions = Array.isArray(p.options) 
          ? p.options.map((opt: any) => ({
              name: opt.name,
              values: Array.isArray(opt.values) ? opt.values.map((v: any) => v.label || v) : []
            })).filter((o: any) => o.values.length > 0)
          : undefined;

        const parsedVariants = (p.variants || []).map((v: any) => {
          const vCurrency = v.price?.currency ?? currency ?? 'USD';
          const isZeroDecimal = ZERO_DECIMAL_CURRENCIES.has(vCurrency.toUpperCase());
          return {
            id: v.id,
            title: v.title,
            price: isZeroDecimal ? (v.price?.amount ?? 0) : (v.price?.amount ?? 0) / 100,
            availability: v.availability?.available ?? true,
            options: v.options || [],
            media: (v.media || []).map((m: any) => ({
              ...m,
              url: normalizeImageUrl(m.url)
            }))
          };
        });

        const parsedMedia = (p.media || []).map((m: any) => ({
          ...m,
          url: normalizeImageUrl(m.url)
        }));
        const isZeroDecimal = ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase());

        return {
          id: p.id,
          title: p.title || 'Untitled Product',
          vendor,
          price: isZeroDecimal ? priceAmount : priceAmount / 100,
          currency,
          store_url,
          image_url: normalizeImageUrl(p.media?.[0]?.url || variant.media?.[0]?.url || ''),
          in_stock: variant.availability?.available ?? true,
          tags: p.tags || [],
          description: desc,
          options: parsedOptions && parsedOptions.length > 0 ? parsedOptions : undefined,
          variants: parsedVariants,
          media: parsedMedia
        };
      } catch (err) {
        console.warn('Error parsing individual Shopify product:', err);
        return null;
      }
    };

    const fetchAllForQuery = async (q: string): Promise<any[]> => {
      if (!isFastFirstPage && normalizedCountryCode && COUNTRY_MAP[normalizedCountryCode]) {
        const countryName = COUNTRY_MAP[normalizedCountryCode];
        if (!q.toLowerCase().includes(countryName.toLowerCase())) {
          const [localProducts, globalProducts] = await Promise.all([
            fetchFromCatalog(`${q} ${countryName}`),
            fetchFromCatalog(q)
          ]);
          return uniqueById([...localProducts, ...globalProducts]);
        }
      }
      return fetchFromCatalog(q);
    };

    const subQueries = splitCatalogQuery(normalizedQuery);
    const fetchSubQueries = async (queries: string[]) => {
      const results = await Promise.all(
        queries.map((subQuery, index) =>
          index === 0 ? fetchAllForQuery(subQuery) : fetchFromCatalog(subQuery)
        )
      );
      return uniqueById(results.flat());
    };

    const parseRawProducts = (raw: any[]) => {
      const parsed: UcpProduct[] = [];
      let skippedNoImage = 0;
      for (const p of raw) {
        const item = parseProduct(p);
        if (item && item.image_url && item.image_url.trim().length > 0) {
          parsed.push(item);
        } else if (item) {
          skippedNoImage++;
        }
      }
      return { parsed, skippedNoImage };
    };

    let rawProducts: any[];
    if (options.loadMore && subQueries.length > 0) {
      if (options.debug) {
        options.debug.loadMorePage = 1;
        options.debug.loadMoreQuery = 'ALL_SUBQUERIES';
      }
      console.log(`[GlobalCatalog] load more fetching all subqueries to replenish cache pool`);
      rawProducts = await fetchSubQueries(subQueries);
    } else {
      rawProducts = await fetchSubQueries(
        isFastFirstPage ? subQueries.slice(0, FAST_SUBQUERY_LIMIT) : subQueries
      );
    }
    let { parsed: products, skippedNoImage } = parseRawProducts(rawProducts);

    const filterOptions: CatalogSearchFilters = {
      budgetMax,
      budgetCurrency,
      excludeIds,
      mandatoryConcepts,
      sort,
      limit,
      rates,
    };

    let filteredProducts = applyCatalogFiltersWithRetry(products, filterOptions);

    if (
      filteredProducts.length < 6 &&
      subQueries.length > FAST_SUBQUERY_LIMIT
    ) {
      console.log(`[GlobalCatalog] sparse results (${filteredProducts.length}), fetching remaining ${subQueries.length - FAST_SUBQUERY_LIMIT} OR terms`);
      const extraRaw = await fetchSubQueries(subQueries.slice(FAST_SUBQUERY_LIMIT));
      rawProducts = uniqueById([...rawProducts, ...extraRaw]);
      ({ parsed: products, skippedNoImage } = parseRawProducts(rawProducts));
      filteredProducts = applyCatalogFiltersWithRetry(products, filterOptions);
    }

    console.log(`[GlobalCatalog] raw=${rawProducts.length}, parsed_with_image=${products.length}, skipped_no_image=${skippedNoImage}, fast=${isFastFirstPage}`);

    if (products.length > 0) {
      const merged = uniqueById([...(cached?.products || []), ...products]);
      searchCache.set(cacheKey, { timestamp: Date.now(), products: merged });
    }

    console.log(`[GlobalCatalog] returning ${filteredProducts.length} of ${products.length} (limit=${limit}, fast=${isFastFirstPage})`);
    return filteredProducts;
  }
}
