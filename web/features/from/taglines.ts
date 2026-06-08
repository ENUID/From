// ─────────────────────────────────────────────────────────────────────────────
// Tagline generator — thousands of unique, on-brand lines about individuality,
// fashion-as-art, and being one-of-one. Built combinatorially: small curated
// fragment pools multiply into thousands of grammatically-correct lines.
//
// Every fragment is written so that ANY combination reads cleanly:
//   • "truth" fragments are complete independent clauses (no trailing period)
//   • "imperative" fragments are complete imperative sentences (no trailing period)
//   • standalone families are full lines that already carry their own punctuation
//
// TAGLINES[0] is the deterministic hero line, shown on first paint (SSR-safe).
// ─────────────────────────────────────────────────────────────────────────────

// Fashion-as-art truths — "X is Y"
const ART_TRUTHS = [
  'Fashion is art',
  'Style is art',
  'Fashion is self-expression',
  'Getting dressed is an art',
  'Your wardrobe is a canvas',
  'Clothing is craft',
  'Fashion is a language',
  'Personal style is a signature',
  'What you wear is a statement',
  'Dressing well is an art',
  'Style is a kind of poetry',
  'Fashion is identity',
  'An outfit is a self-portrait',
  'Your look is your art',
  'Fashion is rebellion',
  'Style is storytelling',
  'Fashion is a craft',
  'Clothing is expression',
  'Every outfit is a creation',
  'Fashion is a feeling',
  'Style is freedom',
  'Fashion is never a formula',
  'Style is a living thing',
  'Fashion is a quiet art',
  'Getting dressed is a daily art',
  'Your style is your signature',
  'Fashion is personal',
  'An outfit is a mood made visible',
  'Style is the art you wear',
  'Fashion is a form of expression',
  'What you wear is who you are',
  'Style is character, worn',
  'Fashion is imagination, dressed',
  'Clothing is a kind of art',
  'Your wardrobe is your gallery',
]

// Truths about sameness, trends, and rarity
const WORLD_TRUTHS = [
  'Trends fade',
  'Copies multiply',
  'The world chases sameness',
  "Everyone's chasing the same look",
  "Style can't be mass produced",
  'Originality never goes on sale',
  'The crowd wears the crowd',
  'Sameness is everywhere',
  'Algorithms love the average',
  'Fast fashion forgets you',
  'Trends come and go',
  'The mall sells the same story',
  'Everyone is wearing everyone',
  'Real style is rare',
  'The best pieces are the rare ones',
  'Anyone can follow a trend',
  'Sameness sells, but it never lasts',
  'The crowd blends in',
  'Mass production has no memory',
  'A trend is just a borrowed idea',
  'Most closets look the same',
  'Conformity is comfortable, and forgettable',
  "Originality can't be ordered in bulk",
  'The internet wears a uniform',
  'Everyone has the same five things',
  'Trends are temporary',
  'Style outlives every trend',
  'The rare things are worth finding',
]

// Complete imperative sentences — follow any truth above
const IMPERATIVES = [
  'You should be the only one wearing it',
  'Make it unmistakably yours',
  'Wear it like no one else can',
  'Be the only one in the room',
  'No one should wear it like you',
  'Let it be entirely your own',
  'Be impossible to copy',
  'Be the original, never the echo',
  'Wear what no one else has found',
  'Stay one of one',
  'Be the limited edition',
  'Leave the trends to everyone else',
  'Stand alone, beautifully',
  'Refuse to blend in',
  'Be unrepeatable',
  'Own a piece only you have',
  'Be the only one who can wear it',
  'Keep it rare, keep it yours',
  'Be the rarest thing in the room',
  'Wear it your way or not at all',
  'Be a collection of one',
  'Stay unmistakable',
  'Be unforgettable, never identical',
  'Wear what no algorithm can repeat',
  'Be the exception, not the trend',
  'Be one of one',
  'Let no one else wear your story',
  'Make it impossible to mistake for anyone else',
  'Be singular',
  'Find the piece made for you alone',
  'Choose the rare over the everywhere',
  "Wear something the world hasn't seen",
  'Be the first and the only',
  "Dress like there's only one of you",
  'Let your style stand alone',
  'Be rare on purpose',
  'Wear nothing the crowd is wearing',
  'Make it a story only you can tell',
  "Be the one they can't copy",
  'Keep your look entirely your own',
  'Be the rare find',
  'Wear the unrepeatable',
  'Become impossible to imitate',
  'Be the only edition there is',
  'Let it belong to no one but you',
  'Choose singular over similar',
  "Be the original they'll try to copy",
  'Stay rare',
  'Wear your own kind of beautiful',
  'Be the one and only',
]

