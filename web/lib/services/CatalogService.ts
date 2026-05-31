import { z } from 'zod';

export type ProductVariant = {
  price: number;
  currency: string;
  inStock: boolean;
}

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

// Highly permissive schema because Shopify merchants might omit certain fields
const McpProductSchema = z.object({
  id: z.string(),
  title: z.string().catch('Untitled Product'),
  vendor: z.string().optional(),
  tags: z.array(z.string()).optional(),
  handle: z.string().optional(),
  url: z.string().optional(),
  media: z.array(z.object({
    url: z.string().optional()
  }).passthrough()).optional(),
  variants: z.array(z.object({
    price: z.object({
      amount: z.number().optional(),
      currency: z.string().optional()
    }).passthrough().optional(),
    availability: z.object({
      available: z.boolean().optional()
    }).passthrough().optional()
  }).passthrough()).optional()
}).passthrough();

const McpResponseSchema = z.object({
  result: z.object({
    content: z.array(z.object({
      text: z.string()
    }).passthrough())
  }).passthrough()
}).passthrough();

export class CatalogService {
  static async searchStore(domain: string, query: string): Promise<UcpProduct[]> {
    const cleanDomain = domain.replace('www.', '');
    const endpoint = `https://${cleanDomain}/api/mcp`;
    
    const payload = {
      jsonrpc: "2.0",
      id: "1",
      method: "tools/call",
      params: {
        name: "search_catalog",
        arguments: { query }
      }
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!res.ok) return [];

      const rawJson = await res.json();
      if (rawJson.error) return [];

      const parsedResponse = McpResponseSchema.safeParse(rawJson);
      if (!parsedResponse.success) return [];

      const textContent = parsedResponse.data.result.content[0]?.text;
      if (!textContent) return [];

      const parsedInner = JSON.parse(textContent);
      if (!parsedInner.products || !Array.isArray(parsedInner.products)) return [];

      const products: UcpProduct[] = [];

      for (const p of parsedInner.products) {
        const validated = McpProductSchema.safeParse(p);
        if (!validated.success) continue;
        
        const data = validated.data;
        const priceAmount = data.variants?.[0]?.price?.amount || 0;
        const currency = data.variants?.[0]?.price?.currency || 'USD';
        const inStock = data.variants?.[0]?.availability?.available ?? true;
        
        // Zod validation guarantees these exist in some form
        const store_url = data.url || `https://${cleanDomain}/products/${data.handle || data.id.split('/').pop()}`;
        
        products.push({
          id: data.id,
          title: data.title,
          vendor: data.vendor || cleanDomain,
          price: priceAmount / 100,
          currency,
          store_url,
          image_url: data.media?.[0]?.url || '',
          in_stock: inStock,
          tags: data.tags || []
        });
      }

      return products;
    } catch (err) {
      // Timeout or invalid domain
      return [];
    }
  }
}
