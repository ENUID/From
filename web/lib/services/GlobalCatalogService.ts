import { z } from 'zod';
import { SearchToolArgs } from '../ai/schema';

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

export class GlobalCatalogService {
  static async search(
    query: string, 
    budgetMax?: number | null, 
    excludeIds: string[] = [], 
    countryCode?: string | null,
    isClothing?: boolean
  ): Promise<UcpProduct[]> {
    const limit = isClothing ? 24 : 12;
    const cacheKey = `${query.toLowerCase().trim()}:${countryCode || 'global'}`;
    const cached = searchCache.get(cacheKey);
    
    // Use cache if available and less than 15 minutes old
    if (cached && Date.now() - cached.timestamp < 15 * 60 * 1000) {
      let finalProducts = cached.products;
      if (excludeIds.length > 0) {
        finalProducts = finalProducts.filter(p => !excludeIds.includes(p.id));
      }
      if (budgetMax && budgetMax > 0) {
        finalProducts = finalProducts.filter(p => p.price <= budgetMax);
      }
      return finalProducts.slice(0, limit);
    }

    // Helper to fetch from global UCP catalog
    const fetchFromCatalog = async (q: string, useShippingFilter: boolean = true) => {
      const filters: any = { available: true };
      if (countryCode && useShippingFilter) {
        filters.ships_to = { country: countryCode.toUpperCase() };
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
              pagination: { limit: 50 }
            }
          }
        }
      };

      try {
        const res = await fetch('https://catalog.shopify.com/api/ucp/mcp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) return [];
        const rawJson = await res.json();
        return rawJson.result?.structuredContent?.products || [];
      } catch (err) {
        console.error(`Error querying catalog for "${q}":`, err);
        return [];
      }
    };

    // DRY Helper to parse raw product to UcpProduct
    const parseProduct = (p: any): UcpProduct | null => {
      try {
        const variant = p.variants?.[0] || {};
        const priceAmount = variant.price?.amount ?? p.price_range?.min?.amount ?? 0;
        const currency = variant.price?.currency ?? p.price_range?.min?.currency ?? 'USD';
        
        let vendor = 'Shopify Merchant';
        if (variant.seller?.name) vendor = variant.seller.name;
        else if (variant.seller?.domain) vendor = variant.seller.domain;

        let store_url = variant.url || p.url || `https://${variant.seller?.domain}/products/${p.id.split('/').pop()}`;
        
        try {
          const urlObj = new URL(store_url);
          urlObj.searchParams.set('ref', 'from_ai_affiliate');
          store_url = urlObj.toString();
        } catch (e) {}

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

        // Parse full variants
        const parsedVariants = (p.variants || []).map((v: any) => {
          const vCurrency = v.price?.currency ?? currency ?? 'USD';
          const isZeroDecimal = ZERO_DECIMAL_CURRENCIES.has(vCurrency.toUpperCase());
          return {
            id: v.id,
            title: v.title,
            price: isZeroDecimal ? (v.price?.amount ?? 0) : (v.price?.amount ?? 0) / 100,
            availability: v.availability?.available ?? true,
            options: v.options || [],
            media: v.media || []
          };
        });

        const parsedMedia = p.media || [];
        const isZeroDecimal = ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase());

        return {
          id: p.id,
          title: p.title || 'Untitled Product',
          vendor,
          price: isZeroDecimal ? priceAmount : priceAmount / 100,
          currency,
          store_url,
          image_url: p.media?.[0]?.url || variant.media?.[0]?.url || '',
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

    let rawProducts: any[] = [];

    // Prioritize local results if country mapping is found (Using shipping filter)
    if (countryCode && COUNTRY_MAP[countryCode.toUpperCase()]) {
      const countryName = COUNTRY_MAP[countryCode.toUpperCase()];
      if (!query.toLowerCase().includes(countryName.toLowerCase())) {
        const localProducts = await fetchFromCatalog(`${query} ${countryName}`, true);
        const globalProducts = await fetchFromCatalog(query, true);
        const merged = [...localProducts];
        for (const gp of globalProducts) {
          if (!merged.some(p => p.id === gp.id)) {
            merged.push(gp);
          }
        }
        rawProducts = merged;
      } else {
        rawProducts = await fetchFromCatalog(query, true);
      }
    } else {
      rawProducts = await fetchFromCatalog(query, true);
    }

    // Parse primary results
    const products: UcpProduct[] = [];
    for (const p of rawProducts) {
      const parsed = parseProduct(p);
      if (parsed) products.push(parsed);
    }

    // Apply exclusions and budget filters to primary list
    let filteredProducts = products;
    if (excludeIds.length > 0) {
      filteredProducts = filteredProducts.filter(p => !excludeIds.includes(p.id));
    }
    if (budgetMax && budgetMax > 0) {
      filteredProducts = filteredProducts.filter(p => p.price <= budgetMax);
    }

    // FALLBACK DECK: If we got fewer than the target limit after strict shipping filtering
    if (filteredProducts.length < limit && countryCode) {
      let fallbackRaw: any[] = [];
      if (COUNTRY_MAP[countryCode.toUpperCase()]) {
        const countryName = COUNTRY_MAP[countryCode.toUpperCase()];
        if (!query.toLowerCase().includes(countryName.toLowerCase())) {
          const localFallback = await fetchFromCatalog(`${query} ${countryName}`, false);
          const globalFallback = await fetchFromCatalog(query, false);
          const mergedFallback = [...localFallback];
          for (const gp of globalFallback) {
            if (!mergedFallback.some(p => p.id === gp.id)) {
              mergedFallback.push(gp);
            }
          }
          fallbackRaw = mergedFallback;
        } else {
          fallbackRaw = await fetchFromCatalog(query, false);
        }
      } else {
        fallbackRaw = await fetchFromCatalog(query, false);
      }

      // Parse and filter fallback results, avoiding duplicates from the primary list
      const fallbackProducts: UcpProduct[] = [];
      for (const p of fallbackRaw) {
        if (products.some(existing => existing.id === p.id)) continue;
        const parsed = parseProduct(p);
        if (parsed) fallbackProducts.push(parsed);
      }

      let filteredFallback = fallbackProducts;
      if (excludeIds.length > 0) {
        filteredFallback = filteredFallback.filter(p => !excludeIds.includes(p.id));
      }
      if (budgetMax && budgetMax > 0) {
        filteredFallback = filteredFallback.filter(p => p.price <= budgetMax);
      }

      // Append fallback products to fill up the slots
      filteredProducts = [...filteredProducts, ...filteredFallback];
    }

    searchCache.set(cacheKey, { timestamp: Date.now(), products: filteredProducts });

    return filteredProducts.slice(0, limit);
  }
}
