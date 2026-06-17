/**
 * Curated v1 store list — ~40 best-quality stores from the full UCP registry.
 *
 * Selection criteria: complete brand profile, diverse aesthetics/price points,
 * known quality, good UCP response rate.
 *
 * Grows as FROM indexes more stores.
 */

export type CuratedStore = {
  domain: string
  name: string
  gender: string[]
  categories: string[]
  priceRange: 'budget' | 'mid' | 'premium' | 'luxury'
  vibe: string[]
  about: string
}

export const CURATED_STORES: CuratedStore[] = [
  // ── Premium Active ──────────────────────────────────────────────────────────
  {
    domain: 'aloyoga.com',
    name: 'Alo Yoga',
    gender: ['women', 'men'],
    categories: ['top', 'bottom', 'outerwear', 'accessory'],
    priceRange: 'premium',
    vibe: ['active', 'luxury', 'minimal'],
    about: 'Yoga-to-street premium activewear — studio silhouettes with high-fashion edge',
  },
  {
    domain: 'gymsharkusa.myshopify.com',
    name: 'Gymshark',
    gender: ['women', 'men'],
    categories: ['top', 'bottom', 'outerwear', 'underwear'],
    priceRange: 'mid',
    vibe: ['workout', 'sport', 'active'],
    about: 'High-performance gym and training apparel — technical fabrics, athletic fits',
  },
  {
    domain: 'outdoorvoices.com',
    name: 'Outdoor Voices',
    gender: ['women', 'men'],
    categories: ['top', 'bottom', 'outerwear', 'dress'],
    priceRange: 'mid',
    vibe: ['active', 'colorful', 'casual'],
    about: 'Activity-wear with a playful tone — Doing Things, technical fabrics',
  },

  // ── Heritage / Coastal ──────────────────────────────────────────────────────
  {
    domain: 'taylorstitch.com',
    name: 'Taylor Stitch',
    gender: ['men'],
    categories: ['top', 'bottom', 'outerwear', 'footwear'],
    priceRange: 'premium',
    vibe: ['heritage', 'workwear', 'sustainable'],
    about: 'San Francisco heritage menswear — natural fabrics, crafted to last',
  },
  {
    domain: 'marinelayer.com',
    name: 'Marine Layer',
    gender: ['men', 'women'],
    categories: ['top', 'bottom', 'outerwear', 'dress'],
    priceRange: 'mid',
    vibe: ['coastal', 'minimal', 'soft'],
    about: 'California coastal basics in ultra-soft micro modal and linen',
  },
  {
    domain: 'faherty.myshopify.com',
    name: 'Faherty',
    gender: ['men', 'women'],
    categories: ['top', 'bottom', 'outerwear', 'dress', 'footwear'],
    priceRange: 'premium',
    vibe: ['coastal', 'heritage', 'sustainable'],
    about: 'Sustainable American coastal lifestyle — linen, organic cotton, family-run',
  },

  // ── Streetwear / Urban ──────────────────────────────────────────────────────
  {
    domain: 'kith.com',
    name: 'Kith',
    gender: ['men', 'women', 'unisex'],
    categories: ['top', 'bottom', 'outerwear', 'footwear', 'accessory'],
    priceRange: 'premium',
    vibe: ['streetwear', 'luxury', 'collaboration'],
    about: 'NYC streetwear institution — cultural collaborations, premium sport-casual',
  },
  {
    domain: 'pegador.com',
    name: 'Pegador',
    gender: ['men', 'unisex'],
    categories: ['top', 'bottom', 'outerwear'],
    priceRange: 'mid',
    vibe: ['streetwear', 'oversized', 'graphic'],
    about: 'German streetwear — bold graphics, oversized silhouettes, urban edge',
  },
  {
    domain: 'backalleybodega.com',
    name: 'Back Alley Bodega',
    gender: ['men', 'unisex'],
    categories: ['top', 'bottom', 'outerwear', 'accessory'],
    priceRange: 'mid',
    vibe: ['streetwear', 'workwear', 'vintage'],
    about: 'NYC streetwear with workwear influence — vintage-inspired graphics',
  },
  {
    domain: 'aimeleondore.com',
    name: 'Aimé Leon Dore',
    gender: ['men'],
    categories: ['top', 'bottom', 'outerwear', 'footwear', 'accessory'],
    priceRange: 'premium',
    vibe: ['streetwear', 'prep', 'NYC'],
    about: 'New York brand — Ivy League prep meets Queens streetwear, world-class quality',
  },

  // ── Minimalist / Clean ──────────────────────────────────────────────────────
  {
    domain: 'everlane.com',
    name: 'Everlane',
    gender: ['men', 'women'],
    categories: ['top', 'bottom', 'outerwear', 'dress', 'footwear'],
    priceRange: 'mid',
    vibe: ['minimal', 'ethical', 'basics'],
    about: 'Radical price transparency — ethical factories, sustainable essentials',
  },
  {
    domain: 'studionicholson.com',
    name: 'Studio Nicholson',
    gender: ['women', 'men'],
    categories: ['top', 'bottom', 'outerwear', 'dress'],
    priceRange: 'luxury',
    vibe: ['minimalist', 'sculptural', 'luxury'],
    about: 'London minimalist brand — sculptural silhouettes, luxurious fabrics',
  },
  {
    domain: 'ourlegacy.com',
    name: 'Our Legacy',
    gender: ['men'],
    categories: ['top', 'bottom', 'outerwear', 'footwear'],
    priceRange: 'premium',
    vibe: ['avant-garde', 'minimal', 'Stockholm'],
    about: 'Stockholm avant-garde — unexpected fabrications, relaxed tailoring',
  },
  {
    domain: 'assemblylabel.com',
    name: 'Assembly Label',
    gender: ['women', 'men'],
    categories: ['top', 'bottom', 'outerwear', 'dress', 'accessory'],
    priceRange: 'mid',
    vibe: ['minimalist', 'linen', 'basics'],
    about: 'Australian minimalist brand — linen-forward everyday basics',
  },
  {
    domain: 'ladywhiteco.com',
    name: 'Lady White Co.',
    gender: ['men', 'women'],
    categories: ['top', 'bottom', 'outerwear'],
    priceRange: 'premium',
    vibe: ['basics', 'minimal', 'USA-made'],
    about: 'LA premium basics — USA-made organic cotton, lived-in quality',
  },

  // ── Women's Focus ───────────────────────────────────────────────────────────
  {
    domain: 'skimsbody.myshopify.com',
    name: 'SKIMS',
    gender: ['women'],
    categories: ['top', 'bottom', 'dress', 'underwear', 'accessory'],
    priceRange: 'premium',
    vibe: ['bodycon', 'minimalist', 'inclusive'],
    about: 'Sculpting shapewear and second-skin basics — smooth, bonded, inclusive',
  },
  {
    domain: 'goodamerican.com',
    name: 'Good American',
    gender: ['women'],
    categories: ['bottom', 'top', 'dress', 'outerwear'],
    priceRange: 'premium',
    vibe: ['denim', 'curves', 'inclusive'],
    about: "Inclusive denim brand — curves-first fit, all sizes same day",
  },
  {
    domain: 'aritzia.com',
    name: 'Aritzia',
    gender: ['women'],
    categories: ['top', 'bottom', 'outerwear', 'dress', 'accessory'],
    priceRange: 'premium',
    vibe: ['contemporary', 'minimal', 'tailored'],
    about: "Canadian premium women's brand — quality tailored basics",
  },
  {
    domain: 'slvrlake.myshopify.com',
    name: 'SLVRLAKE',
    gender: ['women'],
    categories: ['bottom', 'top', 'dress'],
    priceRange: 'premium',
    vibe: ['denim', 'LA', 'minimal'],
    about: 'LA premium denim — clean cuts, high-rise silhouettes, quality selvedge',
  },
  {
    domain: 'dissh.com.au',
    name: 'Dissh',
    gender: ['women'],
    categories: ['top', 'bottom', 'dress', 'outerwear', 'accessory'],
    priceRange: 'mid',
    vibe: ['feminine', 'resort', 'linen'],
    about: "Australian women's fashion — feminine, holiday-ready linen pieces",
  },
  {
    domain: 'spanx-com.myshopify.com',
    name: 'Spanx',
    gender: ['women'],
    categories: ['bottom', 'top', 'dress', 'underwear'],
    priceRange: 'premium',
    vibe: ['shapewear', 'sculpting', 'comfort'],
    about: 'Original shapewear expanded to full fashion — sculpting and flattering',
  },
  {
    domain: 'toa.st',
    name: 'Toast',
    gender: ['women'],
    categories: ['top', 'bottom', 'dress', 'outerwear', 'accessory'],
    priceRange: 'premium',
    vibe: ['artisan', 'natural', 'British'],
    about: 'British artisan fashion — handcrafted natural fabrics, Japanese inspiration',
  },
  {
    domain: 'morrisonshop.com',
    name: 'Morrison',
    gender: ['women'],
    categories: ['top', 'bottom', 'dress', 'outerwear'],
    priceRange: 'mid',
    vibe: ['resort', 'relaxed', 'Australian'],
    about: "Australian women's brand — relaxed resort-influenced pieces",
  },

  // ── Artisan / Luxury ────────────────────────────────────────────────────────
  {
    domain: 'caseycasey.eu',
    name: 'Casey Casey',
    gender: ['men', 'women', 'unisex'],
    categories: ['top', 'bottom', 'outerwear', 'dress', 'accessory'],
    priceRange: 'luxury',
    vibe: ['artisan', 'natural', 'Marseille'],
    about: 'Marseille artisan fashion — handcrafted, irregular cuts, natural dyeing',
  },
  {
    domain: 'sofiedhoore.be',
    name: 'Sofie D\'Hoore',
    gender: ['women'],
    categories: ['top', 'bottom', 'outerwear', 'dress'],
    priceRange: 'luxury',
    vibe: ['minimalist', 'architectural', 'Belgian'],
    about: 'Belgian minimalist designer — architectural silhouettes, luxurious drape',
  },
  {
    domain: 'laurenmanoogian.com',
    name: 'Lauren Manoogian',
    gender: ['women'],
    categories: ['top', 'bottom', 'outerwear', 'accessory'],
    priceRange: 'luxury',
    vibe: ['hand-loomed', 'organic', 'slow fashion'],
    about: 'Hand-loomed knitwear and organic basics — slow fashion, artisan techniques',
  },

  // ── Sustainable / Conscious ─────────────────────────────────────────────────
  {
    domain: 'pangaia.com',
    name: 'Pangaia',
    gender: ['men', 'women', 'unisex'],
    categories: ['top', 'bottom', 'outerwear', 'accessory'],
    priceRange: 'premium',
    vibe: ['sustainable', 'science-led', 'colorful'],
    about: 'Science-led sustainable fashion — seaweed fiber, recycled materials',
  },
  {
    domain: 'allbirds.com',
    name: 'Allbirds',
    gender: ['men', 'women', 'unisex'],
    categories: ['footwear'],
    priceRange: 'mid',
    vibe: ['sustainable', 'minimal', 'comfortable'],
    about: 'Carbon-neutral footwear from natural materials — merino wool, eucalyptus',
  },
  {
    domain: 'rothys.com',
    name: "Rothy's",
    gender: ['women', 'unisex'],
    categories: ['footwear', 'accessory'],
    priceRange: 'mid',
    vibe: ['sustainable', 'comfortable', 'minimal'],
    about: 'Sustainable flats and bags from recycled plastic bottles',
  },

  // ── Footwear ────────────────────────────────────────────────────────────────
  {
    domain: 'thursdayboots.com',
    name: 'Thursday Boots',
    gender: ['men', 'women'],
    categories: ['footwear'],
    priceRange: 'mid',
    vibe: ['heritage', 'leather', 'DTC'],
    about: 'Direct-to-consumer leather boots — premium craftsmanship at fair price',
  },
  {
    domain: 'camper.com',
    name: 'Camper',
    gender: ['men', 'women', 'unisex'],
    categories: ['footwear'],
    priceRange: 'mid',
    vibe: ['artisan', 'playful', 'Spanish'],
    about: 'Spanish footwear brand — playful, artisan-adjacent shoe design',
  },
  {
    domain: 'blueowl.us',
    name: 'Blue Owl Workshop',
    gender: ['men'],
    categories: ['bottom', 'top', 'accessory'],
    priceRange: 'premium',
    vibe: ['denim', 'selvedge', 'heritage'],
    about: 'Brooklyn denim specialist — premium selvedge, raw denim, quality basics',
  },

  // ── Japanese / Technical ────────────────────────────────────────────────────
  {
    domain: 'coverchord.com',
    name: 'Coverchord',
    gender: ['men', 'women', 'unisex'],
    categories: ['top', 'bottom', 'outerwear', 'accessory'],
    priceRange: 'mid',
    vibe: ['Japanese', 'technical', 'outdoor-street'],
    about: 'Japanese outdoor-meets-street style — technical fabrics, Tokyo aesthetic',
  },

  // ── Smart Casual / Office ───────────────────────────────────────────────────
  {
    domain: 'untuckit.com',
    name: 'UNTUCKit',
    gender: ['men', 'women'],
    categories: ['top', 'bottom', 'outerwear', 'dress'],
    priceRange: 'mid',
    vibe: ['smart-casual', 'shirts', 'practical'],
    about: 'Shirts engineered to be worn untucked — precisely hemmed, wrinkle-free',
  },
  {
    domain: 'perryellis.com',
    name: 'Perry Ellis',
    gender: ['men', 'women'],
    categories: ['top', 'bottom', 'outerwear', 'dress', 'accessory'],
    priceRange: 'mid',
    vibe: ['classic', 'American', 'tailored'],
    about: 'American heritage brand — classic polos, tailored suits, smart-casual',
  },

  // ── Knit / Sweat ────────────────────────────────────────────────────────────
  {
    domain: 'sweatscollective.com',
    name: 'Sweats Collective',
    gender: ['men', 'women', 'unisex'],
    categories: ['top', 'bottom', 'outerwear'],
    priceRange: 'premium',
    vibe: ['fleece', 'premium basics', 'elevated'],
    about: 'Premium fleece and sweatwear — elevated basics in heavyweight fabric',
  },

  // ── Jewelry / Accessories ───────────────────────────────────────────────────
  {
    domain: 'mejuri.com',
    name: 'Mejuri',
    gender: ['women', 'unisex'],
    categories: ['accessory'],
    priceRange: 'premium',
    vibe: ['minimal', 'gold', 'DTC'],
    about: 'Fine jewellery direct-to-consumer — minimalist gold and diamonds',
  },

  // ── Surf / Outdoor ──────────────────────────────────────────────────────────
  {
    domain: 'ripcurl.com',
    name: 'Rip Curl',
    gender: ['men', 'women'],
    categories: ['top', 'bottom', 'outerwear', 'accessory', 'footwear'],
    priceRange: 'mid',
    vibe: ['surf', 'outdoor', 'beach'],
    about: 'Australian surf brand — technical surfwear and beach lifestyle',
  },
]

// Domain set for fast lookup
export const CURATED_DOMAINS = new Set(CURATED_STORES.map(s => s.domain))
