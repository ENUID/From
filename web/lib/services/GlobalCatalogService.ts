import { getExchangeRates } from '../exchangeRates';
import { UCP_REGISTRY } from '../stores';


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
  trust_score?: number;
}

type ProductSort = 'price_asc' | 'price_desc' | 'relevance' | 'trust_desc';

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
const FAST_PAGE_LIMIT = 30;
const CATALOG_PAGE_LIMIT = 30;
const REFRESH_PAGE_LIMIT = 30;
const FAST_SUBQUERY_LIMIT = 3;
const INITIAL_RESULT_LIMIT = 30;
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

const VIETNAMESE_TO_ENGLISH: Record<string, string> = {
  'lanh': 'linen',
  'thun': 'cotton',
  'len': 'wool',
  'lụa': 'silk',
  'tơ': 'silk',
  'da': 'leather',
  'bò': 'denim',
  'kaki': 'khaki',
  'áo': 'shirt',
  'sơ mi': 'shirt',
  'quần': 'pants',
  'váy': 'dress',
  'đầm': 'dress',
  'khoác': 'jacket',
  'giày': 'shoes',
  'dép': 'sandals',
  'túi': 'bag',
  'ví': 'wallet',
  'mũ': 'hat',
  'nón': 'hat',
  'kính': 'glasses',
  'trắng': 'white',
  'đen': 'black',
  'xanh': 'blue',
  'đỏ': 'red',
  'hồng': 'pink',
  'nâu': 'brown',
  'vàng': 'yellow'
};

function translateVietnameseToEnglish(query: string): string {
  const normalized = query.toLowerCase();
  
  // Replace compound phrases first
  let cleaned = normalized
    .replace(/\bsơ\s+mi\b/g, 'shirt')
    .replace(/\báo\s+khoác\b/g, 'jacket')
    .replace(/\báo\s+thun\b/g, 't-shirt');
    
  // Split into words
  const words = cleaned.split(/\s+/).map(w => w.trim()).filter(Boolean);
  const translatedWords: string[] = [];
  
  for (const word of words) {
    if (VIETNAMESE_TO_ENGLISH[word]) {
      translatedWords.push(VIETNAMESE_TO_ENGLISH[word]);
    } else {
      const isAscii = !/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(word);
      if (isAscii) {
        translatedWords.push(word);
      }
    }
  }
  
  const unique = Array.from(new Set(translatedWords));
  
  if (unique.includes('jacket') && unique.includes('shirt')) {
    const idx = unique.indexOf('shirt');
    unique.splice(idx, 1);
  }
  
  const materials = ['linen', 'cotton', 'wool', 'silk', 'leather', 'denim', 'khaki'];
  const colors = ['white', 'black', 'blue', 'red', 'pink', 'brown', 'yellow'];
  
  const matchesMaterials = unique.filter(w => materials.includes(w));
  const matchesColors = unique.filter(w => colors.includes(w));
  const matchesOthers = unique.filter(w => !materials.includes(w) && !colors.includes(w));
  
  const reordered = [...matchesColors, ...matchesMaterials, ...matchesOthers];
  
  return reordered.join(' ');
}

// ── Japanese ↔ English translation for multi-language stores ──

const EN_TO_JA: Record<string, string> = {
  'shirt': 'シャツ', 'shirts': 'シャツ', 't-shirt': 'Tシャツ', 'tee': 'Tシャツ',
  'pants': 'パンツ', 'trousers': 'パンツ', 'jeans': 'ジーンズ',
  'jacket': 'ジャケット', 'coat': 'コート', 'sweater': 'セーター',
  'hoodie': 'フーディー', 'cardigan': 'カーディガン', 'vest': 'ベスト', 'blazer': 'ブレザー',
  'dress': 'ワンピース', 'skirt': 'スカート', 'shorts': 'ショーツ',
  'shoes': '靴', 'sneakers': 'スニーカー', 'boots': 'ブーツ',
  'sandals': 'サンダル', 'loafers': 'ローファー',
  'bag': 'バッグ', 'bags': 'バッグ', 'backpack': 'リュック',
  'hat': '帽子', 'cap': 'キャップ', 'belt': 'ベルト',
  'wallet': '財布', 'socks': '靴下', 'scarf': 'スカーフ',
  'linen': 'リネン', 'cotton': 'コットン', 'wool': 'ウール',
  'silk': 'シルク', 'leather': 'レザー', 'denim': 'デニム',
  'cashmere': 'カシミヤ', 'fleece': 'フリース', 'nylon': 'ナイロン',
};

