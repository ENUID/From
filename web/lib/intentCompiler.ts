/**
 * Fashion Intent Compiler — deterministic query understanding.
 *
 * Compiles a natural-language shopping query into a structured search plan
 * (SearchToolArgs) with zero LLM dependency. When it fires, search is instant,
 * immune to model degradation, rate limits, and timeouts. The LLM planner is
 * only consulted for genuinely conversational or ambiguous messages.
 *
 * Architecture: lexicon-driven compilation over four signal layers —
 *   1. GARMENT  — what product type (hard filter, synonym-grouped)
 *   2. ATTRIBUTE — explicit color / material (hard filter)
 *   3. AESTHETIC — style vocabulary terms (soft ranking signal)
 *   4. INTENT   — budget, sort, gender (search modifiers)
 */

import { SearchToolArgs, SearchToolSchema } from '@/lib/ai/schema'
import { matchStyles, type StyleEntry } from '@/lib/styleVocabulary'
import { normalizeFashionTypos } from '@/lib/queryParser'

// ── Layer 1: Garment lexicon ───────────────────────────────────────────────────
// canonical garment → synonym group used as a mandatoryConcepts hard filter.
// First entry in each group is the searchQuery term.
const GARMENTS: Record<string, string[]> = {
  shirt:        ['shirt', 'shirts', 'button-down', 'button down', 'oxford', 'overshirt', 'camp collar', 'flannel'],
  tee:          ['tee', 'tees', 't-shirt', 't-shirts', 't shirt', 'tshirt', 'tshirts', 'tank top', 'crop top'],
  polo:         ['polo', 'polos', 'henley', 'rugby shirt'],
  blouse:       ['blouse', 'blouses', 'camisole', 'bodysuit'],
  sweater:      ['sweater', 'sweaters', 'jumper', 'knitwear', 'knit', 'turtleneck', 'cardigan', 'pullover', 'roll-neck', 'mock-neck'],
  hoodie:       ['hoodie', 'hoodies', 'sweatshirt', 'sweatshirts', 'crewneck', 'zip-up', 'quarter-zip'],
  trousers:     ['trousers', 'trouser', 'pants', 'chinos', 'chino', 'slacks', 'culottes'],
  jeans:        ['jeans', 'denim pants', 'selvedge'],
  shorts:       ['shorts', 'short'],
  skirt:        ['skirt', 'skirts'],
  leggings:     ['leggings', 'legging', 'joggers', 'jogger', 'sweatpants', 'track pants', 'bike shorts'],
  dress:        ['dress', 'dresses', 'gown', 'sundress'],
  jumpsuit:     ['jumpsuit', 'romper', 'playsuit', 'co-ord', 'coord set', 'co ord'],
  kurta:        ['kurta', 'saree', 'lehenga', 'dupatta'],
  jacket:       ['jacket', 'jackets', 'bomber', 'windbreaker', 'harrington', 'trucker'],
  coat:         ['coat', 'coats', 'overcoat', 'trench', 'parka', 'puffer', 'raincoat', 'peacoat'],
  blazer:       ['blazer', 'blazers', 'sport coat', 'suit jacket'],
  suit:         ['suit', 'suits', 'tuxedo', 'two-piece', 'three-piece'],
  vest:         ['vest', 'gilet', 'waistcoat'],
  sneakers:     ['sneaker', 'sneakers', 'trainers', 'trainer', 'runners', 'kicks', 'low-top', 'high-top'],
  boots:        ['boot', 'boots', 'chelsea', 'chukka', 'combat boot'],
  loafers:      ['loafer', 'loafers', 'derby', 'derbies', 'oxfords', 'brogues', 'monk strap'],
  sandals:      ['sandal', 'sandals', 'slides', 'mules', 'espadrilles', 'flip flop'],
  heels:        ['heel', 'heels', 'pumps', 'stiletto'],
  flats:        ['flats', 'ballet flat', 'ballerina'],
  shoes:        ['shoe', 'shoes', 'footwear'],
  bag:          ['bag', 'bags', 'tote', 'backpack', 'crossbody', 'handbag', 'clutch', 'weekender', 'duffle', 'messenger', 'purse'],
  wallet:       ['wallet', 'cardholder', 'card holder'],
  hat:          ['hat', 'hats', 'cap', 'caps', 'beanie', 'bucket hat'],
  belt:         ['belt', 'belts'],
  scarf:        ['scarf', 'scarves'],
  sunglasses:   ['sunglasses', 'shades', 'eyewear'],
  jewelry:      ['jewelry', 'jewellery', 'necklace', 'bracelet', 'ring', 'earrings', 'earring', 'anklet', 'pendant', 'chain'],
  watch:        ['watch', 'watches'],
  socks:        ['socks', 'sock', 'tights', 'stockings'],
  underwear:    ['underwear', 'boxers', 'briefs', 'bralette', 'lingerie'],
  pajamas:      ['pajamas', 'pyjamas', 'loungewear', 'sleepwear', 'robe', 'nightwear'],
  swimwear:     ['swimsuit', 'swimwear', 'bikini', 'swim trunks', 'board shorts', 'one-piece', 'rash guard'],
  top:          ['top', 'tops'],
}

