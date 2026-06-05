const CATEGORY_KEYWORDS = {
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
  ]
};

const MATERIALS = [
  'linen', 'cotton', 'wool', 'silk', 'leather', 'denim', 'canvas', 'hemp', 'cashmere', 'satin', 'velvet', 'lace',
  'lanh', 'len', 'lụa', 'tơ', 'da', 'bò', 'kaki', 'polyester', 'nylon', 'spandex', 'fleece'
];

const MATERIAL_SYNONYMS = {
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

function getProductKeywords(query) {
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

function isProductQueryMismatch(product, query) {
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
  const queryCategories = new Set();
  for (const kw of queryKeywords) {
    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      if (keywords.some(k => kw === k || kw.includes(k) || k.includes(kw))) {
        queryCategories.add(category);
      }
    }
  }

  if (queryCategories.size > 0) {
    const productCategories = new Set();
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

const testCases = [
  {
    query: "linen shirt",
    product: { title: "Emilie Striped Linen Button Down Shirt", description: "Soft linen shirt" },
    expected: false
  },
  {
    query: "linen shirt",
    product: { title: "Nantucket Linen Shorts", description: "Linen drawstring shorts" },
    expected: true
  },
  {
    query: "linen shirt",
    product: { title: "Sloan Pigment Washed Oversized Denim Shirt", description: "Denim shirt" },
    expected: true
  },
  {
    query: "shoes",
    product: { title: "Pápia Boat Shoe", description: "Leather shoe" },
    expected: false
  },
  {
    query: "shoes",
    product: { title: "Sloan Pigment Washed Oversized Denim Shirt", description: "Denim shirt" },
    expected: true
  }
];

console.log("Running mismatch logic test cases:");
testCases.forEach((tc, i) => {
  const result = isProductQueryMismatch(tc.product, tc.query);
  const passed = result === tc.expected;
  console.log(`[Test ${i+1}] Query: "${tc.query}" | Product: "${tc.product.title}" | Expected Mismatch: ${tc.expected} | Got: ${result} -> ${passed ? 'PASSED' : 'FAILED'}`);
});
