import { UCP_REGISTRY } from '../lib/stores';
import * as fs from 'fs';

const CATEGORIES: Record<string, string[]> = {
  "top": ["shirt", "t-shirt", "tee", "top", "tank", "blouse", "crop", "henley", "polo", "sơ mi", "ao", "áo", "シャツ", "셔츠", "camisa"],
  "bottom": ["short", "shorts", "pants", "trouser", "jean", "denim", "skirt", "skirts", "leggings", "jogger", "sweatpant", "sweatpants", "quần", "裤"],
  "dress": ["dress", "gown", "jumpsuit", "bodysuit", "romper", "váy", "đầm", "ワンピース"],
  "outerwear": ["jacket", "coat", "hoodie", "sweatshirt", "sweater", "cardigan", "blazer", "fleece", "vest", "windbreaker", "khoác", "len", "ジャケット", "코트"],
  "footwear": ["shoe", "shoes", "sneaker", "sneakers", "boot", "boots", "sandal", "sandals", "heel", "heels", "slide", "slides", "loafer", "loafers", "runner", "dasher", "breezer", "skipper", "glider", "sole", "footwear", "giày", "dép", "guốc", "靴", "신발"],
  "underwear": ["sock", "socks", "underwear", "bra", "bras", "briefs", "boxer", "thong", "sleepwear", "robe", "lingerie", "boxers", "vớ", "sịp", "lót", "下着", "속옷"],
  "accessory": ["bag", "bags", "backpack", "backpacks", "hat", "hats", "cap", "caps", "belt", "belts", "towel", "mat", "bottle", "sunglasses", "eyewear", "túi", "ví", "mũ", "nón", "kính", "バッグ", "모자"]
};

function parseProductsFromMcpResult(data: any): any[] {
  if (data?.result?.structuredContent?.products) {
    return data.result.structuredContent.products;
  }
  const textContent = data?.result?.content?.[0]?.text;
  if (textContent && typeof textContent === 'string') {
    try {
      const parsedInner = JSON.parse(textContent);
      if (parsedInner && Array.isArray(parsedInner.products)) {
        return parsedInner.products;
      }
    } catch (e) {}
  }
  if (data?.result?.products) {
    return data.result.products;
  }
  return [];
}

async function fetchDirectStoreProducts(domain: string, query: string = ""): Promise<any[]> {
  const endpoint = `https://${domain}/api/mcp`;
  
  const payload = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "search_catalog",
      arguments: {
        catalog: {
          query: query,
          pagination: { limit: 50 }
        }
      }
    }
  };

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(6000)
    });
    if (!res.ok) return [];
    const data = await res.json();
    return parseProductsFromMcpResult(data);
  } catch (err) {
    return [];
  }
}

async function fetchProductsWithFallback(domain: string): Promise<any[]> {
  // 1. Try empty query
  let products = await fetchDirectStoreProducts(domain, "");
  if (products.length > 0) return products;

  // 2. Try common letter query "a" as fallback
  products = await fetchDirectStoreProducts(domain, "a");
  if (products.length > 0) return products;

  // 3. Try "the" as fallback
  products = await fetchDirectStoreProducts(domain, "the");
  return products;
}

function classifyProducts(products: any[]): string[] {
  const categoryCounts: Record<string, number> = {};
  for (const cat of Object.keys(CATEGORIES)) {
    categoryCounts[cat] = 0;
  }

  for (const product of products) {
    const title = (product.title || "").toLowerCase();
    const tags = Array.isArray(product.tags) ? product.tags.map((t: any) => String(t).toLowerCase()) : [];
    const searchableText = `${title} ${tags.join(' ')}`;

    for (const [catName, keywords] of Object.entries(CATEGORIES)) {
      const matches = keywords.some(kw => {
        // Match word boundaries
        const regex = new RegExp(`\\b${kw}s?\\b`, 'i');
        return regex.test(searchableText);
      });
      if (matches) {
        categoryCounts[catName] = (categoryCounts[catName] || 0) + 1;
      }
    }
  }

  const matchedCategories: string[] = [];
  const minThreshold = Math.max(2, Math.floor(products.length * 0.05)); // at least 5% of products or at least 2 items

  for (const [catName, count] of Object.entries(categoryCounts)) {
    if (count >= minThreshold) {
      matchedCategories.push(catName);
    }
  }

  return matchedCategories;
}

async function main() {
  console.log(`Starting direct storefront profiling for ${UCP_REGISTRY.length} stores...\n`);
  const resolvedRegistry: any[] = [];
  const batchSize = 10;

  for (let i = 0; i < UCP_REGISTRY.length; i += batchSize) {
    const batch = UCP_REGISTRY.slice(i, i + batchSize);
    console.log(`Processing batch ${i / batchSize + 1}/${Math.ceil(UCP_REGISTRY.length / batchSize)}...`);

    const promises = batch.map(async (store) => {
      const products = await fetchProductsWithFallback(store.domain);
      const categories = classifyProducts(products);
      
      const finalCategories = categories.length > 0 ? categories : ["apparel"];
      
      console.log(`  [${store.domain}]: fetched=${products.length} products, categorized as=[${finalCategories.join(', ')}]`);
      
      return {
        domain: store.domain,
        categories: finalCategories,
        vibe: store.vibe
      };
    });

    const results = await Promise.all(promises);
    resolvedRegistry.push(...results);
    
    // Sleep a bit to avoid hitting Shopify apps limits
    await new Promise(r => setTimeout(r, 500));
  }

  const tsContent = `export type StoreProfile = {
  domain: string;
  categories: string[];
  vibe: string[];
};

export const UCP_REGISTRY: StoreProfile[] = ${JSON.stringify(resolvedRegistry, null, 2)};
`;

  fs.writeFileSync('web/lib/stores.ts', tsContent);
  console.log("\nFinished profiling! Successfully updated web/lib/stores.ts!");
}

main().catch(console.error);