// "Your ___ should ___."
const THINGS = ['style', 'closet', 'wardrobe', 'look', 'outfit', 'fashion', 'signature', 'aesthetic']
const THING_PREDICATES = [
  'be yours alone',
  'belong to no one else',
  'have no duplicate',
  'tell a story no one else has lived',
  'be impossible to copy',
  'exist in an edition of one',
  'never appear on anyone else',
  'be one of one',
]

// Contrast pairs — "{crowd}. {you}."
const CROWD = [
  'Everyone follows',
  'The world copies',
  'Trends repeat',
  'They all blend in',
  'The crowd conforms',
  "Everyone's wearing the same story",
  'The feed sells sameness',
  'They chase the trend',
  'The mall makes clones',
  'Everyone looks the same',
]
const YOU = [
  "you don't",
  'you stay original',
  'you stay one of one',
  'you stay rare',
  'you stand apart',
  'you wear your own',
  'you write your own',
  'you stay unmistakable',
]

// "Be ___, not ___."
const BE_PAIRS: [string, string][] = [
  ['rare', 'repeated'],
  ['original', 'ordinary'],
  ['singular', 'similar'],
  ['the source', 'the copy'],
  ['art', 'a uniform'],
  ['remembered', 'repeated'],
  ['a signature', 'a trend'],
  ['one', 'one of many'],
  ['the original', 'an imitation'],
  ['unmistakable', 'invisible'],
  ['yourself', 'everyone else'],
  ['the exception', 'the rule'],
  ['rare', 'everywhere'],
  ['first', 'forgettable'],
  ['the muse', 'the mirror'],
  ['irreplaceable', 'interchangeable'],
]

// Standalone full lines (already punctuated)
const DRESS_LIKE = [
  "Dress like there's only one of you.",
  'Dress like the original you are.',
  'Dress like art, not algorithm.',
  'Dress like a collection of one.',
  'Dress like no one else can.',
  'Dress like the rare find you are.',
  'Dress like the trend ends with you.',
  "Dress like nobody's wearing what you're wearing.",
  'Dress like a one-of-one.',
  'Dress like you mean it.',
]

const STANDALONE = [
  'Only yours.',
  'One of one.',
  'Be the only one.',
  'The limited edition is you.',
  'You are the rare find.',
  'Wear what no one else can.',
  'Be impossible to copy.',
  'Style without a duplicate.',
  'Never the same twice.',
  'The original is you.',
  'No copies. Just you.',
  'Singular by design.',
  'You, in limited edition.',
  'Rare by nature.',
  'An audience of one.',
  'Different on purpose.',
  'Unmistakably you.',
  'Nothing like it. Nothing like you.',
  'Wear the unrepeatable.',
  'Originality, worn well.',
  'A wardrobe of one.',
  "You're the only edition.",
  'Rare is the point.',
  'Be the one of one.',
]

const DISCOVERY = [
  'Discover what no one else has found.',
  'Find the piece made for one.',
  'Unearth the unrepeatable.',
  'Find fashion with no twin.',
  'Discover the rare, the singular, the yours.',
  'Find what the crowd will never wear.',
  'Search for the one of one.',
  'Find the rare. Wear it first.',
]

const INDEPENDENT = [
  'Independent fashion for independent minds.',
  'Independent labels, singular style.',
  'From independent makers, for originals only.',
  'Small labels. One-of-a-kind you.',
  'Independent by design, original by nature.',
  "From the makers the crowd hasn't found.",
  'Independent style for the unrepeatable.',
  'For originals, by independents.',
]

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function build(): string[] {
  const out = new Set<string>()

  // Two-part: fashion-as-art truth + imperative  (hero = first iteration)
  for (const a of ART_TRUTHS) for (const i of IMPERATIVES) out.add(`${a}. ${i}.`)

  // Two-part: sameness truth + imperative
  for (const w of WORLD_TRUTHS) for (const i of IMPERATIVES) out.add(`${w}. ${i}.`)

  // "Your ___ should ___."
  for (const t of THINGS) for (const p of THING_PREDICATES) out.add(`Your ${t} should ${p}.`)

  // Contrast pairs
  for (const c of CROWD) for (const y of YOU) out.add(`${c}. ${cap(y)}.`)

  // "Be ___, not ___."
  for (const [a, b] of BE_PAIRS) out.add(`Be ${a}, not ${b}.`)

  // Standalone families
  for (const d of DRESS_LIKE) out.add(d)
  for (const s of STANDALONE) out.add(s)
  for (const d of DISCOVERY) out.add(d)
  for (const i of INDEPENDENT) out.add(i)

  return Array.from(out)
}

// Deterministic across server + client — safe for hydration. The hero line
// ("Fashion is art. You should be the only one wearing it.") is always index 0.
export const TAGLINES: string[] = build()

// Fisher-Yates over indices — call on the client only (after mount).
export function shuffledIndices(n: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