// ── Layer 2: Attribute lexicons ────────────────────────────────────────────────
const COLORS: Record<string, string[]> = {
  black:   ['black'],
  white:   ['white', 'off-white', 'ivory'],
  cream:   ['cream', 'ecru', 'beige', 'sand', 'stone', 'taupe'],
  grey:    ['grey', 'gray', 'charcoal'],
  navy:    ['navy'],
  blue:    ['blue', 'cobalt', 'indigo'],
  green:   ['green', 'olive', 'sage', 'forest', 'khaki'],
  red:     ['red', 'burgundy', 'maroon', 'oxblood', 'wine'],
  pink:    ['pink', 'blush', 'rose'],
  purple:  ['purple', 'lilac', 'lavender'],
  yellow:  ['yellow', 'mustard'],
  orange:  ['orange', 'rust', 'terracotta'],
  brown:   ['brown', 'tan', 'camel', 'chocolate', 'caramel'],
  gold:    ['gold', 'golden'],
  silver:  ['silver', 'metallic', 'chrome'],
}

const MATERIALS: Record<string, string[]> = {
  linen:     ['linen'],
  cotton:    ['cotton', 'organic cotton'],
  wool:      ['wool', 'merino', 'lambswool'],
  cashmere:  ['cashmere'],
  silk:      ['silk', 'satin'],
  leather:   ['leather', 'suede'],
  denim:     ['denim', 'selvedge'],
  velvet:    ['velvet', 'velour'],
  canvas:    ['canvas', 'duck canvas'],
  corduroy:  ['corduroy', 'cord'],
  tweed:     ['tweed', 'herringbone'],
  fleece:    ['fleece'],
  nylon:     ['nylon', 'gore-tex', 'goretex', 'ripstop', 'technical fabric'],
  lace:      ['lace', 'crochet'],
  knit:      ['knit', 'knitted', 'cable knit'],
  hemp:      ['hemp', 'bamboo', 'tencel', 'lyocell', 'modal'],
}

const GENDER_TERMS: Record<'men' | 'women', string[]> = {
  men:   ['men', "men's", 'mens', 'male', 'for him', 'masculine', 'guys'],
  women: ['women', "women's", 'womens', 'female', 'for her', 'feminine', 'ladies'],
}

// ── Layer 3: Occasion lexicon ──────────────────────────────────────────────────
// canonical occasion → phrases that signal it in a raw message. Longest match
// wins when a message names more than one (matched.length sort in compileIntent).
const OCCASIONS: Record<string, string[]> = {
  beach:     ['beach party', 'beach vacation', 'beach day', 'beach', 'seaside', 'poolside', 'pool party'],
  resort:    ['resort wear', 'resort', 'holiday trip', 'vacation'],
  wedding:   ['wedding guest', 'wedding'],
  office:    ['work meeting', 'business casual', 'workwear', 'office', 'work'],
  interview: ['job interview', 'interview'],
  date:      ['date night', 'first date', 'date'],
  party:     ['house party', 'going out', 'night out', 'party'],
  blacktie:  ['black tie', 'gala', 'formal evening'],
  cocktail:  ['cocktail party', 'cocktail'],
  gym:       ['workout', 'training session', 'yoga class', 'gym'],
  travel:    ['travel day', 'flight', 'airport', 'travel'],
  brunch:    ['brunch'],
  festival:  ['music festival', 'festival'],
}

