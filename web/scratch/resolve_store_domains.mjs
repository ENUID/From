import fs from 'fs';
import { UCP_REGISTRY } from '../lib/stores.js';

function cleanBrandName(domain) {
  let cleaned = domain
    .replace(/^www\./i, '')
    .replace(/\.myshopify\.com$/i, '')
    .replace(/\.(com|net|org|co|io|store|co\.uk|com\.au|it|fr|in|de|es|be|pk|ca|au|edu|gov|eu|ph|ae|ru|gr|store|cc|co\.id|cl)$/i, '')
    .toLowerCase()
    .trim();
  
  cleaned = cleaned.replace(/^(shop|weare|the|buy|get|official|studio|wear)\-?/i, '');
  cleaned = cleaned.replace(/\-?(shop|store|clothing|brand|official|studio|wear|collective|denim)$/i, '');
  
  return cleaned;
}

function getProductStoreDomain(storeUrl, vendor) {
  try {
    const urlObj = new URL(storeUrl);
    return urlObj.hostname.replace(/^www\./i, '').toLowerCase().trim();
  } catch {
    if (vendor && vendor.includes('.')) {
      return vendor.replace(/^www\./i, '').toLowerCase().trim();
    }
    return '';
  }
}

async function queryGlobalCatalog(q) {
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
          filters: { available: true },
          pagination: { limit: 3 }
        }
      }
    }
  };

  try {
    const res = await fetch('https://catalog.shopify.com/api/ucp/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(4000)
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.result?.structuredContent?.products || [];
  } catch (err) {
    return [];
  }
}

async function checkDirectMcp(domain) {
  const endpoint = `https://${domain.replace(/^www\./i, '')}/api/mcp`;
  const payload = {
    jsonrpc: "2.0",
    id: "1",
    method: "tools/call",
    params: {
      name: "search_catalog",
      arguments: { query: "test" }
    }
  };
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(3000)
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function resolveDomain(domain) {
  const brand = cleanBrandName(domain);
  if (!brand) return null;

  // 1. Try querying global catalog using the original domain
  let products = await queryGlobalCatalog(domain);
  
  // 2. If nothing, try querying using the brand name
  if (products.length === 0) {
    products = await queryGlobalCatalog(brand);
  }

  // 3. Inspect products to find a seller domain that matches the brand name
  for (const p of products) {
    const variant = p.variants?.[0] || {};
    const sellerDomain = variant.seller?.domain || '';
    const storeUrl = p.url || '';
    const vendor = p.vendor || '';

    const possibleDomains = [
      sellerDomain,
      getProductStoreDomain(storeUrl, vendor)
    ].filter(Boolean);

    for (const pos of possibleDomains) {
      const posClean = cleanBrandName(pos);
      if (posClean === brand || pos.toLowerCase().includes(brand) || brand.includes(posClean)) {
        return pos.toLowerCase().trim(); // Resolved!
      }
    }
  }

  // 4. Try direct UCP endpoint check as fallback
  const directWorks = await checkDirectMcp(domain);
  if (directWorks) {
    return domain;
  }

  // Fallback to {brand}.myshopify.com check
  const myshopifyDomain = `${brand}.myshopify.com`;
  const myshopifyWorks = await checkDirectMcp(myshopifyDomain);
  if (myshopifyWorks) {
    return myshopifyDomain;
  }

  return null; // Could not verify UCP support
}

async function resolveAll() {
  console.log(`Starting resolution for ${UCP_REGISTRY.length} stores...`);
  const resolvedStores = [];
  const batchSize = 10;

  for (let i = 0; i < UCP_REGISTRY.length; i += batchSize) {
    const batch = UCP_REGISTRY.slice(i, i + batchSize);
    console.log(`Processing batch ${i / batchSize + 1}/${Math.ceil(UCP_REGISTRY.length / batchSize)}...`);

    const promises = batch.map(async (store) => {
      const resolved = await resolveDomain(store.domain);
      if (resolved) {
        console.log(`  [OK] ${store.domain} -> ${resolved}`);
        return {
          domain: resolved,
          categories: store.categories,
          vibe: store.vibe
        };
      } else {
        console.log(`  [SKIP] ${store.domain} (No active UCP endpoint found)`);
        return null;
      }
    });

    const results = await Promise.all(promises);
    resolvedStores.push(...results.filter(Boolean));
    
    // Tiny sleep to avoid aggressive API rate-limiting
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`Finished! Resolved ${resolvedStores.length} UCP active stores out of ${UCP_REGISTRY.length}.`);

  // Deduplicate resolved domains
  const seen = new Set();
  const deduped = [];
  for (const s of resolvedStores) {
    if (!seen.has(s.domain)) {
      seen.add(s.domain);
      deduped.push(s);
    }
  }

  const tsContent = `export type StoreProfile = {
  domain: string;
  categories: string[];
  vibe: string[];
};

export const UCP_REGISTRY: StoreProfile[] = ${JSON.stringify(deduped, null, 2)};
`;

  fs.writeFileSync('web/lib/stores.ts', tsContent);
  console.log("Wrote updated web/lib/stores.ts successfully!");
}

resolveAll();
