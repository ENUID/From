import { UCP_REGISTRY } from '../lib/stores.js';
import * as fs from 'fs';

const CATEGORIES = {
  "top": ["shirt", "t-shirt", "tee", "top", "tank", "blouse", "crop", "henley", "polo", "sơ mi", "ao", "áo", "シャツ", "셔츠", "camisa"],
  "bottom": ["short", "shorts", "pants", "trouser", "jean", "denim", "skirt", "leggings", "jogger", "sweatpant", "quần", "裤"],
  "dress": ["dress", "gown", "jumpsuit", "bodysuit", "romper", "váy", "đầm", "ワンピース"],
  "outerwear": ["jacket", "coat", "hoodie", "sweatshirt", "sweater", "cardigan", "blazer", "fleece", "vest", "windbreaker", "khoác", "len", "ジャケット", "코트"],
  "footwear": ["shoe", "sneaker", "boot", "sandal", "heel", "slide", "loafer", "runner", "dasher", "breezer", "skipper", "glider", "sole", "footwear", "giày", "dép", "guốc", "靴", "신발"],
  "underwear": ["sock", "underwear", "bra", "briefs", "boxer", "thong", "sleepwear", "robe", "lingerie", "boxers", "vớ", "sịp", "lót", "下着", "속옷"],
  "accessory": ["bag", "backpack", "hat", "cap", "belt", "towel", "mat", "bottle", "sunglasses", "eyewear", "túi", "ví", "mũ", "nón", "kính", "バッグ", "모자"]
};

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Clean brand/domain name helper to check domain matching
function cleanBrandName(domain: string): string {
  if (!domain) return '';
  let cleaned = domain.toLowerCase().trim();
  cleaned = cleaned.replace(/^(https?:\/\/)?(www\.)?/, '');
  cleaned = cleaned.split('/')[0];
  if (cleaned.includes('.myshopify.com')) {
    const parts = cleaned.replace(/\.myshopify\.com$/, '').split('.');
    cleaned = parts[parts.length - 1];
  } else {
    const parts = cleaned.split('.');
    const tlds = new Set(['com', 'co', 'uk', 'org', 'net', 'store', 'in', 'us', 'ca', 'au', 'io', 'website', 'com', 'au', 'me', 'ph', 'ae', 'fr', 'eu', 'gr', 'it', 'co', 'id', 'xyz', 'cc']);
    const nonTlds = parts.filter(p => !tlds.has(p));
    if (nonTlds.length > 0) {
      cleaned = nonTlds[nonTlds.length - 1];
    } else {
      cleaned = parts[0];
    }
  }
  cleaned = cleaned.replace(/[\-_]/g, '');
  cleaned = cleaned.replace(/^(shop|weare|the|buy|get|official|studio|wear)\-?/i, '');
  cleaned = cleaned.replace(/\-?(shop|store|clothing|brand|official|studio|wear|collective|denim)$/i, '');
  return cleaned;
}

function isDomainMatch(d1: string, d2: string): boolean {
  const p = cleanBrandName(d1);
  const a = cleanBrandName(d2);
  if (!p || !a) return false;
  if (p === a) return true;
  if (p.length >= 3 && a.length >= 3) {
    if (p.startsWith(a) || a.startsWith(p)) return true;
  }
  return false;
}

async function fetchStoreProductsWithRetry(domain: string, retries = 3, backoffMs = 1500): Promise<any[]> {
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
          query: `"${cleanBrandName(domain)}"`,
          filters: { available: true },
          pagination: { limit: 50 }
        }
      }
    }
  };

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch('https://catalog.shopify.com/api/ucp/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000)
      });

      if (res.status === 429) {
        console.warn(`  [${domain}] Rate limited (429). Attempt ${attempt}/${retries}. Retrying in ${backoffMs}ms...`);
        await sleep(backoffMs);
        backoffMs *= 2;
        continue;
      }

      if (!res.ok) {
        console.error(`  [${domain}] HTTP status error: ${res.status}`);
        return [];
      }

      const json = await res.json();
      if (json.error) {
        console.error(`  [${domain}] MCP error:`, json.error);
        return [];
      }
      return json.result?.structuredContent?.products || [];
    } catch (err: any) {
      console.error(`  [${domain}] Fetch exception (attempt ${attempt}):`, err.message);
      if (attempt === retries) return [];
      await sleep(backoffMs);
      backoffMs *= 2;
    }
  }
  return [];
}

function extractCategoriesFromTitles(products: any[], domain: string): string[] {
  const matchedCategories = new Set<string>();

  for (const product of products) {
    // Filter by seller domain to ensure we only look at actual products from this store!
    const variant = product.variants?.[0] || {};
    const sellerDomain = (variant.seller?.domain || "").toLowerCase().trim();
    if (sellerDomain && !isDomainMatch(sellerDomain, domain)) {
      continue; // Skip products from resellers
    }

    const title = (product.title || "").toLowerCase();

    // Match only in title for high precision!
    for (const [catName, keywords] of Object.entries(CATEGORIES)) {
      for (const kw of keywords) {
        const regex = new RegExp(`\\b${kw}s?\\b`, 'i');
        if (regex.test(title)) {
          matchedCategories.add(catName);
          break;
        }
      }
    }
  }

  return [...matchedCategories];
}

async function main() {
  const stores = UCP_REGISTRY;
  console.log(`Profiling ${stores.length} stores sequentially (TITLE ONLY & DOMAIN MATCHING) for maximum precision...\n`);

  const storeProfiles: any[] = [];
  const outputPath = './web/scratch/store_profiles.json';

  for (let i = 0; i < stores.length; i++) {
    const store = stores[i];
    console.log(`[${i + 1}/${stores.length}] Profiling ${store.domain}...`);

    const products = await fetchStoreProductsWithRetry(store.domain);
    const categories = extractCategoriesFromTitles(products, store.domain);
    
    // If no specific category matched, default to ["apparel"]
    const finalCategories = categories.length > 0 ? categories : ["apparel"];

    const profile = {
      domain: store.domain,
      categories: finalCategories,
      vibe: store.vibe || []
    };

    storeProfiles.push(profile);
    console.log(`  ✅ categories=[${profile.categories.join(', ')}], products=${products.length}`);
    
    fs.writeFileSync(outputPath, JSON.stringify(storeProfiles, null, 2));
    await sleep(600);
  }

  console.log(`\nAll profiles completed and saved to ${outputPath}`);
}

main().catch(console.error);