// canonical occasion → catalog-facing descriptor words (search-query enrichment
// + soft mandatoryConcepts ranking group — never a hard filter, occasion is a
// styling nudge, not a strict attribute like garment/gender).
const OCCASION_BOOST: Record<string, string[]> = {
  beach:     ['beach', 'resort', 'lightweight', 'linen'],
  resort:    ['resort', 'vacation', 'lightweight'],
  wedding:   ['wedding guest', 'occasion wear', 'formal'],
  office:    ['workwear', 'business casual', 'tailored'],
  interview: ['business formal', 'tailored', 'polished'],
  date:      ['date night', 'evening'],
  party:     ['party', 'going out'],
  blacktie:  ['black tie', 'formal', 'tuxedo'],
  cocktail:  ['cocktail', 'semi-formal'],
  gym:       ['activewear', 'athletic', 'performance'],
  travel:    ['travel', 'comfortable', 'packable'],
  brunch:    ['smart casual'],
  festival:  ['festival'],
}

const OCCASION_LABEL: Record<string, string> = {
  beach: 'the beach', resort: 'a resort trip', wedding: 'a wedding', office: 'the office',
  interview: 'an interview', date: 'a date night', party: 'a party', blacktie: 'a black-tie event',
  cocktail: 'a cocktail event', gym: 'the gym', travel: 'travel', brunch: 'brunch', festival: 'a festival',
}

// Words that signal the message is conversation, not a product search.
const CONVERSATIONAL = /\b(compare|versus|vs\.?|which|what|how|why|can you|could you|would|should|tell me|explain|difference|better|goes? with|pairs? with|match(es)? with|style (this|it|them)|wear (this|it|with)|thoughts on|opinion|review|first one|second one|third one|that one|these|this one|hi|hello|hey|thanks|thank you|help)\b/i

// ── Budget parsing ─────────────────────────────────────────────────────────────
export function parseBudget(message: string, buyerCurrency: string): { budgetMax?: number; budgetCurrency?: string } {
  const m = message.toLowerCase().match(
    /(?:under|below|less than|up to|max(?:imum)?|budget(?: of)?|within|around|about)\s*([$€£¥₫])?\s*(\d+(?:[.,]\d+)?)\s*(k|m)?\s*(usd|eur|gbp|jpy|inr|vnd|aud|cad)?/
  ) || message.match(/([$€£¥₫])\s*(\d+(?:[.,]\d+)?)\s*(k|m)?/i)
  if (!m) return {}

  let amount = Number(String(m[2]).replace(',', '.'))
  if (!Number.isFinite(amount) || amount <= 0) return {}
  if (m[3]?.toLowerCase() === 'k') amount *= 1_000
  if (m[3]?.toLowerCase() === 'm') amount *= 1_000_000

  let currency = buyerCurrency
  const symbol = m[1]
  if (symbol === '$') currency = 'USD'
  if (symbol === '€') currency = 'EUR'
  if (symbol === '£') currency = 'GBP'
  if (symbol === '¥') currency = 'JPY'
  if (symbol === '₫') currency = 'VND'
  const explicit = (m[4] || '').toUpperCase()
  if (explicit.length === 3) currency = explicit

  return { budgetMax: amount, budgetCurrency: currency }
}

// ── Lexicon matching helper ────────────────────────────────────────────────────
function findInLexicon(q: string, lexicon: Record<string, string[]>): { canonical: string; matched: string; group: string[] }[] {
  const hits: { canonical: string; matched: string; group: string[] }[] = []
  for (const [canonical, synonyms] of Object.entries(lexicon)) {
    for (const syn of synonyms) {
      // word-boundary match; multi-word synonyms matched as substrings
      const pattern = syn.includes(' ') || syn.includes('-')
        ? syn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        : `\\b${syn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`
      if (new RegExp(pattern, 'i').test(q)) {
        hits.push({ canonical, matched: syn, group: synonyms })
        break
      }
    }
  }
  return hits
}

