// ── Deterministic query parser ───────────────────────────────────────────────
// Decomposes a free-text search query into structured components (gender,
// garment type, material) and builds mandatory concept groups that are used
// as HARD filters in the catalog search pipeline.
//
// This runs on EVERY search — both as a fallback when the LLM skips
// mandatoryConcepts, and as a verifier that fills in what the LLM missed.

// Whole-word match — prevents "men" matching inside "women", "shirt" matching
// inside "t-shirt" (at the start of a word boundary), etc.
function hasWord(text: string, word: string): boolean {
  return new RegExp(
    `(?:^|[^a-z])${word.replace(/[-\s]+/g, '[\\s-]+')}(?:[^a-z]|$)`,
    'i'
  ).test(text)
}

// ── Gender detection (mirrors GlobalCatalogService) ──────────────────────────
export function detectGenderInQuery(text: string): 'men' | 'women' | 'kids' | null {
  const lower = text.toLowerCase()
  const women = /(?:^|[^a-z])(women|woman|womens|womenswear|ladies|lady|female)(?:[^a-z]|$)/i.test(lower)
  const men   = /(?:^|[^a-z])(men|man|mens|menswear|male|guys?|gentlemen)(?:[^a-z]|$)/i.test(lower)
  const kids  = /(?:^|[^a-z])(kids?|children|child|toddler|infant|baby|boys?|girls?)(?:[^a-z]|$)/i.test(lower)
  if (kids && !women && !men) return 'kids'
  if (women && !men) return 'women'
  if (men && !women) return 'men'
  return null
}

// ── Garment vocabulary ────────────────────────────────────────────────────────
// query:   terms to look for IN THE USER'S MESSAGE to detect garment intent
// product: terms to look for IN PRODUCT TEXT (title, tags, description) to
//          require this garment type — used as the mandatoryConcepts group
type GarmentEntry = { query: string[]; product: string[] }

