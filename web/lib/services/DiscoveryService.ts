import { z } from 'zod';
import { UCP_STORES } from '../stores';

const SerperResponseSchema = z.object({
  organic: z.array(
    z.object({
      link: z.string().url()
    })
  ).optional()
}).catch({ organic: [] });

export class DiscoveryService {
  private static CACHE = new Map<string, string[]>();
  
  static async discoverDomains(query: string): Promise<string[]> {
    const cacheKey = query.toLowerCase().trim();
    if (this.CACHE.has(cacheKey)) {
      return this.CACHE.get(cacheKey)!;
    }

    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) {
      console.warn('No SERPER_API_KEY found, falling back to whitelist.');
      return UCP_STORES;
    }

    try {
      const res = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          q: `buy ${query} independent online store`,
          num: 10
        })
      });

      if (!res.ok) {
        console.warn('Serper API error:', res.statusText);
        return [];
      }

      const rawJson = await res.json();
      const parsed = SerperResponseSchema.parse(rawJson);
      
      const domains: string[] = [];
      const excludeList = ['amazon.com', 'ebay.com', 'walmart.com', 'etsy.com', 'target.com', 'pinterest.com'];

      for (const result of parsed.organic || []) {
        try {
          const urlObj = new URL(result.link);
          const hostname = urlObj.hostname.replace('www.', '');
          if (!excludeList.includes(hostname) && !domains.includes(hostname)) {
            domains.push(hostname);
          }
        } catch (e) {
          // ignore invalid URLs
        }
      }

      const finalDomains = domains.slice(0, 8);
      this.CACHE.set(cacheKey, finalDomains);
      return finalDomains;
    } catch (err) {
      console.error('DiscoveryService error:', err);
      return [];
    }
  }
}