const JA_TO_EN: Record<string, string> = {
  'シャツ': 'shirt', 'Tシャツ': 't-shirt', 'パンツ': 'pants',
  'ジーンズ': 'jeans', 'デニム': 'denim', 'ジャケット': 'jacket',
  'コート': 'coat', 'セーター': 'sweater', 'フーディー': 'hoodie',
  'カーディガン': 'cardigan', 'ベスト': 'vest', 'ブレザー': 'blazer',
  'ワンピース': 'dress', 'スカート': 'skirt', 'ショーツ': 'shorts',
  '靴': 'shoes', 'スニーカー': 'sneakers', 'ブーツ': 'boots',
  'サンダル': 'sandals', 'ローファー': 'loafers',
  'バッグ': 'bag', 'リュック': 'backpack',
  '帽子': 'hat', 'キャップ': 'cap', 'ベルト': 'belt',
  '財布': 'wallet', '靴下': 'socks', 'スカーフ': 'scarf',
  'リネン': 'linen', 'コットン': 'cotton', 'ウール': 'wool',
  'シルク': 'silk', 'レザー': 'leather',
  'カシミヤ': 'cashmere', 'フリース': 'fleece', 'ナイロン': 'nylon',
};

function detectQueryLanguage(query: string): string {
  if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(query)) return 'ja';
  return 'en';
}

function translateEnToJa(query: string): string {
  const words = query.toLowerCase().split(/\s+/);
  const translated = words.map(w => EN_TO_JA[w]).filter(Boolean);
  return translated.length > 0 ? translated.join(' ') : '';
}

function translateJaToEn(query: string): string {
  // Try exact word matches first (space-separated)
  const words = query.split(/\s+/);
  const translated: string[] = [];
  for (const word of words) {
    if (JA_TO_EN[word]) {
      translated.push(JA_TO_EN[word]);
    } else {
      // Try substring matching for compound Japanese words
      let found = false;
      for (const [ja, en] of Object.entries(JA_TO_EN)) {
        if (word.includes(ja)) {
          translated.push(en);
          found = true;
          break;
        }
      }
      if (!found && /^[a-zA-Z0-9\-]+$/.test(word)) {
        translated.push(word);
      }
    }
  }
  return translated.length > 0 ? translated.join(' ') : '';
}

function getTranslatedQueries(query: string, storeLanguages: string[]): string[] {
  if (!storeLanguages || storeLanguages.length <= 1) return [];
  const queryLang = detectQueryLanguage(query);
  const translations: string[] = [];
  for (const lang of storeLanguages) {
    if (lang === queryLang) continue;
    let translated = '';
    if (queryLang === 'en' && lang === 'ja') translated = translateEnToJa(query);
    else if (queryLang === 'ja' && lang === 'en') translated = translateJaToEn(query);
    if (translated && translated.trim()) translations.push(translated.trim());
  }
  return translations;
}

function cleanQueryForStorefront(query: string): string {
  const parts = query.split(/\s+OR\s+/i).map(p => p.trim()).filter(Boolean);
  if (parts.length === 0) return '';
  
  // Find the first part that is primarily English/ASCII (since all stores are English-based)
  // We check if it doesn't contain non-ASCII characters (like Vietnamese diacritics)
  for (const part of parts) {
    const isEnglish = !/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(part);
    if (isEnglish) {
      return part;
    }
  }
  
  // If no part is English (e.g. the query is entirely Vietnamese), translate the first part to English!
  const translated = translateVietnameseToEnglish(parts[0]);
  if (translated) {
    return translated;
  }
  
  // Fallback to the first part
  return parts[0];
}