export const GARMENT_VOCAB: Record<string, GarmentEntry> = {
  // ── Tops ──────────────────────────────────────────────────────────────────
  shirt: {
    query:   ['shirt', 'shirts'],
    product: ['shirt', 'button-up', 'button-down', 'dress shirt', 'oxford shirt', 'flannel shirt', 'overshirt', 'camp shirt', 'woven shirt'],
  },
  tshirt: {
    query:   ['t-shirt', 't shirt', 'tshirt', 'tee', 'tees'],
    product: ['t-shirt', 'tshirt', 'tee', 'tees'],
  },
  blouse: {
    query:   ['blouse', 'blouses'],
    product: ['blouse', 'blouses'],
  },
  polo: {
    query:   ['polo', 'polo shirt', 'polo tee'],
    product: ['polo'],
  },
  tank: {
    query:   ['tank', 'tank top', 'singlet', 'cami', 'camisole'],
    product: ['tank top', 'tank', 'singlet', 'cami', 'camisole'],
  },
  sweater: {
    query:   ['sweater', 'jumper', 'pullover', 'knitwear', 'knit top'],
    product: ['sweater', 'jumper', 'pullover', 'knitwear'],
  },
  hoodie: {
    query:   ['hoodie', 'hoodies', 'sweatshirt', 'sweatshirts'],
    product: ['hoodie', 'sweatshirt'],
  },
  cardigan: {
    query:   ['cardigan', 'cardigans'],
    product: ['cardigan'],
  },
  // ── Bottoms ───────────────────────────────────────────────────────────────
  trouser: {
    query:   ['trouser', 'trousers', 'pants', 'pant', 'slacks', 'wide-leg', 'wide leg'],
    product: ['trouser', 'trousers', 'pants', 'slacks'],
  },
  jean: {
    query:   ['jean', 'jeans', 'denim jeans', 'denim pants'],
    product: ['jean', 'jeans', 'denim'],
  },
  chino: {
    query:   ['chino', 'chinos', 'khaki', 'khakis', 'chino pants'],
    product: ['chino', 'chinos', 'khaki'],
  },
  short: {
    query:   ['short', 'shorts', 'swim shorts', 'board shorts'],
    product: ['shorts'],
  },
  skirt: {
    query:   ['skirt', 'skirts', 'midi skirt', 'mini skirt', 'maxi skirt'],
    product: ['skirt', 'skirts'],
  },
  legging: {
    query:   ['legging', 'leggings', 'tights', 'yoga pants'],
    product: ['legging', 'leggings', 'tights'],
  },
  // ── Outerwear ─────────────────────────────────────────────────────────────
  jacket: {
    query:   ['jacket', 'jackets'],
    product: ['jacket'],
  },
  blazer: {
    query:   ['blazer', 'blazers'],
    product: ['blazer'],
  },
  coat: {
    query:   ['coat', 'coats', 'overcoat', 'trench coat', 'trench', 'parka', 'puffer'],
    product: ['coat', 'overcoat', 'trench', 'parka', 'puffer'],
  },
  vest: {
    query:   ['vest', 'waistcoat', 'gilet'],
    product: ['vest', 'waistcoat', 'gilet'],
  },
  // ── Full-body ─────────────────────────────────────────────────────────────
  dress: {
    query:   ['dress', 'dresses', 'midi dress', 'mini dress', 'maxi dress', 'slip dress', 'sundress'],
    product: ['dress', 'dresses', 'gown'],
  },
  jumpsuit: {
    query:   ['jumpsuit', 'jumpsuits', 'romper', 'rompers', 'playsuit', 'overall', 'overalls'],
    product: ['jumpsuit', 'romper', 'playsuit', 'overall'],
  },
  bodysuit: {
    query:   ['bodysuit', 'bodysuits'],
    product: ['bodysuit', 'bodysuits'],
  },
  // ── Footwear ──────────────────────────────────────────────────────────────
  sneaker: {
    query:   ['sneaker', 'sneakers', 'trainer', 'trainers', 'running shoe', 'running shoes', 'athletic shoe', 'court shoe'],
    product: ['sneaker', 'sneakers', 'trainer', 'trainers', 'running shoe', 'athletic'],
  },
  boot: {
    query:   ['boot', 'boots', 'chelsea boot', 'chelsea boots', 'ankle boot', 'ankle boots', 'knee-high boot', 'combat boot'],
    product: ['boot', 'boots', 'chelsea', 'ankle boot'],
  },
  loafer: {
    query:   ['loafer', 'loafers', 'moccasin', 'moccasins', 'slip-on shoe', 'slip-on shoes'],
    product: ['loafer', 'loafers', 'moccasin'],
  },
  sandal: {
    query:   ['sandal', 'sandals', 'slide', 'slides', 'flip flop', 'flip flops', 'thong sandal'],
    product: ['sandal', 'sandals', 'slide'],
  },
  heel: {
    query:   ['heel', 'heels', 'pump', 'pumps', 'stiletto', 'wedge', 'block heel'],
    product: ['heel', 'heels', 'pump', 'pumps', 'stiletto', 'wedge'],
  },
  derby: {
    query:   ['derby', 'derbies', 'oxford shoe', 'oxford shoes', 'brogue', 'brogues'],
    product: ['oxford', 'derby', 'brogue'],
  },
  espadrille: {
    query:   ['espadrille', 'espadrilles'],
    product: ['espadrille', 'espadrilles'],
  },
  clog: {
    query:   ['clog', 'clogs'],
    product: ['clog', 'clogs'],
  },
  // ── Accessories ───────────────────────────────────────────────────────────
  bag: {
    query:   ['bag', 'bags', 'handbag', 'handbags', 'tote bag', 'tote bags', 'shoulder bag', 'crossbody'],
    product: ['bag', 'handbag', 'tote', 'clutch', 'purse', 'crossbody'],
  },
  tote: {
    query:   ['tote', 'totes'],
    product: ['tote'],
  },
  backpack: {
    query:   ['backpack', 'backpacks', 'rucksack', 'rucksacks'],
    product: ['backpack', 'rucksack'],
  },
  hat: {
    query:   ['hat', 'hats', 'cap', 'caps', 'beanie', 'beanies', 'bucket hat'],
    product: ['hat', 'cap', 'beanie'],
  },
  scarf: {
    query:   ['scarf', 'scarves', 'shawl', 'wrap'],
    product: ['scarf', 'scarves'],
  },
  belt: {
    query:   ['belt', 'belts'],
    product: ['belt', 'belts'],
  },
  sock: {
    query:   ['sock', 'socks'],
    product: ['sock', 'socks'],
  },
  sunglasses: {
    query:   ['sunglasses', 'sunnies', 'shades'],
    product: ['sunglasses', 'sunglasses'],
  },
  watch: {
    query:   ['watch', 'watches', 'timepiece'],
    product: ['watch', 'watches'],
  },
  jewelry: {
    query:   ['necklace', 'bracelet', 'earring', 'earrings', 'ring', 'rings', 'jewelry', 'jewellery', 'pendant'],
    product: ['necklace', 'bracelet', 'earring', 'ring', 'pendant', 'jewelry', 'jewellery'],
  },
  wallet: {
    query:   ['wallet', 'wallets', 'card holder', 'cardholder', 'card wallet'],
    product: ['wallet', 'wallets', 'cardholder', 'card holder'],
  },
}