export type CompiledIntent = {
  args: SearchToolArgs
  /** Aesthetic entries detected — passed to ranking as soft signals. */
  aesthetics: StyleEntry[]
  /** Human-readable summary of what was compiled (for the reply text). */
  summary: string
}

/**
 * Compile a shopping query into a structured search plan.
 * Returns null when the message is conversational or no garment is detected —
 * those cases need the LLM planner.
 */
export function compileIntent(message: string, buyerCurrency: string): CompiledIntent | null {
  // Correct obvious fashion-term misspellings first ("blak jaket" → "black
  // jacket") so a typo compiles instantly instead of dropping to the LLM.
  const raw = normalizeFashionTypos(message.trim())
  if (!raw || raw.length < 3 || raw.length > 260) return null
  if (CONVERSATIONAL.test(raw)) return null

  const q = raw.toLowerCase()

  // Garment is required — pick the most specific hit (longest matched synonym
  // wins so "linen shirt dress" compiles to dress logic via "dress" vs "shirt"
  // ordering is resolved by match length).
  const garmentHits = findInLexicon(q, GARMENTS)
  if (garmentHits.length === 0) return null
  garmentHits.sort((a, b) => b.matched.length - a.matched.length)
  // Generic "top"/"shoes" lose to anything more specific
  const generic = new Set(['top', 'shoes'])
  const garment = garmentHits.find(h => !generic.has(h.canonical)) ?? garmentHits[0]

  const colorHits = findInLexicon(q, COLORS)
  const materialHits = findInLexicon(q, MATERIALS)
  const occasionHits = findInLexicon(q, OCCASIONS)
  occasionHits.sort((a, b) => b.matched.length - a.matched.length)
  const occasion = occasionHits[0]
  const aesthetics = matchStyles(raw)

  let gender: 'men' | 'women' | undefined
  for (const [g, terms] of Object.entries(GENDER_TERMS) as ['men' | 'women', string[]][]) {
    if (terms.some(t => new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(q))) {
      gender = g
      break
    }
  }

  const budget = parseBudget(raw, buyerCurrency)
  const sort = /\b(cheap|cheapest|affordable|budget|lowest)\b/i.test(q) ? 'price_asc'
    : /\b(expensive|premium|luxury|highest|finest|best quality)\b/i.test(q) ? 'price_desc'
    : 'relevance'

  // searchQuery: gender + color + material + garment + occasion — clean and specific
  const queryParts: string[] = []
  if (gender) queryParts.push(gender)
  if (colorHits[0]) queryParts.push(colorHits[0].matched)
  if (materialHits[0]) queryParts.push(materialHits[0].matched)
  queryParts.push(garment.matched)
  if (occasion) queryParts.push(OCCASION_BOOST[occasion.canonical][0])
  const searchQuery = queryParts.join(' ')

  // mandatoryConcepts: hard filters — garment always; color/material when explicit.
  // Gender goes last and, unlike color/material, is enforced as a genuine hard
  // reject downstream (GlobalCatalogService.requestedGenderFromConcepts) — a
  // menswear search must never surface a bona fide women's item. Occasion is a
  // soft ranking group only (styling nudge, not a strict attribute).
  const mandatoryConcepts: string[][] = [garment.group.slice(0, 8)]
  if (colorHits[0]) mandatoryConcepts.push(colorHits[0].group)
  if (materialHits[0]) mandatoryConcepts.push(materialHits[0].group)
  if (occasion) mandatoryConcepts.push(OCCASION_BOOST[occasion.canonical])
  if (gender === 'men') mandatoryConcepts.push(['men', "men's", 'mens', 'man', 'male'])
  if (gender === 'women') mandatoryConcepts.push(['women', "women's", 'womens', 'woman', 'ladies', 'female'])

  const args = SearchToolSchema.parse({
    searchQuery,
    ...budget,
    isClothing: true,
    mandatoryConcepts,
    sort,
  })

  const summaryParts: string[] = []
  if (colorHits[0]) summaryParts.push(colorHits[0].canonical)
  if (materialHits[0]) summaryParts.push(materialHits[0].canonical)
  summaryParts.push(garment.canonical)
  const summary = summaryParts.join(' ') + (occasion ? ` for ${OCCASION_LABEL[occasion.canonical]}` : '')

  return { args, aesthetics, summary }
}