function splitCatalogQuery(query: string) {
  return normalizeCatalogQuery(query)
    .split(/\s+OR\s+/i)
    .map(part => part.trim())
    .filter(Boolean)
    .slice(0, 6);
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "top": [
    "shirt", "shirts", "t-shirt", "t-shirts", "tee", "tees", "top", "tops", "tank", "tanks", 
    "blouse", "blouses", "crop", "henley", "polo", "sơ mi", "ao", "áo", "シャツ", "셔츠", "camisa"
  ],
  "bottom": [
    "short", "shorts", "pants", "trouser", "trousers", "jean", "jeans", "denim", "skirt", "skirts", 
    "leggings", "jogger", "joggers", "sweatpant", "sweatpants", "quần", "裤"
  ],
  "dress": [
    "dress", "dresses", "gown", "gowns", "jumpsuit", "jumpsuits", "bodysuit", "bodysuits", 
    "romper", "rompers", "váy", "đầm", "ワンピース"
  ],
  "outerwear": [
    "jacket", "jackets", "coat", "coats", "hoodie", "hoodies", "sweatshirt", "sweatshirts", 
    "sweater", "sweaters", "cardigan", "cardigans", "blazer", "blazers", "fleece", "vest", "vests", 
    "khoác", "len", "ジャケット", "코트"
  ],
  "footwear": [
    "shoe", "shoes", "sneaker", "sneakers", "boot", "boots", "sandal", "sandals", "heel", "heels", 
    "slide", "slides", "loafer", "loafers", "giày", "dép", "guốc", "shoes", "boots", "sneakers", "靴", "신발"
  ],
  "underwear": [
    "sock", "socks", "underwear", "bra", "bras", "briefs", "boxer", "boxers", "thong", "thongs", 
    "sleepwear", "robe", "robes", "lingerie", "vớ", "sịp", "lót", "下着", "속옷"
  ],
  "accessory": [
    "bag", "bags", "backpack", "backpacks", "hat", "hats", "cap", "caps", "belt", "belts", 
    "sunglasses", "túi", "ví", "mũ", "nón", "kính", "バッグ", "모자"
  ]
};

function getMatchingDomains(query: string): string[] {
  const normalized = query.toLowerCase();
  const words = normalized
    .replace(/[()\"',]/g, ' ')
    .split(/\s+/)
    .map(w => w.trim())
    .filter(Boolean);

  const matchedCategories = new Set<string>();

  for (const word of words) {
    if (word === 'or' || word === 'and') continue;
    
    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      if (keywords.some(kw => {
        if (kw.length < 3) {
          return word === kw;
        }
        return word.includes(kw) || kw.includes(word);
      })) {
        matchedCategories.add(category);
      }
    }
  }

  if (matchedCategories.size === 0) {
    console.log(`[GlobalCatalog] No specific category matched for query "${query}". Using all stores.`);
    return UCP_REGISTRY.map(s => s.domain.toLowerCase().trim());
  }

  const matchedDomains = UCP_REGISTRY.filter(store => 
    store.categories.some(cat => matchedCategories.has(cat))
  ).map(s => s.domain.toLowerCase().trim());

  console.log(`[GlobalCatalog] Query "${query}" matched categories [${Array.from(matchedCategories).join(', ')}]. Selected ${matchedDomains.length} of ${UCP_REGISTRY.length} stores.`);

  if (matchedDomains.length === 0) {
    return UCP_REGISTRY.map(s => s.domain.toLowerCase().trim());
  }

  return matchedDomains;
}

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
    } catch (e) {
      console.warn('Failed to parse stringified UCP response:', e);
    }
  }
  if (data?.result?.products) {
    return data.result.products;
  }
  return [];
}