// ── Material vocabulary ───────────────────────────────────────────────────────
// Both query detection and product text matching use the same synonym list.
export const MATERIAL_VOCAB: Record<string, string[]> = {
  linen:    ['linen'],
  cotton:   ['cotton'],
  wool:     ['wool', 'woolen', 'woollen', 'merino'],
  silk:     ['silk', 'silky'],
  leather:  ['leather'],
  denim:    ['denim'],
  cashmere: ['cashmere'],
  velvet:   ['velvet'],
  suede:    ['suede'],
  canvas:   ['canvas'],
  fleece:   ['fleece'],
  satin:    ['satin'],
  lace:     ['lace'],
  tweed:    ['tweed'],
  corduroy: ['corduroy', 'cord'],
  jersey:   ['jersey'],
  nylon:    ['nylon'],
  polyester:['polyester'],
  lace_trim:['lace trim'],
  hemp:     ['hemp'],
}

// ── Query decomposition ───────────────────────────────────────────────────────
export type QueryComponents = {
  gender?: 'men' | 'women' | 'kids'
  garmentKeys: string[]
  materials: string[]
}

export function decomposeQuery(query: string): QueryComponents {
  const lower = query.toLowerCase()

  const gender = detectGenderInQuery(lower) ?? undefined

  const garmentKeys: string[] = []
  for (const [key, entry] of Object.entries(GARMENT_VOCAB)) {
    if (entry.query.some(term => hasWord(lower, term))) {
      garmentKeys.push(key)
    }
  }

  const materials: string[] = []
  for (const [mat] of Object.entries(MATERIAL_VOCAB)) {
    if (hasWord(lower, mat)) materials.push(mat)
  }

  return { gender, garmentKeys, materials }
}

// ── Concept builder ───────────────────────────────────────────────────────────
// Builds mandatoryConcepts string[][] from a query.
// Each group is a list of synonyms; a product must contain at least one
// term from EVERY group to pass the hard filter.
export function buildMandatoryConcepts(query: string): string[][] {
  const { gender, garmentKeys, materials } = decomposeQuery(query)
  const concepts: string[][] = []

  if (gender === 'men')   concepts.push(['men', 'mens', 'man', 'male', 'unisex'])
  if (gender === 'women') concepts.push(['women', 'womens', 'woman', 'ladies', 'female'])

  for (const key of garmentKeys) {
    const entry = GARMENT_VOCAB[key]
    if (entry) concepts.push(entry.product)
  }

  for (const mat of materials) {
    const synonyms = MATERIAL_VOCAB[mat]
    if (synonyms) concepts.push(synonyms)
  }

  return concepts
}

