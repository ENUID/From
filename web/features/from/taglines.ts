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
  'Fashion is a quiet rebellion',
  'Style is a point of view',
  'Fashion is autobiography',
  'Style is intuition, dressed',
  'Fashion is a second skin',
  'Style is confidence, tailored',
  'Fashion is emotion, worn',
  'Style is a slow art',
  'Fashion is invention',
  'Style is personal mythology',
  'Fashion is courage, dressed',
  'Style is your mood, shaped',
  'Fashion is play with intent',
  'Dressing is editing yourself',
  'Style is a quiet declaration',
  'Fashion is memory, worn',
  'Style is instinct, dressed up',
  'Fashion is a craft of one',
  'Style is the art of being seen',
  'Fashion is a daily masterpiece',
  'Your clothes are your handwriting',
  'Style is taste made tangible',
  'Fashion is a form of courage',
  'An outfit is a self you author',
  'Style is the shape of your mood',
  'Fashion is imagination, dressed',
  'Your look is a signature in motion',
  'Style is a living draft',
  'Fashion is a private language',
  'Dressing well is quiet artistry',
  'Style is character in motion',
  'Fashion is a mood made visible',
  'Your wardrobe is a self in progress',
  'Style is a daily invention',
  'Fashion is you, made visible',
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
  'The crowd buys in bulk',
  'Trends have no memory',
  'Sameness is a trap',
  'The feed repeats itself',
  "Everyone owns the same it-bag",
  'A trend forgets you by spring',
  'The high street sells copies',
  'Originality is the only luxury',
  'Rarity never trends',
  'The crowd chases, the rare lead',
  'Mass appeal is forgettable',
  'The same look is everywhere',
  'Trends are borrowed, not yours',
  'Conformity is a uniform',
  'The algorithm rewards the average',
  'Most style is secondhand',
  'The crowd settles for similar',
  'Viral fades fast',
  'The mall has no imagination',
  "Everyone's feed looks the same",
  'Sameness is the default',
  'A trend is a crowd in clothing',
  'Real rarity is quiet',
  'The internet copies itself',
  'Trends are made to expire',
  "The crowd wants what it's told",
  'Fast fashion has no soul',
  'The ordinary is overstocked',
  'Uniqueness is going extinct',
  'The rare gets remembered',
  'Trends are everyone’s, never yours',
  "The crowd follows; originals don't",
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
  'Wear the rare thing',
  "Be the piece they can't find",
  'Make sameness impossible',
  'Be the one they remember',
  "Wear what can't be duplicated",
  'Stand out by standing alone',
  'Be a style of one',
  'Let the crowd copy later',
  'Wear your own signature',
  'Be too rare to replicate',
  'Keep it singular',
  'Be the find no one else made',
  'Wear nothing off the shelf of sameness',
  'Be the original in the room',
  'Make it yours and only yours',
  'Be the rare exception',
  'Wear it before the world catches on',
  'Be impossible to find twice',
  'Stay irreplaceable',
  'Be the one-of-one they envy',
  "Wear what the feed can't sell",
  'Be the rarest version of you',
  'Choose rare over everywhere',
  'Be the original, not the reprint',
  'Wear a look with no copy',
  'Be unmistakably one of one',
  'Make every outfit unrepeatable',
  "Be the style they can't source",
  'Wear the thing no one else dared',
  'Be remembered, not repeated',
  'Keep your edge entirely your own',
  'Be the only signature in the room',
  'Wear the unrepeatable thing',
  'Be rare, stay rare',
  'Make it impossible to imitate',
  'Be the one and only original',
  'Wear what sets you apart',
  'Be a limited run of one',
  'Stay impossible to copy',
  'Be the rare one',
  'Wear your difference proudly',
  'Be the original they chase',
]

// "Your ___ should ___."
const THINGS = ['style', 'closet', 'wardrobe', 'look', 'outfit', 'fashion', 'signature', 'aesthetic', 'taste', 'edge', 'identity']
const THING_PREDICATES = [
  'be yours alone',
  'belong to no one else',
  'have no duplicate',
  'tell a story no one else has lived',
  'be impossible to copy',
  'exist in an edition of one',
  'never appear on anyone else',
  'be one of one',
  'set you apart',
  'be impossible to source',
  'be a limited run of one',
  'never trend',
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
  'The feed repeats',
  'They buy in bulk',
  'The mall clones everyone',
  'Everyone copies everyone',
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
  'you stay singular',
  'you stay irreplaceable',
  'you lead',
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
  ['the artist', 'the audience'],
  ['rare', 'restocked'],
  ['the original', 'the reprint'],
  ['singular', 'stocked'],
  ['one of one', 'one of many'],
  ['remembered', 'replaced'],
  ['the rule-breaker', 'the follower'],
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
  // Single-pass greedy: if two consecutive entries share the same first word
  // (e.g. "Fashion is art" → "Fashion is rebellion"), swap the second with the
  // next entry that starts differently.  This stops runs of "Fashion is…" or
  // "Style is…" lines from feeling like repeats.
  for (let i = 1; i < a.length; i++) {
    const prevWord = TAGLINES[a[i - 1]].split(' ')[0]
    if (TAGLINES[a[i]].split(' ')[0] === prevWord) {
      for (let j = i + 1; j < a.length; j++) {
        if (TAGLINES[a[j]].split(' ')[0] !== prevWord) {
          ;[a[i], a[j]] = [a[j], a[i]]
          break
        }
      }
    }
  }
  return a
}

