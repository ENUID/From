export type StyleEntry = {
  description: string
  materials: string[]
  keywords: string[]
  avoid: string[]
  colorPalette: string[]
  priceSignal: 'budget' | 'mid' | 'premium' | 'luxury'
  occasions: string[]
}

export const styleVocabulary: Record<string, StyleEntry> = {
  // ── Classic / Refined ──────────────────────────────────────────────────────
  'quiet luxury': {
    description:
      'Understated elegance — no logos, no graphics, impeccable fit. Cashmere, merino, linen, silk in neutral tones. The richest-looking outfit in the room never shouts.',
    materials: ['cashmere', 'merino wool', 'silk', 'linen', 'fine cotton', 'leather'],
    keywords: ['tailored', 'minimalist', 'neutral', 'no logo', 'understated', 'refined', 'clean'],
    avoid: ['logo', 'graphic', 'sequin', 'neon', 'streetwear', 'distressed'],
    colorPalette: ['ivory', 'stone', 'camel', 'sand', 'navy', 'black', 'white', 'cream', 'taupe'],
    priceSignal: 'luxury',
    occasions: ['business', 'dinner', 'weekend', 'travel', 'formal'],
  },
  'old money': {
    description:
      'Inherited style — classic Brooks Brothers, Barbour, Ralph Lauren. Timeless pieces worn with the confidence of someone who never needed to try. Patina over perfection.',
    materials: ['tweed', 'flannel', 'corduroy', 'oxford cloth', 'wool', 'leather', 'suede'],
    keywords: ['heritage', 'classic', 'blazer', 'oxford shirt', 'chinos', 'loafer', 'polo'],
    avoid: ['fast fashion', 'polyester', 'logo', 'neon', 'crop top'],
    colorPalette: ['hunter green', 'burgundy', 'navy', 'camel', 'cream', 'khaki', 'brown'],
    priceSignal: 'premium',
    occasions: ['country weekend', 'club', 'sailing', 'garden party', 'business casual'],
  },
  'stealth wealth': {
    description:
      'Money that whispers. No visible branding. Exceptional fit and quality fabric are the only signals. Looks simple — costs a lot.',
    materials: ['cashmere', 'vicuna', 'silk', 'linen', 'merino', 'fine leather'],
    keywords: ['minimal', 'no logo', 'elevated basics', 'clean', 'tailored', 'premium'],
    avoid: ['logo', 'graphic', 'statement piece', 'trend'],
    colorPalette: ['off-white', 'stone', 'navy', 'charcoal', 'black', 'camel'],
    priceSignal: 'luxury',
    occasions: ['any', 'business', 'travel', 'dinner'],
  },
  minimalist: {
    description:
      'Reduction as a design philosophy. Every item earns its place. Clean lines, monochrome or tonal, nothing superfluous. Quality over quantity.',
    materials: ['cotton', 'linen', 'wool', 'silk', 'modal'],
    keywords: ['clean', 'simple', 'monochrome', 'tonal', 'structured', 'basics'],
    avoid: ['pattern', 'graphic', 'embellishment', 'bright color', 'logo'],
    colorPalette: ['white', 'black', 'grey', 'navy', 'stone', 'off-white'],
    priceSignal: 'premium',
    occasions: ['everyday', 'work', 'weekend', 'travel'],
  },
  'japanese minimalism': {
    description:
      'Wabi-sabi meets tailoring. Oversized but deliberate, textured but neutral, functional but beautiful. Comme des Garçons, Issey Miyake energy — art you can wear.',
    materials: ['linen', 'cotton', 'wool', 'raw denim', 'handwoven fabric'],
    keywords: ['oversized', 'asymmetric', 'draped', 'textured', 'deconstructed', 'artisan'],
    avoid: ['logo', 'tight fit', 'fast fashion', 'synthetic'],
    colorPalette: ['white', 'black', 'indigo', 'natural', 'grey', 'ecru'],
    priceSignal: 'premium',
    occasions: ['gallery', 'creative work', 'weekend', 'travel'],
  },
  'corporate minimalism': {
    description:
      'Professional uniform done beautifully. Tailored trousers, silk blouse, structured blazer. Every piece interchangeable. Dressing for the job you want.',
    materials: ['wool', 'silk', 'fine cotton', 'cashmere blend'],
    keywords: ['blazer', 'trousers', 'structured', 'tailored', 'polished', 'professional'],
    avoid: ['casual', 'distressed', 'graphic', 'athleisure'],
    colorPalette: ['navy', 'charcoal', 'black', 'white', 'camel', 'ivory'],
    priceSignal: 'premium',
    occasions: ['office', 'presentation', 'business dinner', 'interview'],
  },
  preppy: {
    description:
      'East Coast collegiate — popped collar, loafers without socks, sweater tied over shoulders. Cheerful and polished, rooted in American university tradition.',
    materials: ['piqué cotton', 'oxford cloth', 'chino', 'cable knit', 'tartan'],
    keywords: ['polo', 'chinos', 'loafer', 'blazer', 'oxford', 'cable knit', 'stripe'],
    avoid: ['streetwear', 'distressed', 'oversized', 'grunge'],
    colorPalette: ['navy', 'red', 'white', 'kelly green', 'yellow', 'pink', 'madras'],
    priceSignal: 'mid',
    occasions: ['campus', 'weekend', 'club', 'casual office'],
  },
  'ivy league': {
    description:
      'Academic tradition meets effortless cool. J.Press, Brooks Brothers, dusty archives. The original prep — more serious, less colourful.',
    materials: ['oxford cloth', 'seersucker', 'madras', 'tweed', 'flannel'],
    keywords: ['oxford button-down', 'repp stripe tie', 'sport coat', 'chino', 'penny loafer'],
    avoid: ['athleisure', 'streetwear', 'fast fashion'],
    colorPalette: ['grey', 'navy', 'brown', 'cream', 'burgundy'],
    priceSignal: 'mid',
    occasions: ['campus', 'office', 'weekend', 'club'],
  },
  nautical: {
    description:
      'Maritime heritage — Breton stripe, canvas, brass hardware. Salt air, deck shoes, navy and white. Effortless coastal without being kitschy.',
    materials: ['canvas', 'cotton twill', 'linen', 'oilskin', 'navy wool'],
    keywords: ['Breton stripe', 'navy stripe', 'deck shoe', 'peacoat', 'anchor', 'sailor collar'],
    avoid: ['neon', 'heavy pattern', 'landlocked'],
    colorPalette: ['navy', 'white', 'red', 'Breton stripe', 'ecru'],
    priceSignal: 'mid',
    occasions: ['coastal', 'weekend', 'summer', 'casual'],
  },

  // ── Street / Urban / Edge ──────────────────────────────────────────────────
  streetwear: {
    description:
      'Born on the block, worn by Supreme drop lines. Bold graphics, relaxed fit, expensive sneakers as the punctuation mark. Status without formality.',
    materials: ['cotton fleece', 'heavyweight cotton', 'nylon', 'denim'],
    keywords: ['hoodie', 'graphic tee', 'cargo', 'sneaker', 'cap', 'oversized', 'drop shoulder'],
    avoid: ['formal', 'tailored', 'luxury', 'minimalist'],
    colorPalette: ['black', 'white', 'grey', 'red', 'olive', 'earth tones'],
    priceSignal: 'mid',
    occasions: ['casual', 'weekend', 'streetwear events', 'sneaker drops'],
  },
  techwear: {
    description:
      'Urban survivalism. MOLLE attachments, waterproof fabric, modular pockets, utility as aesthetic. Function and edge in equal measure.',
    materials: ['Gore-Tex', 'nylon', 'rip-stop', 'polyester', 'technical fabric'],
    keywords: ['cargo', 'waterproof', 'utility', 'modular', 'zip', 'harness', 'tactical'],
    avoid: ['cotton', 'linen', 'formal', 'delicate'],
    colorPalette: ['black', 'charcoal', 'grey', 'olive', 'navy'],
    priceSignal: 'premium',
    occasions: ['urban', 'outdoor', 'commute', 'casual'],
  },
  'dark academia': {
    description:
      'Gothic libraries and candlelit scholarship. Tweed blazers, turtlenecks, Oxford brogues, literary melancholy. The aesthetic of someone who reads Dostoevsky for fun.',
    materials: ['tweed', 'herringbone', 'flannel', 'corduroy', 'wool'],
    keywords: ['blazer', 'turtleneck', 'oxford', 'brogue', 'plaid', 'structured', 'layered'],
    avoid: ['bright color', 'logo', 'athletic', 'casual'],
    colorPalette: ['dark brown', 'tan', 'forest green', 'burgundy', 'black', 'cream', 'caramel'],
    priceSignal: 'mid',
    occasions: ['academic', 'gallery', 'dinner', 'autumn/winter'],
  },
  'light academia': {
    description:
      'The sunny sibling of dark academia — linen blazers, tortoiseshell glasses, meadow picnics. More Merchant Ivory than gothic novel.',
    materials: ['linen', 'cotton', 'light wool', 'soft flannel'],
    keywords: ['linen blazer', 'pleated trousers', 'loafer', 'stripe', 'tote bag', 'layered'],
    avoid: ['synthetic', 'dark heavy', 'streetwear'],
    colorPalette: ['cream', 'warm beige', 'sage', 'dusty pink', 'light grey', 'tan'],
    priceSignal: 'mid',
    occasions: ['campus', 'café', 'summer', 'gallery'],
  },
  grunge: {
    description:
      'Seattle rain and flannel shirts tied at the waist. Deliberate deconstruction — ripped, layered, heavy boot. Anti-fashion as its own fashion.',
    materials: ['flannel', 'denim', 'leather', 'cotton jersey'],
    keywords: ['flannel', 'ripped', 'distressed', 'combat boot', 'oversized', 'layered', 'band tee'],
    avoid: ['polished', 'tailored', 'luxury', 'formal'],
    colorPalette: ['black', 'plaid', 'washed grey', 'navy', 'red plaid'],
    priceSignal: 'budget',
    occasions: ['casual', 'weekend', 'concert', 'festival'],
  },
  punk: {
    description:
      'Leather, studs, safety pins, spiked boots. Rebellion as craft. Anti-establishment but obsessive about fit. More considered than it looks.',
    materials: ['leather', 'PVC', 'denim', 'fishnet', 'tartan'],
    keywords: ['stud', 'spike', 'combat boot', 'leather jacket', 'ripped', 'tartan', 'chain'],
    avoid: ['preppy', 'luxury', 'polished', 'minimalist'],
    colorPalette: ['black', 'red', 'tartan', 'bleach'],
    priceSignal: 'mid',
    occasions: ['concert', 'night out', 'casual', 'event'],
  },
  Y2K: {
    description:
      'Early 2000s nostalgia — low-rise, butterfly clips, velour tracksuits, Von Dutch trucker hats. Bratz doll energy, unashamedly.',
    materials: ['velour', 'satin', 'denim', 'metallic fabric', 'jersey'],
    keywords: ['low rise', 'velour tracksuit', 'baby tee', 'butterfly', 'rhinestone', 'metallic'],
    avoid: ['conservative', 'minimalist', 'mature'],
    colorPalette: ['pink', 'baby blue', 'white', 'chrome', 'holographic'],
    priceSignal: 'budget',
    occasions: ['casual', 'party', 'festival', 'night out'],
  },
  '90s': {
    description:
      'Grunge, hip-hop, and Friends — all in one decade. Wide-leg jeans, slip dresses over tees, chunky sneakers. Effortlessly cool and already vintage.',
    materials: ['denim', 'jersey', 'satin', 'nylon', 'cotton'],
    keywords: ['wide leg', 'slip dress', 'chunky sneaker', 'bucket hat', 'oversized', 'plaid'],
    avoid: ['skinny', 'formal', 'luxury'],
    colorPalette: ['denim blue', 'earth brown', 'olive', 'black', 'pattern'],
    priceSignal: 'budget',
    occasions: ['casual', 'weekend', 'festival', 'night out'],
  },
  vintage: {
    description:
      'Pre-loved, pre-owned, perfectly curated. The thrill of the find — a 1970s suede jacket, a 1960s shift dress, a 1950s bowling shirt. History with style.',
    materials: ['natural fibres', 'suede', 'denim', 'cotton', 'silk', 'wool'],
    keywords: ['vintage', 'retro', 'secondhand', 'classic', 'era-specific', 'deadstock'],
    avoid: ['fast fashion', 'synthetic', 'logo (modern)'],
    colorPalette: ['warm earth', 'faded', 'muted', 'heritage pattern'],
    priceSignal: 'mid',
    occasions: ['casual', 'weekend', 'event', 'any'],
  },

  // ── Outdoors / Active ──────────────────────────────────────────────────────
  gorpcore: {
    description:
      'Trail aesthetics for the city. Salomon shoes, Arc\'teryx shell, Patagonia fleece — worn in Soho, not just Yosemite. Function as fashion.',
    materials: ["Gore-Tex", 'fleece', 'nylon', 'technical fabric', 'merino wool'],
    keywords: ['trail shoe', 'hiking boot', 'fleece', 'anorak', 'cargo', 'technical', 'outdoor'],
    avoid: ['formal', 'delicate', 'silk', 'tailored'],
    colorPalette: ['olive', 'orange', 'cobalt', 'rust', 'forest green', 'black'],
    priceSignal: 'mid',
    occasions: ['outdoor', 'urban casual', 'weekend', 'travel'],
  },
  'heritage workwear': {
    description:
      'Carhartt duck canvas, Red Wing boots, selvedge denim. Built to last decades — working-class craftsmanship elevated to art.',
    materials: ['duck canvas', 'denim', 'leather', 'flannel', 'waxed cotton'],
    keywords: ['chore coat', 'duck canvas', 'selvedge denim', 'work boot', 'flannel shirt', 'bib'],
    avoid: ['delicate', 'silk', 'formal', 'athleisure'],
    colorPalette: ['brown', 'olive', 'indigo denim', 'tan', 'black', 'rust'],
    priceSignal: 'mid',
    occasions: ['casual', 'weekend', 'outdoor', 'creative work'],
  },
  athleisure: {
    description:
      'Performance fabric meets street credibility. Lululemon leggings to a coffee meeting — elevated comfort that doesn\'t try to hide being sportswear.',
    materials: ['lycra', 'moisture-wicking fabric', 'nylon', 'modal', 'stretch cotton'],
    keywords: ['legging', 'jogger', 'sports bra', 'hoodie', 'bomber', 'trainer'],
    avoid: ['formal', 'tailored', 'delicate'],
    colorPalette: ['black', 'grey', 'navy', 'white', 'earth tones', 'pastel'],
    priceSignal: 'mid',
    occasions: ['gym', 'casual', 'errands', 'weekend'],
  },
  'sport luxe': {
    description:
      'Luxury brands meet athletic shapes. Loro Piana softshell, Brunello Cucinelli jogger, The Row sneaker. Premium materials in sporty silhouettes.',
    materials: ['cashmere', 'technical merino', 'premium nylon', 'fine cotton'],
    keywords: ['luxury sneaker', 'premium jogger', 'track pant', 'knit polo', 'performance'],
    avoid: ['fast fashion', 'logo-heavy', 'casual cotton'],
    colorPalette: ['ivory', 'navy', 'black', 'white', 'stone'],
    priceSignal: 'luxury',
    occasions: ['casual luxury', 'weekend', 'travel', 'resort'],
  },

  // ── Romantic / Soft ───────────────────────────────────────────────────────
  bohemian: {
    description:
      'Flowing maxi dresses, fringed leather, layered beads. Festival-ready meets globally-influenced — Morocco, India, 1970s California, all at once.',
    materials: ['linen', 'cotton gauze', 'suede', 'embroidered cotton', 'silk chiffon'],
    keywords: ['maxi', 'flowy', 'fringe', 'embroidered', 'layered', 'ethnic pattern', 'peasant'],
    avoid: ['structured', 'tailored', 'minimalist', 'corporate'],
    colorPalette: ['terracotta', 'burnt orange', 'warm red', 'gold', 'cream', 'turquoise'],
    priceSignal: 'mid',
    occasions: ['festival', 'beach', 'casual', 'summer', 'travel'],
  },
  cottagecore: {
    description:
      'Pastoral fantasy — floral dresses, linen aprons, wicker baskets. Living in a countryside cottage, baking bread, picking wildflowers.',
    materials: ['cotton', 'linen', 'gingham', 'floral cotton', 'broderie anglaise'],
    keywords: ['floral', 'gingham', 'lace trim', 'puff sleeve', 'midi dress', 'apron', 'linen'],
    avoid: ['urban', 'structured', 'minimal', 'synthetic'],
    colorPalette: ['butter yellow', 'sage green', 'blush', 'cream', 'floral pattern'],
    priceSignal: 'budget',
    occasions: ['casual', 'weekend', 'garden', 'picnic', 'travel'],
  },
  'ballet core': {
    description:
      'Pirouette meets street. Wrap cardigan, satin ballet flat, legwarmer, pale pink and cream. Miu Miu runway meets the Royal Ballet changing room.',
    materials: ['satin', 'mesh', 'knit', 'chiffon', 'velvet ribbon'],
    keywords: ['wrap', 'ballet flat', 'legwarmer', 'tutu', 'ribbon tie', 'leotard', 'satin bow'],
    avoid: ['chunky', 'heavy', 'dark colors', 'utility'],
    colorPalette: ['blush pink', 'cream', 'pale pink', 'white', 'dusty rose'],
    priceSignal: 'mid',
    occasions: ['casual', 'creative', 'night out', 'spring/summer'],
  },
  romantic: {
    description:
      'Soft femininity — ruffles, sheer fabrics, floral prints, feminine silhouettes. Dressing as if in a Klimt painting or a Sofia Coppola film.',
    materials: ['silk', 'chiffon', 'velvet', 'lace', 'organza'],
    keywords: ['ruffle', 'floral', 'sheer', 'empire waist', 'feminine', 'delicate', 'frill'],
    avoid: ['structured', 'minimal', 'masculine', 'utility'],
    colorPalette: ['blush', 'rose', 'ivory', 'burgundy', 'soft red', 'lilac'],
    priceSignal: 'mid',
    occasions: ['date', 'dinner', 'event', 'spring/summer', 'casual'],
  },
  fairycore: {
    description:
      'Enchanted forest meets fashion. Gossamer fabrics, ethereal layers, floral crowns, iridescent accessories. Dressing as if between worlds.',
    materials: ['tulle', 'organza', 'chiffon', 'lace', 'velvet', 'sheer'],
    keywords: ['ethereal', 'sheer', 'iridescent', 'floral', 'layered', 'whimsical', 'light'],
    avoid: ['minimal', 'structured', 'heavy'],
    colorPalette: ['white', 'pale green', 'lilac', 'silver', 'iridescent', 'blush'],
    priceSignal: 'mid',
    occasions: ['festival', 'event', 'creative', 'summer'],
  },

  // ── Bold / Artistic ───────────────────────────────────────────────────────
  maximalist: {
    description:
      'More is more is more. Pattern mixing, colour clashing, layering textures. Iris Apfel energy — wear everything, apologise for nothing.',
    materials: ['velvet', 'brocade', 'sequin', 'printed fabric', 'mixed textures'],
    keywords: ['pattern mixing', 'bold color', 'print', 'layered', 'statement', 'rich'],
    avoid: ['minimal', 'neutral', 'understated', 'quiet'],
    colorPalette: ['all of them — clashing and intentional'],
    priceSignal: 'mid',
    occasions: ['event', 'creative', 'art', 'night out', 'party'],
  },
  eclectic: {
    description:
      'Curated chaos — every era, every culture, perfectly wrong together. The outfit looks like an accident; it took an hour.',
    materials: ['mixed', 'vintage', 'varied texture', 'any'],
    keywords: ['mixed print', 'unusual combination', 'statement', 'unexpected', 'layered'],
    avoid: ['matching', 'uniform', 'conventional'],
    colorPalette: ['unexpected combinations', 'varied'],
    priceSignal: 'mid',
    occasions: ['creative', 'art', 'event', 'casual', 'any'],
  },
  artistic: {
    description:
      'The gallery is the runway. Sculptural pieces, unusual materials, clothing as self-expression and conversation. Rei Kawakubo energy.',
    materials: ['unusual materials', 'sculptural fabric', 'experimental', 'handmade'],
    keywords: ['sculptural', 'avant-garde', 'art piece', 'statement', 'unusual silhouette'],
    avoid: ['conventional', 'commercial', 'mainstream'],
    colorPalette: ['concept-driven', 'monochrome or extreme contrast'],
    priceSignal: 'premium',
    occasions: ['gallery', 'event', 'creative work', 'performance'],
  },
  'dark romantic': {
    description:
      'Velvet meets shadow. Deep jewel tones, Victorian silhouettes, corsets, lace. Gothic romance without the Halloween costume energy.',
    materials: ['velvet', 'lace', 'brocade', 'silk', 'leather'],
    keywords: ['corset', 'velvet', 'lace', 'Victorian', 'dark floral', 'ruffle', 'jewel tone'],
    avoid: ['casual', 'minimal', 'bright'],
    colorPalette: ['black', 'deep burgundy', 'midnight blue', 'forest green', 'oxblood'],
    priceSignal: 'mid',
    occasions: ['night out', 'event', 'dinner', 'autumn/winter'],
  },
  'mob wife': {
    description:
      'Fur (real or faux), leopard print, gold jewellery, full glam. Loudly luxurious, overtly powerful, no apologies. Sopranos dinner party.',
    materials: ['faux fur', 'satin', 'velvet', 'animal print', 'leather'],
    keywords: ['fur coat', 'leopard print', 'gold', 'satin', 'oversized jewelry', 'dramatic'],
    avoid: ['minimalist', 'understated', 'athletic'],
    colorPalette: ['black', 'gold', 'leopard', 'red', 'cream fur', 'camel'],
    priceSignal: 'mid',
    occasions: ['night out', 'event', 'dinner', 'party'],
  },

  // ── Contemporary Easy ─────────────────────────────────────────────────────
  'clean girl': {
    description:
      'Effortlessly put together — like you woke up looking this good. Slicked bun, gold hoops, quality basics, not trying too hard.',
    materials: ['cotton', 'linen', 'jersey', 'denim', 'leather'],
    keywords: ['sleek', 'minimal', 'basics', 'gold hoop', 'slicked back', 'neutral', 'fitted'],
    avoid: ['fussy', 'busy pattern', 'over-styled'],
    colorPalette: ['white', 'cream', 'tan', 'black', 'nude', 'gold'],
    priceSignal: 'mid',
    occasions: ['everyday', 'work', 'weekend', 'errand', 'brunch'],
  },
  'coastal grandmother': {
    description:
      'Linen everything, natural fibre, easy silhouette. Nancy Meyers kitchen energy — Hamptons summer, well-read, unhurried elegance.',
    materials: ['linen', 'cotton', 'cashmere', 'natural fibre'],
    keywords: ['linen shirt', 'wide leg trouser', 'basket bag', 'loafer', 'relaxed', 'natural'],
    avoid: ['fast fashion', 'synthetic', 'fussy', 'streetwear'],
    colorPalette: ['white', 'navy', 'cream', 'sand', 'warm grey', 'pale blue'],
    priceSignal: 'mid',
    occasions: ['weekend', 'beach', 'summer', 'casual', 'travel'],
  },
  'resort wear': {
    description:
      'Vacation at its most stylish — coverups, wide brim hats, printed shirt dresses, linen co-ords. Poolside or runway, it works.',
    materials: ['linen', 'cotton', 'silk', 'canvas', 'light knit'],
    keywords: ['resort', 'vacation', 'coverup', 'wide brim hat', 'printed shirt', 'co-ord', 'swim'],
    avoid: ['heavy', 'dark', 'formal'],
    colorPalette: ['coral', 'turquoise', 'white', 'tropical print', 'natural'],
    priceSignal: 'mid',
    occasions: ['beach', 'pool', 'holiday', 'summer', 'travel'],
  },
  'quiet streetwear': {
    description:
      'The cooler sibling of streetwear — premium materials, neutral palette, subdued logos or none. Still a sneaker at the center, but Nikes replaced by New Balance 991.',
    materials: ['heavyweight cotton', 'premium jersey', 'nylon', 'merino'],
    keywords: ['neutral streetwear', 'premium basics', 'clean sneaker', 'relaxed fit', 'tonal'],
    avoid: ['loud logo', 'bright color', 'graphic heavy'],
    colorPalette: ['grey', 'olive', 'navy', 'cream', 'black', 'stone'],
    priceSignal: 'premium',
    occasions: ['casual', 'weekend', 'urban', 'everyday'],
  },

  // ── Additional Essential ───────────────────────────────────────────────────
  workwear: {
    description:
      'Corporate to smart-casual — the full spectrum. Suits, tailored separates, dress shirts. Dressing for authority without stiffness.',
    materials: ['wool', 'fine cotton', 'silk', 'cashmere blend', 'leather'],
    keywords: ['suit', 'blazer', 'dress shirt', 'tailored', 'polished', 'professional'],
    avoid: ['casual', 'athletic', 'distressed'],
    colorPalette: ['navy', 'charcoal', 'black', 'white', 'light blue', 'grey'],
    priceSignal: 'premium',
    occasions: ['office', 'meeting', 'presentation', 'client dinner'],
  },
  utility: {
    description:
      'Form follows function, fashion follows. Cargo pockets, D-ring belts, vest layers. Military surplus meets modern street.',
    materials: ['ripstop', 'canvas', 'nylon', 'cotton twill'],
    keywords: ['cargo', 'vest', 'utility pocket', 'belt', 'multi-pocket', 'functional'],
    avoid: ['delicate', 'formal', 'silk'],
    colorPalette: ['olive', 'khaki', 'black', 'tan', 'army green'],
    priceSignal: 'mid',
    occasions: ['casual', 'outdoor', 'weekend', 'urban'],
  },
  oversized: {
    description:
      'Deliberate volume — not too big by accident but too big on purpose. The proportions are the point.',
    materials: ['cotton fleece', 'heavy cotton', 'wool', 'knit'],
    keywords: ['oversized', 'boxy', 'drop shoulder', 'wide', 'relaxed', 'volume'],
    avoid: ['fitted', 'tight', 'structured'],
    colorPalette: ['neutral', 'black', 'grey', 'white', 'earth'],
    priceSignal: 'mid',
    occasions: ['casual', 'weekend', 'creative'],
  },
}