// ── Concept augmenter ─────────────────────────────────────────────────────────
// Merges LLM-generated concepts with deterministically-built ones.
// If the LLM already included a concept group for a term (gender/garment/material),
// the deterministic group is skipped to avoid double-filtering.
// If the LLM MISSED a concept, the deterministic one is added.
export function augmentConcepts(llmConcepts: string[][], query: string): string[][] {
  const deterministic = buildMandatoryConcepts(query)
  if (deterministic.length === 0) return llmConcepts

  const merged = [...llmConcepts]

  for (const detGroup of deterministic) {
    const alreadyCovered = merged.some(existing =>
      existing.some(a =>
        detGroup.some(b => a.toLowerCase().trim() === b.toLowerCase().trim())
      )
    )
    if (!alreadyCovered) merged.push(detGroup)
  }

  return merged
}

// ── Outfit slot classification ────────────────────────────────────────────────
// Maps every garment key to a high-level wardrobe slot, so the outfit builder
// can (a) know what category a slot query intends, (b) verify the product a
// search returned actually IS that category, and (c) label it correctly.
export type SlotCategory = 'top' | 'bottom' | 'outer' | 'dress' | 'shoes' | 'accessory'

const GARMENT_CATEGORY: Record<string, SlotCategory> = {
  shirt: 'top', tshirt: 'top', blouse: 'top', polo: 'top', tank: 'top',
  sweater: 'top', hoodie: 'top', cardigan: 'top',
  trouser: 'bottom', jean: 'bottom', chino: 'bottom', short: 'bottom',
  skirt: 'bottom', legging: 'bottom',
  jacket: 'outer', blazer: 'outer', coat: 'outer', vest: 'outer',
  dress: 'dress', jumpsuit: 'dress', bodysuit: 'dress',
  sneaker: 'shoes', boot: 'shoes', loafer: 'shoes', sandal: 'shoes',
  heel: 'shoes', derby: 'shoes', espadrille: 'shoes', clog: 'shoes',
  bag: 'accessory', tote: 'accessory', backpack: 'accessory', hat: 'accessory',
  scarf: 'accessory', belt: 'accessory', sock: 'accessory', sunglasses: 'accessory',
  watch: 'accessory', jewelry: 'accessory', wallet: 'accessory',
}

const SLOT_LABELS: Record<SlotCategory, string> = {
  top: 'Top', bottom: 'Bottom', outer: 'Outer', dress: 'Dress',
  shoes: 'Shoes', accessory: 'Accessory',
}

export function slotLabelFor(cat: SlotCategory): string {
  return SLOT_LABELS[cat]
}

// What category does an outfit-slot QUERY intend? Reads the garment terms out of
// the user-facing query ("men's tan leather loafers" → 'shoes'). Returns null
// when the query names no recognizable garment.
export function classifyQuerySlot(query: string): SlotCategory | null {
  const { garmentKeys } = decomposeQuery(query)
  for (const key of garmentKeys) {
    const cat = GARMENT_CATEGORY[key]
    if (cat) return cat
  }
  return null
}

// Which categories does an actual PRODUCT belong to? Matches the product-side
// vocabulary against the product's own text (title + tags + description). A
// product can legitimately hit more than one (e.g. an overshirt reads as a top),
// so we return the full set and let the caller test membership.
export function productSlotCategories(p: { title?: string; tags?: string[]; description?: string }): Set<SlotCategory> {
  const text = `${p.title || ''} ${(p.tags || []).join(' ')} ${p.description || ''}`.toLowerCase()
  const cats = new Set<SlotCategory>()
  for (const [key, entry] of Object.entries(GARMENT_VOCAB)) {
    const cat = GARMENT_CATEGORY[key]
    if (!cat) continue
    if (entry.product.some(term => hasWord(text, term))) cats.add(cat)
  }
  return cats
}

// Does this product actually satisfy the slot the query asked for?
export function productMatchesSlot(p: { title?: string; tags?: string[]; description?: string }, cat: SlotCategory): boolean {
  return productSlotCategories(p).has(cat)
}
