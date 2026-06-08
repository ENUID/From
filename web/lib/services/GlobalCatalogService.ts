import { getExchangeRates } from '../exchangeRates';
import { UCP_REGISTRY, detectBrandsInQuery, BRAND_NAMES } from '../stores';
import { groqChat } from '../groq';


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
  description_html?: string;
  options?: { name: string; values: string[] }[];
  media?: Array<{ type: string; url: string; alt?: string }>;
  variants?: Array<{
    id: string;
    title: string;
    price: number;
    availability: boolean;
    options: Array<{ name: string; label: string }>;
    media?: Array<{ url: string; alt?: string }>;
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
const FAST_PAGE_LIMIT = 50;
const CATALOG_PAGE_LIMIT = 60;
const REFRESH_PAGE_LIMIT = 60;
const FAST_SUBQUERY_LIMIT = 3;
const INITIAL_RESULT_LIMIT = 50;
const LOAD_MORE_RESULT_LIMIT = 100;
const searchCache = new Map<string, { timestamp: number, products: UcpProduct[], nextChunkIndex?: number }>();

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

const COMMON_ENGLISH_WORDS = new Set([
  // Categories
  'shirt', 'shirts', 't-shirt', 't-shirts', 'tee', 'tees', 'top', 'tops', 'tank', 'tanks',
  'blouse', 'blouses', 'crop', 'polo', 'polos', 'henley', 'henleys',
  'pants', 'jeans', 'trousers', 'shorts', 'bottom', 'bottoms', 'leggings', 'joggers', 'sweatpants',
  'jacket', 'jackets', 'coat', 'coats', 'hoodie', 'hoodies', 'sweater', 'sweaters', 'cardigan', 'cardigans',
  'blazer', 'blazers', 'suit', 'suits', 'vest', 'vests',
  'dress', 'dresses', 'skirt', 'skirts', 'gown', 'gowns',
  'shoes', 'sneakers', 'boots', 'sandals', 'loafers', 'flats', 'heels', 'slippers', 'footwear',
  'socks', 'underwear', 'bra', 'boxers', 'briefs', 'swimwear', 'bikini',
  'bag', 'bags', 'backpack', 'backpacks', 'wallet', 'wallets', 'purse', 'purses',
  'hat', 'hats', 'cap', 'caps', 'beanie', 'beanies', 'belt', 'belts', 'scarf', 'scarves', 'gloves',
  'glasses', 'sunglasses', 'watch', 'watches', 'jewelry', 'ring', 'rings', 'necklace', 'necklaces',
  'bracelet', 'bracelets', 'earrings',

  // Materials
  'linen', 'cotton', 'silk', 'wool', 'leather', 'denim', 'suede', 'velvet', 'nylon', 'polyester',
  'knit', 'fleece', 'canvas', 'cashmere', 'satin', 'lace', 'fur', 'shearling', 'corduroy',

  // Colors
  'black', 'white', 'grey', 'gray', 'red', 'blue', 'green', 'yellow', 'pink', 'purple',
  'orange', 'brown', 'beige', 'navy', 'gold', 'silver', 'olive', 'khaki', 'cream', 'charcoal',
  'tan', 'mustard', 'burgundy', 'maroon', 'teal', 'turquoise',

  // Descriptors/Adjectives/Sizes/Numbers
  'mens', 'womens', 'kids', 'unisex', 'casual', 'formal', 'vintage', 'classic', 'modern',
  'sport', 'sports', 'running', 'active', 'outdoor', 'indoor', 'summer', 'winter', 'spring',
  'autumn', 'fall', 'light', 'heavy', 'warm', 'cool', 'soft', 'hard', 'stretch', 'slim',
  'loose', 'oversized', 'regular', 'fit', 'size', 'xs', 's', 'm', 'l', 'xl', 'xxl',
  'striped', 'plain', 'patterned', 'floral', 'printed', 'graphic', 'long', 'short', 'sleeve',
  'sleeveless', 'neck', 'vneck', 'crewneck', 'collar', 'collared', 'button', 'buttondown',
  'zip', 'zipper', 'pocket', 'pockets', 'hooded',

  // Common prepositions/conjunctions/articles
  'a', 'an', 'the', 'with', 'in', 'on', 'for', 'of', 'and', 'or', 'by', 'to', 'from'
]);

const translationCache = new Map<string, string>();

function isTriviallyEnglish(query: string): boolean {
  if (/[^\x00-\x7F]/.test(query)) return false;
  
  const words = query.toLowerCase().split(/[\s\-_',.()&/]+/).filter(Boolean);
  if (words.length === 0) return false;
  
  return words.every(word => COMMON_ENGLISH_WORDS.has(word) || /^\d+%?$/.test(word));
}

async function cleanQueryForStorefront(query: string): Promise<string> {
  const parts = query.split(/\s+OR\s+/i).map(p => p.trim()).filter(Boolean);
  if (parts.length === 0) return '';
  
  const translatedParts: string[] = [];
  
  for (const part of parts) {
    if (isTriviallyEnglish(part)) {
      translatedParts.push(part);
      continue;
    }
    
    // Check cache
    const cacheKey = part.toLowerCase();
    if (translationCache.has(cacheKey)) {
      translatedParts.push(translationCache.get(cacheKey)!);
      continue;
    }
    
    // Call LLM
    try {
      const systemPrompt = `You are a professional search query translator.
Translate the input search query from any language (Vietnamese, Japanese, Chinese, French, Spanish, Korean, etc.) to a clean, simple, lowercase English search query suitable for a clothing storefront (e.g. "shirt", "linen pants", "black leather shoes").
- If the query contains multiple items, translate them clearly.
- If the query is already in English, output it exactly as-is.
- Output ONLY the translated English search query. Do not include any explanations, quotes, preambles, or punctuation.`;

      const response = await groqChat([
        { role: 'user', content: part }
      ], systemPrompt, undefined, { temperature: 0, max_tokens: 30 });
      
      const translated = response?.content?.trim() || '';
      const cleanedTranslation = translated
        .replace(/^["']|["']$/g, '') // strip wrapping quotes
        .trim();
        
      if (cleanedTranslation) {
        console.log(`[GlobalCatalog] LLM translated "${part}" to "${cleanedTranslation}"`);
        translationCache.set(cacheKey, cleanedTranslation);
        translatedParts.push(cleanedTranslation);
      } else {
        throw new Error('Empty LLM response');
      }
    } catch (err) {
      console.warn(`[GlobalCatalog] LLM translation failed for "${part}", falling back to dictionary:`, err);
      // Fallback to local dictionary translation
      const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(part);
      if (hasJapanese) {
        const ja = translateJaToEn(part);
        if (ja) {
          translatedParts.push(ja);
          continue;
        }
      }
      const vi = translateVietnameseToEnglish(part);
      if (vi) {
        translatedParts.push(vi);
        continue;
      }
      translatedParts.push(part);
    }
  }
  
  const uniqueParts = Array.from(new Set(translatedParts));
  return uniqueParts.join(' OR ');
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
    "slide", "slides", "loafer", "loafers", "giày", "dép", "guốc", "靴", "신발", "footwear", "mule", "mules",
    "oxford", "oxfords", "derby", "derbies", "chelsea", "espadrille", "espadrilles", "clog", "clogs"
  ],
  "underwear": [
    "sock", "socks", "underwear", "bra", "bras", "briefs", "boxer", "boxers", "thong", "thongs",
    "sleepwear", "robe", "robes", "lingerie", "vớ", "sịp", "lót", "下着", "속옷"
  ],
  "accessory": [
    "bag", "bags", "backpack", "backpacks", "tote", "totes", "pouch", "pouches", "clutch", "clutches",
    "wallet", "wallets", "purse", "purses", "cardholder", "cardholders", "card holder",
    "hat", "hats", "cap", "caps", "beanie", "beanies",
    "belt", "belts", "sunglasses", "glasses", "scarf", "scarves",
    "watch", "watches", "jewelry", "jewellery", "necklace", "necklaces", "bracelet", "bracelets",
    "earring", "earrings", "ring", "rings", "pendant",
    "keychain", "keychains", "key chain", "luggage tag", "luggage tags",
    "túi", "ví", "mũ", "nón", "kính", "バッグ", "모자"
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

// ── Attribute matching (gender / colour / garment type) ────────────────────
// These run as HARD filters so an explicit request ("men's t-shirt", "sky blue")
// can never be satisfied with the opposite gender, a different colour, or the
// wrong garment. Whole-word matching avoids "men" matching inside "women" and
// "tan" matching inside "tank".

function hasWord(text: string, word: string): boolean {
  return new RegExp(`(?:^|[^a-z])${word.replace(/\s+/g, '[\\s-]*')}(?:[^a-z]|$)`, 'i').test(text);
}

function detectGender(text: string): 'men' | 'women' | 'kids' | null {
  const women = /(?:^|[^a-z])(women|woman|womens|womenswear|ladies|lady|female|girls?)(?:[^a-z]|$)/i.test(text);
  const men   = /(?:^|[^a-z])(men|man|mens|menswear|male|guys?|boys?|gentlemen)(?:[^a-z]|$)/i.test(text);
  const kids  = /(?:^|[^a-z])(kids?|children|child|toddler|infant|baby)(?:[^a-z]|$)/i.test(text);
  if (kids && !women && !men) return 'kids';
  if (women && !men) return 'women';
  if (men && !women) return 'men';
  return null; // unisex, ambiguous, or unmarked
}

// Colour vocabulary; sub-shades map to a base so "sky blue" still matches "blue".
const COLOR_TERMS: string[] = [
  'black', 'white', 'ivory', 'cream', 'beige', 'tan', 'camel', 'khaki', 'olive', 'sage',
  'green', 'mint', 'emerald', 'forest', 'blue', 'sky blue', 'navy', 'teal', 'turquoise',
  'indigo', 'cobalt', 'red', 'maroon', 'burgundy', 'wine', 'crimson', 'pink', 'rose',
  'fuchsia', 'blush', 'coral', 'peach', 'purple', 'lavender', 'lilac', 'violet', 'plum',
  'yellow', 'mustard', 'gold', 'orange', 'rust', 'terracotta', 'brown', 'chocolate', 'mocha',
  'grey', 'gray', 'charcoal', 'slate', 'silver', 'taupe',
];
const COLOR_BASE: Record<string, string> = {
  'sky blue': 'blue', 'navy': 'blue', 'teal': 'blue', 'turquoise': 'blue', 'indigo': 'blue', 'cobalt': 'blue',
  'maroon': 'red', 'burgundy': 'red', 'wine': 'red', 'crimson': 'red',
  'rose': 'pink', 'fuchsia': 'pink', 'blush': 'pink',
  'lavender': 'purple', 'lilac': 'purple', 'violet': 'purple', 'plum': 'purple',
  'mustard': 'yellow', 'gold': 'yellow',
  'rust': 'orange', 'peach': 'orange', 'coral': 'orange', 'terracotta': 'orange',
  'chocolate': 'brown', 'camel': 'brown', 'tan': 'brown', 'mocha': 'brown', 'taupe': 'brown',
  'charcoal': 'grey', 'gray': 'grey', 'silver': 'grey', 'slate': 'grey',
  'sage': 'green', 'olive': 'green', 'mint': 'green', 'emerald': 'green', 'forest': 'green',
  'cream': 'white', 'ivory': 'white', 'beige': 'white',
};

// Garment-type precision: distinguish a casual tee from a button-up/formal shirt.
const TEE_MARKERS = ['t-shirt', 't shirt', 'tshirt', 'tee', 'tees'];
const FORMAL_SHIRT_MARKERS = ['button-up', 'button up', 'button-down', 'button down', 'dress shirt', 'oxford shirt', 'poplin', 'flannel shirt', 'overshirt', 'camp collar', 'linen shirt'];

function isProductQueryMismatch(product: UcpProduct, query: string): boolean {
  const normalizedQuery = query.toLowerCase();
  // Include tags so "shoe" tags on a shoe product don't get missed
  const searchableText = [
    product.title,
    product.description || '',
    ...(product.tags || []),
    ...(product.options?.flatMap(o => [o.name, ...o.values]) || []),
  ].join(' ').toLowerCase();

  const queryKeywords = getProductKeywords(normalizedQuery);
  if (queryKeywords.length === 0) return false;

  // 0a. Gender check — an explicit gender request must never return the opposite
  // gender. Products with no gender marker (unisex/unlabeled) are allowed through.
  const qGender = detectGender(normalizedQuery);
  if (qGender === 'men' || qGender === 'women') {
    const pGender = detectGender(searchableText);
    if (pGender && pGender !== qGender) return true;
  }

  // 0b. Colour check — if a colour is requested, reject products that clearly
  // come in a DIFFERENT colour (no requested shade anywhere in title/options).
  const queryColors = COLOR_TERMS
    .filter(c => hasWord(normalizedQuery, c))
    .sort((a, b) => b.length - a.length);
  if (queryColors.length > 0) {
    const wanted = new Set<string>();
    for (const c of queryColors) { wanted.add(c); if (COLOR_BASE[c]) wanted.add(COLOR_BASE[c]); }
    const hasWanted = Array.from(wanted).some(c => hasWord(searchableText, c));
    if (!hasWanted) {
      const productHasOtherColor = COLOR_TERMS.some(c => hasWord(searchableText, c));
      if (productHasOtherColor) return true; // product is explicitly a different colour
    }
  }

  // 0c. Garment precision — tee vs button-up/formal shirt are not interchangeable.
  const wantsTee = TEE_MARKERS.some(m => hasWord(normalizedQuery, m));
  const wantsFormalShirt = !wantsTee && FORMAL_SHIRT_MARKERS.some(m => hasWord(normalizedQuery, m));
  if (wantsTee || wantsFormalShirt) {
    const isTee = TEE_MARKERS.some(m => hasWord(searchableText, m));
    const isFormalShirt = FORMAL_SHIRT_MARKERS.some(m => hasWord(searchableText, m));
    if (wantsTee && isFormalShirt && !isTee) return true;
    if (wantsFormalShirt && isTee && !isFormalShirt) return true;
  }

  // 1. Material check — if the query specifies a material, the product must have it
  const queryMaterials = MATERIALS.filter(mat =>
    queryKeywords.some(kw => kw === mat || kw.includes(mat) || mat.includes(kw))
  );
  if (queryMaterials.length > 0) {
    const hasMaterial = queryMaterials.some(mat => {
      const synonyms = MATERIAL_SYNONYMS[mat] || [mat];
      return synonyms.some(syn => searchableText.includes(syn));
    });
    if (!hasMaterial) return true;
  }

  // 2. Category check — if the query maps to specific categories, the product must be in one of them.
  // Critical: this also catches products with NO recognized category at all (tissue boxes, notebooks, etc.)
  // when the query is clearly for a fashion/accessory item.
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

    // Previously we only flagged a mismatch when productCategories was non-empty
    // (i.e., the product was in a DIFFERENT category). That let completely uncategorized
    // products (tissue boxes, notebooks, watches, wallets) pass unpenalized.
    // Now we flag any product that doesn't belong to at least one query category,
    // whether it's in the wrong category or in no category at all.
    const matchesQueryCategory = Array.from(queryCategories).some(cat => productCategories.has(cat));
    if (!matchesQueryCategory) return true;
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

// Thumbnail — used for product card grid (small squares), capped at 800 px
function normalizeImageUrl(url?: string): string {
  if (!url) return '';
  let normalized = url.startsWith('//') ? `https:${url}` : url;
  if (normalized.includes('cdn.shopify.com')) {
    try {
      const urlObj = new URL(normalized);
      urlObj.searchParams.set('width', '800');
      urlObj.searchParams.delete('height');
      normalized = urlObj.toString();
    } catch {}
  }
  return normalized;
}

// Gallery — used for the product detail carousel, served at 2 048 px so every
// retina / high-DPI screen gets a sharp image without serving the raw upload.
function normalizeGalleryUrl(url?: string): string {
  if (!url) return '';
  let normalized = url.startsWith('//') ? `https:${url}` : url;
  if (normalized.includes('cdn.shopify.com')) {
    try {
      const urlObj = new URL(normalized);
      urlObj.searchParams.set('width', '2048');
      urlObj.searchParams.delete('height');
      normalized = urlObj.toString();
    } catch {}
  }
  return normalized;
}

function normalizeCurrency(code?: string | null) {
  return String(code || 'USD').trim().toUpperCase() || 'USD';
}

// ── Shopify storefront /products.json fallback ──────────────────────────────
// Many curated brands are NOT indexed in the central Shopify catalog (and some
// aren't reachable via the per-store /api/mcp endpoint). Every Shopify store,
// however, exposes a public /products.json with the FULL product list including
// the complete image gallery. We use it as a fallback for brand-specific
// searches so every brand is findable and every product shows all its pictures.

const STOREFRONT_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// /products.json omits currency, so infer a best-effort default from the TLD.
const TLD_CURRENCY: Record<string, string> = {
  'co.in': 'INR', 'in': 'INR',
  'co.uk': 'GBP', 'uk': 'GBP',
  'com.au': 'AUD', 'au': 'AUD',
  'ca': 'CAD',
  'fr': 'EUR', 'it': 'EUR', 'eu': 'EUR', 'be': 'EUR', 'de': 'EUR', 'es': 'EUR', 'gr': 'EUR', 'nl': 'EUR',
  'com.pk': 'PKR', 'pk': 'PKR',
  'ru': 'RUB',
  'com.tr': 'TRY', 'tr': 'TRY',
  'com.my': 'MYR', 'my': 'MYR',
  'co.id': 'IDR', 'id': 'IDR',
  'ph': 'PHP',
  'ae': 'AED',
};
function guessStorefrontCurrency(domain: string): string {
  const d = domain.toLowerCase();
  const tlds = Object.keys(TLD_CURRENCY).sort((a, b) => b.length - a.length);
  for (const t of tlds) if (d.endsWith('.' + t)) return TLD_CURRENCY[t];
  return 'USD';
}

// Convert one /products.json product into the same UcpProduct shape the rest of
// the pipeline expects, with EVERY image mapped into media[] at gallery quality.
function parseStorefrontProduct(p: any, domain: string, currency: string): UcpProduct | null {
  try {
    if (!p || !p.id) return null;
    const images: string[] = Array.isArray(p.images)
      ? p.images.map((im: any) => im?.src).filter((s: any): s is string => typeof s === 'string' && s.length > 0)
      : [];
    if (images.length === 0) return null;

    const media = images.map((src) => ({ type: 'image', url: normalizeGalleryUrl(src), alt: '' }));
    const v0 = p.variants?.[0] || {};
    const priceNum = parseFloat(v0.price ?? '0') || 0; // /products.json prices are already major units

    const handle = p.handle || String(p.id);
    let store_url = `https://${domain}/products/${handle}`;
    try { const u = new URL(store_url); u.searchParams.set('ref', 'from_ai_affiliate'); store_url = u.toString(); } catch {}

    const options = Array.isArray(p.options)
      ? p.options
          .map((o: any) => ({ name: o.name, values: Array.isArray(o.values) ? o.values : [] }))
          .filter((o: any) => o.values.length > 0)
      : undefined;

    const variants = Array.isArray(p.variants)
      ? p.variants.map((v: any) => {
          const vOpts: Array<{ name: string; label: string }> = [];
          (p.options || []).forEach((o: any, idx: number) => {
            const label = v[`option${idx + 1}`];
            if (label) vOpts.push({ name: o.name, label });
          });
          const vImg = (p.images || []).find(
            (im: any) => Array.isArray(im.variant_ids) && im.variant_ids.includes(v.id)
          );
          return {
            id: String(v.id),
            title: v.title || '',
            price: parseFloat(v.price ?? '0') || 0,
            availability: v.available !== false,
            options: vOpts,
            media: vImg ? [{ url: normalizeGalleryUrl(vImg.src), alt: '' }] : [],
          };
        })
      : [];

    const tags = typeof p.tags === 'string'
      ? p.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
      : Array.isArray(p.tags) ? p.tags : [];

    const descHtml = typeof p.body_html === 'string' && p.body_html.trim() ? p.body_html : undefined;
    const brandToken = BRAND_NAMES[domain] || cleanBrandName(domain);
    const vendor = p.vendor || (brandToken ? brandToken.charAt(0).toUpperCase() + brandToken.slice(1) : 'Independent Seller');

    return {
      id: `gid://shopify/Product/${p.id}`,
      title: p.title || 'Untitled Product',
      vendor,
      price: priceNum,
      currency,
      store_url,
      image_url: normalizeImageUrl(images[0]),
      in_stock: variants.length === 0 ? true : variants.some((v: { availability: boolean }) => v.availability),
      tags,
      description: undefined,
      description_html: descHtml,
      options: options && options.length > 0 ? options : undefined,
      variants,
      media,
    };
  } catch {
    return null;
  }
}

// Fetch + keyword-filter a store's full catalog from its public /products.json.
// queryForScoring + mandatoryConcepts let storefront products carry the SAME
// trust_score and pass the SAME gender/colour/garment hard filter as catalog
// products, so the brand fallback never reintroduces wrong-attribute items.
async function fetchStorefrontProducts(
  domain: string,
  keywords: string[],
  wantLimit: number,
  queryForScoring = '',
  mandatoryConcepts: string[][] = [],
): Promise<UcpProduct[]> {
  const currency = guessStorefrontCurrency(domain);
  try {
    const res = await fetch(`https://${domain}/products.json?limit=250`, {
      headers: { 'User-Agent': STOREFRONT_UA, Accept: 'application/json', 'Accept-Language': 'en-US,en;q=0.9' },
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const raw: any[] = Array.isArray(data?.products) ? data.products : [];

    let parsed: UcpProduct[] = raw
      .map((p: any) => parseStorefrontProduct(p, domain, currency))
      .filter((p: UcpProduct | null): p is UcpProduct => p !== null);

    // Score + apply the same hard attribute filter as the main catalog path.
    for (const p of parsed) {
      let ts = calculateTrustScore(p, mandatoryConcepts);
      if (queryForScoring && isProductQueryMismatch(p, queryForScoring)) ts = Math.max(0, ts - 60);
      p.trust_score = ts;
    }

    if (keywords.length > 0) {
      const kw = keywords.map((k) => k.toLowerCase());
      const scored = parsed.map((p) => {
        const text = `${p.title} ${p.description_html || ''} ${(p.tags || []).join(' ')} ${p.vendor}`.toLowerCase();
        return { p, hits: kw.filter((k) => text.includes(k)).length };
      });
      const anyHit = scored.some((s) => s.hits > 0);
      // If the query matches some products, keep only matches (best first);
      // otherwise return the store's products unfiltered (pure brand browse).
      parsed = anyHit
        ? scored.filter((s) => s.hits > 0).sort((a, b) => b.hits - a.hits).map((s) => s.p)
        : parsed;
    }

    return parsed.slice(0, Math.max(wantLimit, 50));
  } catch {
    return [];
  }
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

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripBrandsFromQuery(query: string, domains: string[]): string {
  if (domains.length === 0) return query;
  let cleaned = query;
  for (const domain of domains) {
    const displayName = BRAND_NAMES[domain];
    if (!displayName || displayName.length < 3) continue;
    const esc = escapeRegex(displayName);
    cleaned = cleaned
      .replace(new RegExp(`\\b(?:from|at|by|in)\\s+${esc}\\b`, 'gi'), ' ')
      .replace(new RegExp(`\\b${esc}\\b`, 'gi'), ' ');
  }
  return cleaned.replace(/\s+/g, ' ').trim();
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

  // Hard-filter category mismatches. A mismatch trust_score is ≤34 (base 70-94 minus 60 penalty).
  // Only fall back to including mismatches if they make up the entire result set (niche queries).
  const MISMATCH_THRESHOLD = 40;
  const matched = filtered.filter(p => (p.trust_score || 0) >= MISMATCH_THRESHOLD);
  // Keep mismatches only as an absolute last resort — ensures niche/unlabeled stores still return something
  filtered = matched.length >= 4 ? matched : filtered;

  const sortFn = (a: UcpProduct, b: UcpProduct): number => {
    if (sort === 'trust_desc') return (b.trust_score || 0) - (a.trust_score || 0);
    if (sort !== 'relevance') {
      const priceA = convertProductPrice(a, budgetCurrency, filters.rates);
      const priceB = convertProductPrice(b, budgetCurrency, filters.rates);
      return sort === 'price_desc' ? priceB - priceA : priceA - priceB;
    }
    return 0;
  };
  filtered = [...filtered].sort(sortFn);

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
    options: CatalogSearchOptions = {},
    /** When set, restricts the search to exactly these domain(s) — used for brand-specific queries. */
    brandDomains: string[] = []
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
    const cleanedQuery = await cleanQueryForStorefront(normalizedQuery);
    if (!cleanedQuery) return [];

    const normalizedCountryCode = countryCode?.trim().toUpperCase() || null;
    const cacheKey = `${normalizedQuery.toLowerCase()}:${normalizedCountryCode || 'global'}`;
    const cached = searchCache.get(cacheKey);
    const rates = await getExchangeRates().catch(() => ({} as Record<string, number>));



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
              url: normalizeGalleryUrl(m.url),
              alt: m.alt ?? m.altText ?? m.alt_text ?? ''
            }))
          };
        });

        const parsedMedia = (p.media || []).map((m: any) => ({
          ...m,
          url: normalizeGalleryUrl(m.url),
          alt: m.alt ?? m.altText ?? m.alt_text ?? ''
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
          description_html: typeof p.description?.html === 'string' && p.description.html.trim()
            ? p.description.html
            : undefined,
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

    // Brand-specific override: if the caller or the query itself names specific brands,
    // restrict to those domains only so we don't dilute results with irrelevant stores.
    const detectedBrands = brandDomains.length > 0 ? brandDomains : detectBrandsInQuery(cleanedQuery);
    const allowedDomains = detectedBrands.length > 0
      ? detectedBrands.filter(d => UCP_REGISTRY.some(s => s.domain.toLowerCase().trim() === d))
      : getMatchingDomains(cleanedQuery);
    const isBrandSearch = detectedBrands.length > 0 && allowedDomains.length > 0;
    if (isBrandSearch) {
      console.log(`[GlobalCatalog] Brand search detected — restricting to: [${allowedDomains.join(', ')}]`);
    }

    // Strip brand names from the query sent to individual stores so "shirts from Taylor Stitch"
    // becomes just "shirts" when querying the store's own catalog endpoint.
    const storeQuery = isBrandSearch
      ? (stripBrandsFromQuery(cleanedQuery, detectedBrands) || cleanedQuery)
      : cleanedQuery;

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

    const filterOptions: CatalogSearchFilters = {
      budgetMax,
      budgetCurrency,
      excludeIds,
      mandatoryConcepts,
      sort,
      limit,
      rates,
    };

    const isFallback = !isBrandSearch && allowedDomains.length === UCP_REGISTRY.length;

    // Relevance Sorting & Chunking setup for Direct Storefront query
    let domainsToQuery = [...allowedDomains];
    const queryLower = cleanedQuery.toLowerCase();
    domainsToQuery.sort((a, b) => {
      const profileA = UCP_REGISTRY.find(s => s.domain.toLowerCase().trim() === a);
      const profileB = UCP_REGISTRY.find(s => s.domain.toLowerCase().trim() === b);
      let scoreA = 0;
      let scoreB = 0;
      if (profileA) {
        for (const vibe of profileA.vibe) {
          if (queryLower.includes(vibe.toLowerCase())) scoreA += 10;
        }
        scoreA += profileA.categories.length;
      }
      if (profileB) {
        for (const vibe of profileB.vibe) {
          if (queryLower.includes(vibe.toLowerCase())) scoreB += 10;
        }
        scoreB += profileB.categories.length;
      }
      return scoreB - scoreA;
    });

    const CHUNK_SIZE = 30;
    const chunks: string[][] = [];
    for (let i = 0; i < domainsToQuery.length; i += CHUNK_SIZE) {
      chunks.push(domainsToQuery.slice(i, i + CHUNK_SIZE));
    }

    const queryParts = splitCatalogQuery(storeQuery).slice(0, 2);
    const queryLang = detectQueryLanguage(queryParts[0]);

    // Helper to query a single domain
    const queryDomain = async (domain: string): Promise<any[]> => {
      const storeProfile = UCP_REGISTRY.find(s => s.domain.toLowerCase().trim() === domain);
      const storeLanguages = storeProfile?.languages || ['en'];
      const primaryLang = storeLanguages[0];

      let storeParts: string[];
      if (storeLanguages.length > 1) {
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
      } else if (queryLang !== primaryLang) {
        const translated: string[] = [];
        for (const part of queryParts) {
          let t = '';
          if (queryLang === 'ja' && primaryLang === 'en') t = translateJaToEn(part);
          else if (queryLang === 'en' && primaryLang === 'ja') t = translateEnToJa(part);
          if (t?.trim()) translated.push(t.trim());
        }
        storeParts = translated.length > 0 ? translated : queryParts;
      } else {
        storeParts = queryParts;
      }

      const partPromises = storeParts.map(async (part) => {
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
          if (!res.ok) return [];
          const data = await res.json();
          return parseProductsFromMcpResult(data);
        } catch (err: any) {
          return [];
        }
      });

      const results = await Promise.all(partPromises);
      return results.flat();
    };

    // Helper to parse and store products into cache
    const cacheStoreProducts = (domain: string, rawStoreProducts: any[]) => {
      if (!rawStoreProducts || rawStoreProducts.length === 0) return [];
      for (const p of rawStoreProducts) {
        p._directDomain = domain;
      }
      const { parsed: parsedStoreProducts } = parseRawProducts(rawStoreProducts);
      if (parsedStoreProducts.length > 0) {
        const cachedState = searchCache.get(cacheKey);
        const merged = uniqueById([...(cachedState?.products || []), ...parsedStoreProducts]);
        searchCache.set(cacheKey, { timestamp: Date.now(), products: merged, nextChunkIndex: cachedState?.nextChunkIndex ?? 1 });
      }
      return parsedStoreProducts;
    };

    // Per-domain fetch with storefront fallback: try the store's /api/mcp
    // endpoint first; if it yields nothing AND this is an explicit brand search,
    // fall back to the public /products.json so the brand is always findable
    // and every product carries its full image gallery.
    const fetchDomainProducts = async (domain: string): Promise<UcpProduct[]> => {
      const raw = await queryDomain(domain);
      const parsed = cacheStoreProducts(domain, raw);
      if (parsed.length > 0 || !isBrandSearch) return parsed;

      const storefront = await fetchStorefrontProducts(domain, getProductKeywords(storeQuery), limit, cleanedQuery, mandatoryConcepts);
      if (storefront.length > 0) {
        const cachedState = searchCache.get(cacheKey);
        const merged = uniqueById([...(cachedState?.products || []), ...storefront]);
        searchCache.set(cacheKey, { timestamp: Date.now(), products: merged, nextChunkIndex: cachedState?.nextChunkIndex ?? 1 });
      }
      return storefront;
    };

    // 1. Cache Hit Logic with JIT Lazy replenishment check
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      const filteredCache = applyCatalogFilters(cached.products, filterOptions);
      
      if (filteredCache.length >= limit || (!options.refreshReserve && filteredCache.length > 0)) {
        console.log(`[GlobalCatalog] Cache hit for "${cacheKey}" (${filteredCache.length} products).`);
        
        // Replenishment Check: keep a deep reserve so infinite scroll never stalls
        const remainingCount = filteredCache.length - limit;
        if (remainingCount < 200) {
          const nextChunkIndex = cached.nextChunkIndex ?? 1;
          const nextChunk = chunks[nextChunkIndex];
          if (nextChunk && nextChunk.length > 0) {
            console.log(`[GlobalCatalog] Replenishment threshold triggered (${remainingCount} < 40). Fetching Store Chunk ${nextChunkIndex + 1}/${chunks.length} in background...`);
            cached.nextChunkIndex = nextChunkIndex + 1;
            searchCache.set(cacheKey, cached);
            
            (async () => {
              try {
                await Promise.all(nextChunk.map((domain) => fetchDomainProducts(domain)));
                console.log(`[GlobalCatalog] Background replenishment of Store Chunk ${nextChunkIndex + 1} complete.`);
              } catch (err) {
                console.warn(`[GlobalCatalog] Background replenishment of Store Chunk ${nextChunkIndex + 1} failed:`, err);
              }
            })();
          }
        }
        return filteredCache.slice(0, limit);
      }
    }

    if (options.loadMore || options.refreshReserve) {
      console.log(`[GlobalCatalog] Cache miss or exhausted for loadMore. Performing catalog fetch...`);
      if (options.debug) options.debug.catalogFetched = true;
    }

    // 2. Cache Miss / Exhaustion Querying
    if (!isFallback) {
      if (isFastFirstPage) {
        // First Page load: Query Chunk 1 and return early as soon as 30 products are found
        console.log(`[GlobalCatalog] First page search. Querying Chunk 1 (${chunks[0]?.length || 0} stores) with early return threshold 30...`);
        const firstChunk = chunks[0] || [];
        const directParsedProducts: UcpProduct[] = [];
        let resolvedCount = 0;
        const startTime = Date.now();

        const firstChunkPromises = firstChunk.map(async (domain) => {
          try {
            const parsed = await fetchDomainProducts(domain);
            directParsedProducts.push(...parsed);
          } catch {} finally {
            resolvedCount++;
          }
        });

        await new Promise<void>((resolve) => {
          let settled = false;
          const total = firstChunkPromises.length;

          const tryResolve = () => {
            if (settled) return;
            if (resolvedCount >= total) {
              settled = true;
              resolve();
            } else if (directParsedProducts.length >= 40) {
              settled = true;
              console.log(`[GlobalCatalog] Early return for first page: ${directParsedProducts.length} products from ${resolvedCount}/${total} stores in ${Date.now() - startTime}ms`);
              resolve();
            }
          };

          for (const p of firstChunkPromises) {
            p.then(tryResolve).catch(tryResolve);
          }

          setTimeout(() => {
            if (!settled) {
              settled = true;
              console.log(`[GlobalCatalog] Timeout return for first page: ${directParsedProducts.length} products from ${resolvedCount}/${total} stores in ${Date.now() - startTime}ms`);
              resolve();
            }
          }, 2000);
        });

        console.log(`[GlobalCatalog] Chunk 1 queries finished in ${Date.now() - startTime}ms. Fetched & parsed ${directParsedProducts.length} products.`);

        // Replenishment Check: If remaining products in cache is less than 40, pre-fetch Chunk 2
        const currentCached = searchCache.get(cacheKey);
        const allAvailable = currentCached ? applyCatalogFilters(currentCached.products, filterOptions) : [];
        const remainingCount = allAvailable.length - 40;

        if (remainingCount < 200) {
          const secondChunk = chunks[1];
          if (secondChunk && secondChunk.length > 0 && currentCached) {
            console.log(`[GlobalCatalog] Replenishment threshold reached for first page (${remainingCount} < 40). Fetching Store Chunk 2/${chunks.length} in background...`);
            currentCached.nextChunkIndex = 2;
            searchCache.set(cacheKey, currentCached);
            
            (async () => {
              try {
                await Promise.all(secondChunk.map((domain) => fetchDomainProducts(domain)));
                console.log(`[GlobalCatalog] Background replenishment of Chunk 2 complete.`);
              } catch {}
            })();
          }
        } else if (currentCached) {
          currentCached.nextChunkIndex = 1;
          searchCache.set(cacheKey, currentCached);
        }
      } else {
        // Load More cache exhaustion: synchronously query chunk X until we have enough products
        const startTime = Date.now();
        const nextChunkIndex = cached?.nextChunkIndex ?? 1;
        let currentNextChunkIndex = nextChunkIndex;
        console.log(`[GlobalCatalog] Synchronously fetching Chunk ${currentNextChunkIndex + 1}/${chunks.length} to satisfy loadMore...`);

        while (currentNextChunkIndex < chunks.length) {
          const chunkToQuery = chunks[currentNextChunkIndex];
          console.log(`[GlobalCatalog] Fetching Chunk ${currentNextChunkIndex + 1} with ${chunkToQuery.length} stores...`);
          
          await Promise.all(chunkToQuery.map(async (domain) => {
            try {
              await fetchDomainProducts(domain);
            } catch {}
          }));

          currentNextChunkIndex++;

          // Check if cache now has enough products
          const currentCached = searchCache.get(cacheKey);
          const filteredNow = applyCatalogFilters(currentCached?.products || [], filterOptions);
          if (filteredNow.length >= limit) {
            break;
          }
        }

        // Update cached nextChunkIndex
        const currentCached = searchCache.get(cacheKey);
        if (currentCached) {
          currentCached.nextChunkIndex = currentNextChunkIndex;
          searchCache.set(cacheKey, currentCached);
        }

        // Replenishment Check: keep a deep reserve so infinite scroll never stalls
        const allAvailable = currentCached ? applyCatalogFilters(currentCached.products, filterOptions) : [];
        const remainingCount = allAvailable.length - limit;

        if (remainingCount < 200) {
          const finalNextChunk = chunks[currentNextChunkIndex];
          if (finalNextChunk && finalNextChunk.length > 0 && currentCached) {
            console.log(`[GlobalCatalog] Replenishment threshold reached for loadMore (${remainingCount} < 40). Fetching Store Chunk ${currentNextChunkIndex + 1}/${chunks.length} in background...`);
            currentCached.nextChunkIndex = currentNextChunkIndex + 1;
            searchCache.set(cacheKey, currentCached);

            (async () => {
              try {
                await Promise.all(finalNextChunk.map((domain) => fetchDomainProducts(domain)));
                console.log(`[GlobalCatalog] Background replenishment of Chunk ${currentNextChunkIndex + 1} complete.`);
              } catch {}
            })();
          }
        }
      }
    } else {
      console.log(`[GlobalCatalog] No targeted match. Falling back to Global Catalog MCP.`);
      const rawFallback = await fetchChunkedFromCatalog(storeQuery);
      const { parsed: parsedFallback } = parseRawProducts(rawFallback);
      if (parsedFallback.length > 0) {
        const cachedState = searchCache.get(cacheKey);
        const merged = uniqueById([...(cachedState?.products || []), ...parsedFallback]);
        searchCache.set(cacheKey, { timestamp: Date.now(), products: merged, nextChunkIndex: cachedState?.nextChunkIndex ?? 1 });
      }
    }

    const finalCached = searchCache.get(cacheKey);
    const finalProducts = finalCached?.products || [];
    let filteredProducts = applyCatalogFiltersWithRetry(finalProducts, filterOptions);

    console.log(`[GlobalCatalog] returning ${filteredProducts.length} of ${finalProducts.length} (limit=${limit}, fast=${isFastFirstPage})`);
    return filteredProducts;
  }
}