function getProductKeywords(query: string): string[] {
  const cleaned = query
    .replace(/\b(and|or)\b/gi, ' ')
    .replace(/domain:\S+/gi, ' ')
    .replace(/[()\"']/g, ' ')
    .toLowerCase();
  
  const words = cleaned.split(/\s+/).map(w => w.trim()).filter(w => {
    return w.length >= 2 && 
           !w.includes('.') && 
           !w.includes('/') && 
           !w.includes(':') &&
           w !== 'in' && w !== 'on' && w !== 'at' && w !== 'for' && w !== 'with' && w !== 'the' && w !== 'and' && w !== 'buy';
  });

  return Array.from(new Set(words));
}

const MATERIALS = [
  'linen', 'cotton', 'wool', 'silk', 'leather', 'denim', 'canvas', 'hemp', 'cashmere', 'satin', 'velvet', 'lace',
  'lanh', 'len', 'lụa', 'tơ', 'da', 'bò', 'kaki', 'polyester', 'nylon', 'spandex', 'fleece'
];

const MATERIAL_SYNONYMS: Record<string, string[]> = {
  'linen': ['linen', 'lanh'],
  'lanh': ['linen', 'lanh'],
  'cotton': ['cotton', 'thun'],
  'wool': ['wool', 'len'],
  'len': ['wool', 'len'],
  'silk': ['silk', 'lụa', 'tơ'],
  'lụa': ['silk', 'lụa', 'tơ'],
  'tơ': ['silk', 'lụa', 'tơ'],
  'leather': ['leather', 'da'],
  'da': ['leather', 'da'],
  'denim': ['denim', 'bò', 'jean', 'jeans'],
  'bò': ['denim', 'bò', 'jean', 'jeans'],
  'jean': ['denim', 'bò', 'jean', 'jeans'],
  'jeans': ['denim', 'bò', 'jean', 'jeans']
};

function isProductQueryMismatch(product: UcpProduct, query: string): boolean {
  const normalizedQuery = query.toLowerCase();
  const searchableText = `${product.title} ${product.description || ''}`.toLowerCase();

  const queryKeywords = getProductKeywords(normalizedQuery);
  if (queryKeywords.length === 0) return false;

  // 1. Material check
  const queryMaterials = MATERIALS.filter(mat => 
    queryKeywords.some(kw => kw === mat || kw.includes(mat) || mat.includes(kw))
  );

  if (queryMaterials.length > 0) {
    const hasMaterial = queryMaterials.some(mat => {
      const synonyms = MATERIAL_SYNONYMS[mat] || [mat];
      return synonyms.some(syn => searchableText.includes(syn));
    });
    if (!hasMaterial) {
      return true; // Mismatch because of material
    }
  }

  // 2. Category check
  const queryCategories = new Set<string>();
  for (const kw of queryKeywords) {
    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      if (keywords.some(k => kw === k || kw.includes(k) || k.includes(kw))) {
        queryCategories.add(category);
      }
    }
  }

  if (queryCategories.size > 0) {
    const productCategories = new Set<string>();
    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      if (keywords.some(k => searchableText.includes(k))) {
        productCategories.add(category);
      }
    }

    if (productCategories.size > 0) {
      const matchesQueryCategory = Array.from(queryCategories).some(cat => productCategories.has(cat));
      if (!matchesQueryCategory) {
        return true; // Mismatch because of category
      }
    }
  }

  return false;
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



function calculateTrustScore(product: UcpProduct, mandatoryConcepts: string[][] = []): number {
  let hash = 0;
  const vendor = product.vendor || 'Unknown';
  for (let i = 0; i < vendor.length; i++) {
    hash = vendor.charCodeAt(i) + ((hash << 5) - hash);
  }
  let baseScore = 70 + (Math.abs(hash) % 25); // 70 to 94

  // Bonuses
  if (product.tags && product.tags.length > 0) baseScore += 2;
  if (product.options && product.options.length > 0) baseScore += 2;
  if (product.description && product.description.length > 100) baseScore += 2;

  // Concept matching bonus in Title or Vendor
  if (mandatoryConcepts.length > 0) {
    const titleAndVendor = `${product.title} ${vendor}`.toLowerCase();
    for (const conceptGroup of mandatoryConcepts) {
      if (!conceptGroup || conceptGroup.length === 0) continue;
      const matched = conceptGroup.some(word => titleAndVendor.includes(word.toLowerCase().trim()));
      if (matched) {
        baseScore += 10;
      }
    }
  }

  return Math.min(100, baseScore);
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

function cleanBrandName(domain: string): string {
  if (!domain) return '';
  let cleaned = domain.toLowerCase().trim();
  
  // Remove protocols
  cleaned = cleaned.replace(/^(https?:\/\/)?(www\.)?/, '');
  cleaned = cleaned.split('/')[0];

  // If it ends with myshopify.com, get the part right before myshopify
  if (cleaned.includes('.myshopify.com')) {
    const parts = cleaned.replace(/\.myshopify\.com$/, '').split('.');
    cleaned = parts[parts.length - 1];
  } else {
    // Split by . and filter out TLDs
    const parts = cleaned.split('.');
    const tlds = new Set(['com', 'co', 'uk', 'org', 'net', 'store', 'in', 'us', 'ca', 'au', 'io', 'website', 'com', 'au', 'me', 'ph', 'ae', 'fr', 'eu', 'gr', 'it', 'co', 'id', 'xyz', 'cc']);
    const nonTlds = parts.filter(p => !tlds.has(p));
    if (nonTlds.length > 0) {
      cleaned = nonTlds[nonTlds.length - 1];
    } else {
      cleaned = parts[0];
    }
  }

  // Remove all hyphens and underscores to handle "alo-yoga" -> "aloyoga"
  cleaned = cleaned.replace(/[\-_]/g, '');

  // Remove common prefixes
  cleaned = cleaned.replace(/^(shop|weare|the|buy|get|official|studio|wear)\-?/i, '');
  
  // Remove common suffixes
  cleaned = cleaned.replace(/\-?(shop|store|clothing|brand|official|studio|wear|collective|denim)$/i, '');
  
  return cleaned;
}

function isDomainMatch(productDomain: string, allowedDomain: string): boolean {
  const p = cleanBrandName(productDomain);
  const a = cleanBrandName(allowedDomain);
  if (!p || !a) return false;
  // Exact match
  if (p === a) return true;
  // Fuzzy: one contains or starts with the other (handles regional suffixes like "gymsharkusa" ↔ "gymshark")
  if (p.length >= 3 && a.length >= 3) {
    if (p.startsWith(a) || a.startsWith(p)) return true;
  }
  return false;
}

function getProductStoreDomain(product: UcpProduct): string {
  try {
    const urlObj = new URL(product.store_url);
    return urlObj.hostname.replace(/^www\./i, '').toLowerCase().trim();
  } catch {
    if (product.vendor && product.vendor.includes('.')) {
      return product.vendor.replace(/^www\./i, '').toLowerCase().trim();
    }
    return '';
  }
}

function applyCatalogFilters(products: UcpProduct[], filters: CatalogSearchFilters) {
  const excludeIds = new Set(filters.excludeIds || []);
  const sort = filters.sort || 'trust_desc';
  const budgetCurrency = normalizeCurrency(filters.budgetCurrency);

  let filtered = products.filter(product => {
    if (excludeIds.has(product.id)) return false;

    // Strict allowed store filtering with domain matching
    const storeDomain = getProductStoreDomain(product);
    const hasMatch = UCP_REGISTRY.some(s => isDomainMatch(storeDomain, s.domain));
    if (!hasMatch) {
      return false;
    }


    if (
      filters.budgetMax &&
      filters.budgetMax > 0 &&
      convertProductPrice(product, budgetCurrency, filters.rates) > filters.budgetMax
    ) {
      return false;
    }

    // mandatoryConcepts are used for trust_score ranking only, not hard filtering.
    // Products from verified stores (already filtered by domain above) should not be
    // excluded just because their title/description is in a different language than
    // the AI's concept synonyms. The Shopify Catalog API query already handles relevance.

    return true;
  });

  const isMismatch = (p: UcpProduct) => (p.trust_score || 0) < 40;

  filtered = [...filtered].sort((a, b) => {
    const mismatchA = isMismatch(a);
    const mismatchB = isMismatch(b);
    if (mismatchA !== mismatchB) {
      return mismatchA ? 1 : -1;
    }

    if (sort === 'trust_desc') {
      return (b.trust_score || 0) - (a.trust_score || 0);
    } else if (sort !== 'relevance') {
      const priceA = convertProductPrice(a, budgetCurrency, filters.rates);
      const priceB = convertProductPrice(b, budgetCurrency, filters.rates);
      return sort === 'price_desc' ? priceB - priceA : priceA - priceB;
    }
    return 0;
  });

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
    sort: ProductSort = 'trust_desc',
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
    const cleanedQuery = cleanQueryForStorefront(normalizedQuery);
    if (!cleanedQuery) return [];

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

    const parseProduct = (p: any, defaultVendor?: string): UcpProduct | null => {
      try {
        const variant = p.variants?.[0] || {};
        const priceAmount = variant.price?.amount ?? p.price_range?.min?.amount ?? 0;
        const currency = variant.price?.currency ?? p.price_range?.min?.currency ?? 'USD';
        
        let vendor = 'Independent Seller';
        if (variant.seller?.name) {
          vendor = variant.seller.name;
        } else if (variant.seller?.domain) {
          vendor = variant.seller.domain;
        } else if (defaultVendor) {
          const cleanBrand = cleanBrandName(defaultVendor);
          vendor = cleanBrand ? cleanBrand.charAt(0).toUpperCase() + cleanBrand.slice(1) : defaultVendor;
        }

        let store_url = variant.url || p.url || '';
        if (store_url.startsWith('/')) {
          const base = defaultVendor ? (defaultVendor.startsWith('http') ? defaultVendor : `https://${defaultVendor}`) : '';
          store_url = `${base}${store_url}`;
        } else if (!store_url && defaultVendor) {
          store_url = `https://${defaultVendor}/products/${p.id.split('/').pop()}`;
        } else if (!store_url && variant.seller?.domain) {
          store_url = `https://${variant.seller.domain}/products/${p.id.split('/').pop()}`;
        }
        
        try {
          if (store_url) {
            const urlObj = new URL(store_url);
            urlObj.searchParams.set('ref', 'from_ai_affiliate');
            store_url = urlObj.toString();
          }
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

        const productData = {
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



        let trustScore = calculateTrustScore(productData as UcpProduct, mandatoryConcepts);
        if (isProductQueryMismatch(productData as UcpProduct, cleanedQuery)) {
          trustScore = Math.max(0, trustScore - 60);
        }
        return {
          ...productData,
          trust_score: trustScore
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

    const allowedDomains = getMatchingDomains(cleanedQuery);

    const fetchChunkedFromCatalog = async (q: string): Promise<any[]> => {
      // Dynamically size chunks based on query complexity.
      // More OR terms in the query → fewer domains per chunk to stay
      // within Shopify Catalog API query complexity limits.
      // This preserves ALL multilingual search terms (e.g., シャツ, 셔츠, camisa).
      const orTermCount = splitCatalogQuery(q).length;
      const chunkSize = orTermCount <= 2 ? 10 : orTermCount <= 4 ? 7 : 5;
      
      const chunks: string[][] = [];
      for (let i = 0; i < allowedDomains.length; i += chunkSize) {
        chunks.push(allowedDomains.slice(i, i + chunkSize));
      }

      console.log(`[GlobalCatalog] Querying global catalog in ${chunks.length} chunks (size=${chunkSize}) for ${allowedDomains.length} domains (${orTermCount} search terms)...`);
      const startTime = Date.now();

      const promises = chunks.map(async (chunk, index) => {
        const domainClause = chunk.map(d => `"${d}"`).join(" OR ");
        const chunkQuery = `(${q}) AND (${domainClause})`;


        const filters: any = { available: true };
        if (normalizedCountryCode) {
          filters.ships_to = { country: normalizedCountryCode };
        }

        const payload = {
          jsonrpc: "2.0",
          method: "tools/call",
          id: `chunk-${index}`,
          params: {
            name: "search_catalog",
            arguments: {
              meta: {
                "ucp-agent": {
                  profile: "https://shopify.dev/ucp/agent-profiles/2026-04-08/valid-with-capabilities.json"
                }
              },
              catalog: {
                query: chunkQuery,
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
          if (!res.ok) {
            console.warn(`[GlobalCatalog] Chunk query HTTP error status for chunk index ${index}: ${res.status}`);
            return [];
          }
          const rawJson = await res.json();
          const products = rawJson.result?.structuredContent?.products || [];
          console.log(`[GlobalCatalog] Chunk ${index} query returned ${products.length} products (HTTP status ${res.status})`);
          return products;
        } catch (err) {
          console.warn(`[GlobalCatalog] Chunk query failed for chunk index ${index}:`, err);
          return [];
        }
      });

      const results = await Promise.all(promises);
      console.log(`[GlobalCatalog] Chunk queries finished in ${Date.now() - startTime}ms`);
      return uniqueById(results.flat());
    };

    const parseRawProducts = (raw: any[]) => {
      const parsed: UcpProduct[] = [];
      let skippedNoImage = 0;
      for (const p of raw) {
        const item = parseProduct(p, p._directDomain);
        if (item && item.image_url && item.image_url.trim().length > 0) {
          parsed.push(item);
        } else if (item) {
          skippedNoImage++;
        }
      }
      return { parsed, skippedNoImage };
    };

    let rawProducts: any[] = [];
    const isFallback = allowedDomains.length === UCP_REGISTRY.length;

    if (!isFallback) {
      const rawQueryParts = splitCatalogQuery(normalizedQuery).slice(0, 2);
      const queryParts = Array.from(new Set(rawQueryParts.map(part => {
        const hasVietnamese = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(part);
        if (hasVietnamese) {
          const translated = translateVietnameseToEnglish(part);
          return translated || part;
        }
        return part;
      })));
      console.log(`[GlobalCatalog] Target match found. Querying ${allowedDomains.length} storefront MCPs in parallel for parts [${queryParts.join(', ')}]...`);
      const startTime = Date.now();
      
      const queryLang = detectQueryLanguage(queryParts[0]);

      const promises = allowedDomains.flatMap((domain) => {
        const storeProfile = UCP_REGISTRY.find(s => s.domain.toLowerCase().trim() === domain);
        const storeLanguages = storeProfile?.languages || ['en'];
        const primaryLang = storeLanguages[0];

        let storeParts: string[];

        if (storeLanguages.length > 1) {
          // Multi-language store: query in all supported languages
          const allParts = new Set(queryParts);
          for (const part of queryParts) {
            for (const lang of storeLanguages) {
              if (lang === queryLang) continue;
              let translated = '';
              if (queryLang === 'en' && lang === 'ja') translated = translateEnToJa(part);
              else if (queryLang === 'ja' && lang === 'en') translated = translateJaToEn(part);
              if (translated?.trim()) allParts.add(translated.trim());
            }
          }
          storeParts = Array.from(allParts);
          if (storeParts.length > queryParts.length) {
            console.log(`[GlobalCatalog] Multi-language store ${domain}: query in ${storeLanguages.join('+')} → [${storeParts.join(', ')}]`);
          }
        } else if (queryLang !== primaryLang) {
          // Single-language store, query is in wrong language → translate
          const translated: string[] = [];
          for (const part of queryParts) {
            let t = '';
            if (queryLang === 'ja' && primaryLang === 'en') t = translateJaToEn(part);
            else if (queryLang === 'en' && primaryLang === 'ja') t = translateEnToJa(part);
            if (t?.trim()) translated.push(t.trim());
          }
          storeParts = translated.length > 0 ? translated : queryParts;
        } else {
          // Same language → use original
          storeParts = queryParts;
        }

        return storeParts.map(async (part) => {
          const endpoint = `https://${domain}/api/mcp`;
          
          const filters: any = { available: true };
          if (normalizedCountryCode) {
            filters.ships_to = { country: normalizedCountryCode };
          }

          const payload = {
            jsonrpc: "2.0",
            method: "tools/call",
            id: 1,
            params: {
              name: "search_catalog",
              arguments: {
                catalog: {
                  query: part,
                  filters,
                  pagination: { limit: catalogPageLimit }
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
            
            if (!res.ok) {
              console.warn(`[GlobalCatalog] Direct MCP query failed for ${domain} with query "${part}" status ${res.status}`);
              return { domain, products: [] };
            }
            
            const data = await res.json();
            const parsedProducts = parseProductsFromMcpResult(data);
            
            return { domain, products: parsedProducts };
          } catch (err: any) {
            console.warn(`[GlobalCatalog] Direct MCP query error for ${domain} with query "${part}":`, err.message || err);
            return { domain, products: [] };
          }
        });
      });

      // Progressive accumulation: collect results as stores respond,
      // return early once we have enough products instead of waiting for all stores
      const EARLY_RETURN_THRESHOLD = 30; // raw products needed for early return (1 page)
      const EARLY_RETURN_TIMEOUT_MS = isFastFirstPage ? 2000 : 4000;
      const directProducts: any[] = [];
      let resolvedCount = 0;

      const collectResult = (res: { domain: string; products: any[] }) => {
        for (const p of res.products) {
          p._directDomain = res.domain;
          directProducts.push(p);
        }
        resolvedCount++;
      };

      await new Promise<void>((resolve) => {
        let settled = false;
        const total = promises.length;

        const tryResolve = () => {
          if (settled) return;
          if (resolvedCount >= total) {
            settled = true;
            resolve();
          } else if (directProducts.length >= EARLY_RETURN_THRESHOLD) {
            settled = true;
            console.log(`[GlobalCatalog] Early return: ${directProducts.length} products from ${resolvedCount}/${total} stores in ${Date.now() - startTime}ms`);
            resolve();
          }
        };

        // Attach .then to each promise to collect results progressively
        for (const p of promises) {
          p.then((res) => {
            if (res) collectResult(res);
            tryResolve();
          }).catch(() => {
            resolvedCount++;
            tryResolve();
          });
        }

        // Timeout: resolve with whatever we have
        setTimeout(() => {
          if (!settled) {
            settled = true;
            console.log(`[GlobalCatalog] Timeout return: ${directProducts.length} products from ${resolvedCount}/${total} stores in ${Date.now() - startTime}ms`);
            resolve();
          }
        }, EARLY_RETURN_TIMEOUT_MS);
      });

      console.log(`[GlobalCatalog] Direct storefront queries finished in ${Date.now() - startTime}ms. Fetched ${directProducts.length} raw products (${resolvedCount}/${promises.length} stores responded).`);
      rawProducts = directProducts;
    } else {
      console.log(`[GlobalCatalog] No targeted match. Falling back to Global Catalog MCP.`);
      rawProducts = await fetchChunkedFromCatalog(cleanedQuery);
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


    console.log(`[GlobalCatalog] raw=${rawProducts.length}, parsed_with_image=${products.length}, skipped_no_image=${skippedNoImage}, fast=${isFastFirstPage}`);

    if (products.length > 0) {
      const merged = uniqueById([...(cached?.products || []), ...products]);
      searchCache.set(cacheKey, { timestamp: Date.now(), products: merged });
    }

    console.log(`[GlobalCatalog] returning ${filteredProducts.length} of ${products.length} (limit=${limit}, fast=${isFastFirstPage})`);
    return filteredProducts;
  }
}