// Remove any matched synonym of a lexicon from a string (used to let a new
// attribute override the previous one — "navy" replaces an earlier "blue").
function stripLexicon(text: string, lexicon: Record<string, string[]>): string {
  let out = text
  for (const synonyms of Object.values(lexicon)) {
    for (const syn of synonyms) {
      const pattern = syn.includes(' ') || syn.includes('-')
        ? syn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        : `\\b${syn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`
      out = out.replace(new RegExp(pattern, 'ig'), ' ')
    }
  }
  return out.replace(/\s+/g, ' ').trim()
}

// Extra refinement words that signal "continue the last search, tweaked" even
// when no colour/material/budget is present on their own.
const REFINEMENT_WORDS = /\b(cheap|cheaper|cheapest|affordable|expensive|pricier|premium|luxury|longer|shorter|looser|tighter|oversized|cropped|baggy|slim|relaxed|darker|lighter|warmer|brighter|bolder|plainer|simpler|fancier|dressier|casual|formal|short.sleeve|long.sleeve|sleeveless|other|others|different|more)\b/i

/**
 * Continuation compiler — folds a short refinement ("blue colour", "in linen",
 * "cheaper", "navy instead") into the PREVIOUS search so the conversation
 * carries context. Returns null when the message isn't a refinement of a prior
 * garment search (those go to the LLM). Attributes in the new message override
 * the old ones (a new colour replaces the previous colour).
 */
export function continueIntent(
  message: string,
  prevSearchQuery: string,
  buyerCurrency: string,
): CompiledIntent | null {
  const raw = normalizeFashionTypos(message.trim())
  if (!raw || raw.length < 2 || raw.length > 200) return null
  if (CONVERSATIONAL.test(raw)) return null
  const q = raw.toLowerCase()

  // The new message must NOT already name a garment — if it does, compileIntent
  // handles it as a fresh search and we shouldn't drag in stale context.
  if (findInLexicon(q, GARMENTS).length > 0) return null

  // The previous search must have a garment to continue from.
  const prev = (prevSearchQuery || '').toLowerCase()
  if (findInLexicon(prev, GARMENTS).length === 0) return null

  // The new message must carry a real refinement signal.
  const hasColor = findInLexicon(q, COLORS).length > 0
  const hasMaterial = findInLexicon(q, MATERIALS).length > 0
  const hasBudget = !!parseBudget(raw, buyerCurrency).budgetMax
  const hasStyle = matchStyles(raw).length > 0
  const hasOccasion = findInLexicon(q, OCCASIONS).length > 0
  const hasWord = REFINEMENT_WORDS.test(q)
  if (!hasColor && !hasMaterial && !hasBudget && !hasStyle && !hasOccasion && !hasWord) return null

  // Build the merged query: the new message first (so its attributes win), then
  // the previous query with any overridden attribute types stripped out.
  let base = prevSearchQuery
  if (hasColor) base = stripLexicon(base, COLORS)
  if (hasMaterial) base = stripLexicon(base, MATERIALS)
  const merged = `${raw} ${base}`.replace(/\s+/g, ' ').trim()

  return compileIntent(merged, buyerCurrency)
}

/** Templated lead-in for compiled searches — no LLM round-trip needed. */
export function compiledReplyText(intent: CompiledIntent, productCount: number): string {
  if (productCount === 0) {
    return `I couldn't find ${intent.summary} matches right now — try a different colour, material, or broader description.`
  }
  const leads = [
    `Here's a curated selection of ${intent.summary} pieces from independent brands.`,
    `Found some beautiful ${intent.summary} options for you.`,
    `A few ${intent.summary} picks worth a look.`,
  ]
  return leads[Math.floor(Math.random() * leads.length)]
}

/** Templated follow-up suggestions for compiled searches. */
export function compiledSuggestions(intent: CompiledIntent): string[] {
  const g = intent.summary
  const pool = [
    `Show me ${g} under $100`,
    `Do you have these in black?`,
    `What would pair well with ${g}?`,
    `Show me a more premium version`,
    `Something similar but more casual`,
  ]
  return pool.slice(0, 3)
}