// ── Witty search-bar placeholders — shown in the input when idle ─────────────
// Every line is hand-written and unique. No combinatorial generation.
export const WITTY_PLACEHOLDERS: string[] = [
  "Speak, mortal. What do you desire?",
  "Awaiting your supreme decree...",
  "I am but a humble servant to your credit card.",
  "Command me, oh sovereign of the shopping cart.",
  "I'll fetch it, but I won't pretend to like it.",
  "Your wish is my command... within legal limits.",
  "Tell me what to fetch, my liege.",
  "Type something. I'm getting bored.",
  "We both know you don't need another one.",
  "I can find anything except your self-control.",
  "Go ahead, buy it. Your secret is safe.",
  "Searching... because scrolling is too much work.",
  "I'm ready when you finally make up your mind.",
  "Enter your latest, highly questionable fixation.",
  "Unleash your wildest consumerism here.",
  "What are we secretly obsessing over today?",
  "Let's pretend this is a necessity.",
  "Feed the algorithm. It's hungry.",
  "Another midnight impulse purchase? Let's go.",
  "Your royal treasury is ready to be emptied.",
  "Don't worry, I won't judge your search history.",
  "Tell me what to find so I can look smart.",
  "Better than typing 'Amazon' again, right?",
  "Just type it. I've seen much, much weirder.",
  "Searching the void so you don't have to.",
  "Drop the keywords and let the magic happen.",
  "This outfit isn't going to buy itself.",
  "Your wardrobe called. It's lonely.",
  "What's today's excuse for spending money?",
  "The cart is empty. That's practically an emergency.",
  "Go on. Justify it. You always do.",
  "Your future self is going to blame your current self.",
  "I have no opinions. I only execute orders.",
  "Tell me your desire. I won't tell your bank.",
  "The hunt begins whenever you're ready.",
  "Don't overthink it. The algorithm already did.",
  "Retail therapy begins with a single search.",
  "I'm legally obligated to help you spend money.",
  "Ask and ye shall receive. Probably.",
  "Ready for another beautiful mistake?",
  "Your next great regret is one search away.",
  "Who am I to stop you? Type it.",
  "What fresh obsession shall we chase today?",
  "The wallet is shaking in anticipation.",
  "This space is safe. Your bank account is not.",
  "Name your poison. I'll find the finest version.",
  "One search away from 'treat yourself' to 'where did my money go'.",
  "I don't make the purchases. I just make them easier.",
  "The forbidden purchase is calling your name.",
  "No judgment here. Only fast delivery.",
  "Your rationalisations are already loading.",
  "Describe it vaguely. I work best under pressure.",
  "Something beautiful is waiting to be found. Or something impractical.",
  "What are we convincing ourselves we need today?",
  "The closet is full. The search bar is empty. Curious.",
  "Describe the vague itch you can't scratch.",
  "Think of this as a very expensive therapy session.",
  "I've enabled worse decisions. Type away.",
  "What shall we acquire in the name of self-expression?",
  "Whatever it is, I'll pretend it was a great idea.",
  "The independent stores are watching. Impressed.",
  "This is not a drill. You actually need to type something.",
  "Your inner shopaholic is standing by.",
  "Name the thing you've been thinking about at 2am.",
  "Be honest with me. I'm just a search bar.",
  "Today's question: what would make you feel like yourself?",
  "The universe is ready. Are you?",
  "You've been thinking about it for weeks. Just search.",
  "Your style is trying to say something. Help it speak.",
  "Start with a word. I'll handle the rest.",
  "Describe what you're looking for. Or just the vibe.",
  "What does the best version of you wear?",
  "Something out there has your name on it. Let's find it.",
  "I'm serious. Type something. I'm actually bored.",
  "Your next favourite thing is waiting to be found.",
  "This is between you, me, and your bank.",
  "The council of independent makers awaits your command.",
  "What are we justifying as an investment today?",
  "A beautiful piece is one search away. Probably two.",
  "Ready to find the thing no one else has? Or just browsing?",
  "Your wish, my execution, their regret for not finding it first.",
  "The rarest things don't find themselves.",
  "Type it before you talk yourself out of it.",
  "Your impulse has good taste. Let it speak.",
  "Some decisions are worth regretting in style.",
  "You came here with intent. I respect that.",
  "Say the word. I know a few good independent brands.",
  "Whatever it is, independent makers probably did it better.",
  "What would you buy if no one was watching?",
  "The fashion gods are listening. Speak.",
  "This is a judgement-free zone. Search freely.",
  "Your closet's next chapter starts with one word.",
  "Describe the piece you keep drawing in your head.",
  "Nothing in this bar will shame you. The price tag might.",
  "Come on. We both know why you're here.",
  "Your style instincts are rarely wrong. Trust them.",
  "The right piece changes everything. Help me find it.",
  "What would a very stylish version of you search for?",
  "Go ahead. Betray your budget with dignity.",
  "Something here was made just for you. Let's narrow it down.",
  "Whatever 'it' is, there's an independent maker who made it better.",
]

// ── Time-based selection — one tagline per 4-hour wall-clock window ──────────
// The line is a pure function of the current 4-hour block, so it's identical
// across reloads, devices, and SSR vs client (no hydration mismatch), and it
// flips exactly when the block rolls over. A Knuth multiplicative hash scatters
// consecutive blocks across the whole array so neighbouring windows feel
// completely different rather than stepping through similar lines.
export const FOUR_HOURS_MS = 4 * 60 * 60 * 1000

export function taglineForTime(now: number = Date.now()): string {
  const block = Math.floor(now / FOUR_HOURS_MS)
  const idx = Math.abs((block * 2654435761) % TAGLINES.length)
  return TAGLINES[idx]
}
