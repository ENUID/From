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
}

export class GlobalCatalogService {
  static async search(query: string, budgetMax?: number | null): Promise<UcpProduct[]> {
    const endpoint = 'https://catalog.shopify.com/api/ucp/mcp';
    
    // Shopify Global Catalog UCP Filters
    const filters: any = {
      available: true
    };
    // Local filtering will handle the budget instead of relying on the API's price_range filter
    
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
            query: query,
            filters: filters
          }
        }
      }
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!res.ok) {
        console.error('Shopify Global Catalog HTTP Error:', res.status, await res.text());
        return [];
      }

      const rawJson = await res.json();
      if (rawJson.error) {
        console.error('Shopify Global Catalog RPC Error:', rawJson.error);
        return [];
      }

      const productsRaw = rawJson.result?.structuredContent?.products || [];
      const products: UcpProduct[] = [];

      for (const p of productsRaw) {
        try {
          const variant = p.variants?.[0] || {};
          const priceAmount = variant.price?.amount ?? p.price_range?.min?.amount ?? 0;
          const currency = variant.price?.currency ?? p.price_range?.min?.currency ?? 'USD';
          
          let vendor = 'Shopify Merchant';
          if (variant.seller?.name) vendor = variant.seller.name;
          else if (variant.seller?.domain) vendor = variant.seller.domain;

          let store_url = variant.url || p.url || `https://${variant.seller?.domain}/products/${p.id.split('/').pop()}`;
          
          // Append affiliate tracking
          try {
            const urlObj = new URL(store_url);
            urlObj.searchParams.set('ref', 'from_ai_affiliate');
            store_url = urlObj.toString();
          } catch (e) {
            // Ignore URL parsing errors
          }

          products.push({
            id: p.id,
            title: p.title || 'Untitled Product',
            vendor,
            price: priceAmount / 100, // Convert cents to dollars
            currency,
            store_url,
            image_url: p.media?.[0]?.url || variant.media?.[0]?.url || '',
            in_stock: variant.availability?.available ?? true,
            tags: p.metadata?.top_features ? [p.metadata.top_features.split('\\n')[0].substring(0, 50)] : [] // Use first feature as a tag if available
          });
        } catch (err) {
          console.warn('Error parsing individual Shopify product:', err);
        }
      }

      let finalProducts = products;
      if (budgetMax && budgetMax > 0) {
        finalProducts = finalProducts.filter(p => p.price <= budgetMax);
      }

      return finalProducts.slice(0, 5); // Return top 5 best matches
    } catch (err) {
      console.error('Shopify Global Catalog Fetch Error:', err);
      return [];
    }
  }
}