export function matchStyles(query: string): StyleEntry[] {
  const q = query.toLowerCase()
  const matched: StyleEntry[] = []

  for (const [name, entry] of Object.entries(styleVocabulary)) {
    const nameLower = name.toLowerCase()
    if (q.includes(nameLower)) {
      matched.push(entry)
      continue
    }
    const words = nameLower.split(' ')
    if (words.length > 1 && words.some((w) => q.includes(w) && w.length > 4)) {
      matched.push(entry)
      continue
    }
    if (entry.keywords.some((k) => q.includes(k.toLowerCase()))) {
      matched.push(entry)
    }
  }

  return matched.slice(0, 3)
}

export function expandQuery(query: string, matched: StyleEntry[]): string {
  if (matched.length === 0) return query
  const signals = matched.flatMap((e) => [...e.keywords.slice(0, 3), ...e.materials.slice(0, 2)])
  const unique = Array.from(new Set(signals)).slice(0, 8)
  return `${query} ${unique.join(' ')}`
}

export function vocabPromptBlock(matched: StyleEntry[]): string {
  if (matched.length === 0) return ''
  const blocks = matched.map(
    (e) =>
      `Style: ${e.description}\nMaterials to favor: ${e.materials.slice(0, 4).join(', ')}\nKeywords: ${e.keywords.slice(0, 5).join(', ')}\nAvoid: ${e.avoid.slice(0, 3).join(', ')}\nColors: ${e.colorPalette.slice(0, 4).join(', ')}`,
  )
  return `STYLE CONTEXT:\n${blocks.join('\n---\n')}\n`
}
