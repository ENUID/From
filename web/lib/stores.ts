export type StoreProfile = {
  domain: string;
  /** Human display name of the brand, used for brand-specific search detection. */
  name?: string;
  categories: string[];
  vibe: string[];
  languages?: string[];
  // ── NEW ──
  gender?: ('men' | 'women' | 'unisex')[];
  priceRange?: 'budget' | 'mid' | 'premium' | 'luxury';
  items?: string[];     // specific product types stocked
  about?: string;       // one-line brand identity for AI
};

export const UCP_REGISTRY: StoreProfile[] = [
  {
    "domain": "gymsharkusa.myshopify.com",
    "categories": [
      "top",
      "bottom",
      "outerwear",
      "footwear",
      "underwear"
    ],
    "vibe": [
      "workout",
      "sport",
      "active",
      "seamless"
    ],
    "gender": ["women", "men"],
    "priceRange": "mid",
    "items": ["leggings", "sports bra", "gym shorts", "training top", "hoodie", "jogger", "cycling shorts"],
    "about": "High-performance gym and training apparel — technical fabrics, athletic fits"
  },
  {
    "domain": "skimsbody.myshopify.com",
    "categories": [
      "top",
      "bottom",
      "dress",
      "outerwear",
      "footwear",
      "underwear",
      "accessory"
    ],
    "vibe": [
      "seamless",
      "bodycon",
      "minimalist",
      "luxury"
    ],
    "gender": ["women"],
    "priceRange": "premium",
    "items": ["shapewear", "bodysuit", "bodycon dress", "bralette", "underwear", "lounge set", "catsuit"],
    "about": "Sculpting shapewear and second-skin basics — smooth, bonded, inclusive sizing"
  },
  {
    "domain": "aloyoga.com",
    "categories": [
      "bottom",
      "outerwear",
      "underwear",
      "accessory"
    ],
    "vibe": [
      "active",
      "seamless",
      "luxury"
    ],
    "gender": ["women", "men"],
    "priceRange": "premium",
    "items": ["yoga legging", "sports bra", "hoodie", "jacket", "sweatpant", "shorts", "bodysuit"],
    "about": "Yoga-to-street premium activewear — studio-ready silhouettes with high-fashion edge"
  },
  {
    "domain": "kith.com",
    "categories": [
      "top",
      "bottom",
      "outerwear",
      "footwear",
      "accessory"
    ],
    "vibe": [
      "streetwear",
      "luxury",
      "casual"
    ],
    "gender": ["men", "women", "unisex"],
    "priceRange": "premium",
    "items": ["graphic tee", "hoodie", "crewneck sweatshirt", "cargo pant", "jacket", "sneaker", "co-ord set"],
    "about": "NYC streetwear institution — cultural collaborations, premium casual, elevated hype"
  },
  {
    "domain": "fashionnova.com",
    "categories": [
      "top",
      "bottom",
      "outerwear",
      "footwear",
      "underwear",
      "accessory"
    ],
    "vibe": [
      "bodycon",
      "casual",
      "denim"
    ],
    "gender": ["women", "men"],
    "priceRange": "budget",
    "items": ["mini dress", "bodycon dress", "crop top", "jeans", "two-piece set", "swimsuit", "jumpsuit"],
    "about": "Fast fashion for bold, body-conscious looks — curve-friendly fits, viral styles"
  },
  {
    "domain": "allbirds.com",
    "categories": [
      "footwear"
    ],
    "vibe": [
      "sustainable",
      "minimalist",
      "casual"
    ],
    "gender": ["men", "women", "unisex"],
    "priceRange": "mid",
    "items": ["wool runner sneaker", "trail shoe", "slip-on", "loafer", "boot"],
    "about": "Carbon-neutral footwear made from natural materials — merino wool, eucalyptus, sugarcane"
  },
  {
    "domain": "taylorstitch.com",
    "categories": [
      "top",
      "bottom",
      "outerwear",
      "accessory"
    ],
    "vibe": [
      "heritage-workwear",
      "organic",
      "minimalist",
      "outdoor"
    ],
    "gender": ["men"],
    "priceRange": "premium",
    "items": ["oxford shirt", "linen shirt", "flannel shirt", "chino", "selvedge denim", "overshirt", "chore coat", "work jacket", "sweatshirt"],
    "about": "San Francisco heritage menswear — natural fabrics, Made in USA quality, built-to-last pieces"
  },
  {
    "domain": "marinelayer.com",
    "categories": [
      "top",
      "bottom",
      "dress",
      "outerwear",
      "underwear",
      "accessory"
    ],
    "vibe": [
      "coastal",
      "casual",
      "organic"
    ],
    "gender": ["men", "women"],
    "priceRange": "mid",
    "items": ["linen shirt", "tee", "hoodie", "shorts", "straight-leg pant", "dress", "swimwear", "chino"],
    "about": "California coastal basics in ultra-soft micro modal and linen — effortless weekend dressing"
  },
  {
    "domain": "bombas.myshopify.com",
    "categories": [
      "top",
      "underwear"
    ],
    "vibe": [
      "active",
      "casual",
      "sustainable"
    ],
    "gender": ["men", "women", "unisex"],
    "priceRange": "mid",
    "items": ["socks", "underwear", "tee"],
    "about": "Premium comfort socks and underwear — buy-one-give-one charity model"
  },
  {
    "domain": "chubbies.myshopify.com",
    "categories": [
      "top",
      "bottom",
      "outerwear",
      "underwear"
    ],
    "vibe": [
      "casual",
      "resort",
      "coastal"
    ],
    "gender": ["men"],
    "priceRange": "mid",
    "items": ["swim trunks", "shorts", "polo", "tee", "chino", "hoodie"],
    "about": "Weekend menswear for short-inseam life — retro-inspired shorts, beach-ready casual"
  },
  {
    "domain": "goodamerican.com",
    "categories": [
      "top",
      "bottom",
      "dress",
      "outerwear",
      "accessory"
    ],
    "vibe": [
      "denim",
      "bodycon",
      "casual"
    ],
    "gender": ["women"],
    "priceRange": "premium",
    "items": ["jeans", "denim jacket", "bodycon dress", "legging", "crop top", "co-ord set"],
    "about": "Khloé Kardashian's inclusive denim brand — curves-first fit with premium stretch"
  },
  {
    "domain": "faherty.myshopify.com",
    "categories": [
      "top",
      "bottom",
      "dress",
      "outerwear",
      "accessory"
    ],
    "vibe": [
      "coastal",
      "organic",
      "resort",
      "heritage-workwear"
    ],
    "gender": ["men", "women"],
    "priceRange": "premium",
    "items": ["linen shirt", "beach pant", "hoodie", "board shorts", "swimwear", "camp shirt", "knitwear", "jacket"],
    "about": "Sustainable American coastal lifestyle — linen, organic cotton, surf-to-dinner versatility"
  },
  {
    "domain": "pangaia.com",
    "categories": [
      "top",
      "bottom",
      "dress",
      "outerwear"
    ],
    "vibe": [
      "sustainable",
      "organic",
      "casual",
      "minimalist"
    ],
    "gender": ["men", "women", "unisex"],
    "priceRange": "premium",
    "items": ["hoodie", "sweatpants", "tee", "co-ord set", "puffer jacket", "tracksuit"],
    "about": "Science-led sustainable fashion — seaweed fiber, recycled materials, tracksuit staples"
  },
  {
    "domain": "spanx-com.myshopify.com",
    "categories": [
      "top",
      "bottom",
      "dress",
      "outerwear"
    ],
    "vibe": [
      "seamless",
      "formal",
      "minimalist"
    ],
    "gender": ["women"],
    "priceRange": "premium",
    "items": ["shapewear", "legging", "bodysuit", "smoothing brief", "denim", "blazer", "dress"],
    "about": "The original shapewear brand expanded to full fashion — sculpting, smoothing, polished looks"
  },
  {
    "domain": "outdoorvoices.com",
    "categories": [
      "top",
      "bottom",
      "dress",
      "underwear"
    ],
    "vibe": [
      "active",
      "coastal",
      "casual"
    ],
    "gender": ["women", "men"],
    "priceRange": "mid",
    "items": ["legging", "shorts", "hoodie", "sports bra", "one-piece", "crop top", "jacket"],
    "about": "Activity-wear brand with playful tone — Doing Things, technical fabrics, not just gym"
  },
  {
    "domain": "toa.st",
    "categories": [
      "top",
      "bottom",
      "dress",
      "outerwear",
      "footwear",
      "underwear",
      "accessory"
    ],
    "vibe": [
      "artisan",
      "organic",
      "bohemian",
      "minimalist",
      "french"
    ],
    "gender": ["women"],
    "priceRange": "premium",
    "items": ["linen dress", "smock dress", "blouse", "trouser", "knitwear", "apron dress", "shirt dress"],
    "about": "British artisan fashion — handcrafted natural fabrics, Japanese and Indian textile influences"
  },
  {
    "domain": "backalleybodega.com",
    "categories": [
      "top",
      "bottom",
      "outerwear"
    ],
    "vibe": [
      "streetwear",
      "heritage-workwear",
      "outdoor"
    ],
    "gender": ["men", "unisex"],
    "priceRange": "mid",
    "items": ["graphic tee", "hoodie", "cargo pant", "jacket", "work shirt"],
    "about": "NYC streetwear with workwear influence — vintage-inspired graphics, outdoor-meets-urban"
  },
  {
    "domain": "dissh.com.au",
    "categories": [
      "top",
      "bottom",
      "dress",
      "outerwear"
    ],
    "vibe": [
      "casual",
      "resort",
      "bohemian"
    ],
    "gender": ["women"],
    "priceRange": "mid",
    "items": ["mini dress", "midi dress", "blouse", "wide-leg trouser", "co-ord set"],
    "about": "Australian women's fashion — feminine, holiday-ready pieces, easy-to-wear silhouettes"
  },
  {
    "domain": "porterjames.com",
    "categories": [
      "top",
      "bottom",
      "outerwear"
    ],
    "vibe": [
      "active",
      "workout",
      "sport"
    ]
  },
  {
    "domain": "caseycasey.eu",
    "categories": [
      "top",
      "bottom",
      "dress",
      "outerwear"
    ],
    "vibe": [
      "artisan",
      "bohemian",
      "french",
      "minimalist"
    ],
    "gender": ["men", "women", "unisex"],
    "priceRange": "luxury",
    "items": ["linen shirt", "wide trouser", "smock", "deconstructed coat", "handcrafted dress"],
    "about": "Marseille artisan fashion — handcrafted, irregular cuts, natural dyes, poetic silhouettes"
  },
  {
    "domain": "luroq.com",
    "categories": [
      "top",
      "bottom",
      "dress",
      "outerwear"
    ],
    "vibe": [
      "outdoor"
    ]
  },
  {
    "domain": "luso.com.pk",
    "categories": [
      "top",
      "bottom",
      "accessory"
    ],
    "vibe": [
      "streetwear",
      "organic",
      "luxury",
      "outdoor"
    ]
  },
  {
    "domain": "effelements.in",
    "categories": [
      "top"
    ],
    "vibe": [
      "active",
      "seamless",
      "outdoor"
    ]
  },
  {
    "domain": "favrics.com",
    "categories": [
      "top",
      "bottom",
      "outerwear",
      "footwear",
      "accessory"
    ],
    "vibe": [
      "organic",
      "denim"
    ]
  },
  {
    "domain": "fromherman.com",
    "categories": [
      "top",
      "bottom",
      "outerwear"
    ],
    "vibe": [
      "luxury",
      "streetwear"
    ]
  },
  {
    "domain": "loomforma.com",
    "categories": [
      "top",
      "outerwear"
    ],
    "vibe": []
  },
  {
    "domain": "pegador.com",
    "categories": [
      "top",
      "bottom",
      "outerwear"
    ],
    "vibe": [
      "streetwear",
      "casual",
      "outdoor"
    ],
    "gender": ["men", "unisex"],
    "priceRange": "mid",
    "items": ["graphic tee", "hoodie", "tracksuit", "cargo pant", "overshirt"],
    "about": "German streetwear brand — bold graphics, oversized silhouettes, urban culture"
  },
  {
    "domain": "commas.cc",
    "categories": [
      "top",
      "bottom",
      "outerwear"
    ],
    "vibe": [
      "casual",
      "cozy"
    ]
  },
  {
    "domain": "finaldraftclo.com",
    "categories": [
      "top",
      "bottom",
      "outerwear",
      "accessory"
    ],
    "vibe": []
  },
  {
    "domain": "wearneutralground.com",
    "categories": [
      "top",
      "bottom",
      "dress",
      "outerwear",
      "accessory"
    ],
    "vibe": [
      "active",
      "casual",
      "workout",
      "outdoor",
      "streetwear"
    ]
  },
  {
    "domain": "sweatscollective.com",
    "categories": [
      "top",
      "bottom",
      "outerwear",
      "accessory"
    ],
    "vibe": [
      "cozy",
      "streetwear",
      "minimalist",
      "luxury"
    ],
    "gender": ["men", "women", "unisex"],
    "priceRange": "premium",
    "items": ["hoodie", "crewneck sweatshirt", "sweatpant", "tee", "hat"],
    "about": "Premium fleece and sweatwear — elevated basics in heavyweight cotton"
  },
  {
    "domain": "gentag.store",
    "categories": [
      "top",
      "bottom",
      "dress",
      "outerwear"
    ],
    "vibe": []
  },
  {
    "domain": "antifragilecompany.in",
    "categories": [
      "apparel"
    ],
    "vibe": [
      "sport",
      "workout",
      "organic"
    ]
  },
  {
    "domain": "itsashirt.gr",
    "categories": [
      "top"
    ],
    "vibe": [
      "casual",
      "streetwear",
      "formal"
    ]
  },
  {
    "domain": "circolo1901.it",
    "categories": [
      "top",
      "outerwear"
    ],
    "vibe": [
      "sport",
      "formal",
      "casual",
      "minimalist"
    ],
    "gender": ["men"],
    "priceRange": "premium",
    "items": ["jersey blazer", "polo", "sweatshirt", "technical jacket", "trouser"],
    "about": "Italian jersey tailoring — softly structured blazers, sport-meets-formal elegance"
  },
  {
    "domain": "limited-clothing.co.uk",
    "categories": [
      "top",
      "bottom",
      "outerwear",
      "accessory"
    ],
    "vibe": []
  },
  {
    "domain": "laurenmanoogian.com",
    "categories": [
      "top",
      "bottom",
      "dress",
      "outerwear",
      "footwear"
    ],
    "vibe": [
      "artisan",
      "organic",
      "bohemian",
      "minimalist"
    ],
    "gender": ["women"],
    "priceRange": "luxury",
    "items": ["handknit sweater", "linen top", "organic dress", "woven cardigan", "co-ord set"],
    "about": "Hand-loomed knitwear and organic basics — slow fashion, artisan production in Peru"
  },
  {
    "domain": "borderlineofficial.com",
    "categories": [
      "bottom",
      "outerwear"
    ],
    "vibe": [
      "outdoor",
      "seamless",
      "active"
    ]
  },
  {
    "domain": "stosi.in",
    "categories": [
      "top",
      "bottom",
      "outerwear"
    ],
    "vibe": [
      "streetwear",
      "casual",
      "outdoor"
    ],
    "gender": ["men"],
    "priceRange": "mid",
    "items": ["tee", "cargo pant", "hoodie", "overshirt", "shorts"],
    "about": "Indian men's streetwear brand — urban casual, functional cuts"
  },
  {
    "domain": "studiopeterjohn.com",
    "categories": [
      "top",
      "bottom",
      "outerwear",
      "accessory"
    ],
    "vibe": [
      "casual",
      "formal",
      "cozy",
      "streetwear"
    ]
  },
  {
    "domain": "lacorsia.co",
    "categories": [
      "top",
      "bottom",
      "outerwear",
      "accessory"
    ],
    "vibe": [
      "sport"
    ]
  },
  {
    "domain": "commonleisureweb.com",
    "categories": [
      "top",
      "bottom",
      "dress"
    ],
    "vibe": [
      "casual",
      "active"
    ]
  },
  {
    "domain": "ladywhiteco.com",
    "categories": [
      "top",
      "bottom",
      "outerwear",
      "footwear",
      "underwear"
    ],
    "vibe": [
      "organic",
      "minimalist",
      "casual"
    ],
    "gender": ["men", "women"],
    "priceRange": "premium",
    "items": ["tee", "sweatshirt", "hoodie", "sweatpant", "sock"],
    "about": "LA premium basics brand — USA-made organic cotton, lived-in quality fits"
  },
  {
    "domain": "slvrlake.myshopify.com",
    "categories": [
      "top",
      "bottom",
      "outerwear",
      "accessory"
    ],
    "vibe": [
      "denim",
      "casual",
      "minimalist"
    ],
    "gender": ["women"],
    "priceRange": "premium",
    "items": ["jeans", "denim short", "straight leg jean", "wide-leg jean"],
    "about": "LA premium denim — clean cuts, high-rise silhouettes, quality stretch fabrics"
  },
  {
    "domain": "studionicholson.com",
    "categories": [
      "top",
      "bottom",
      "dress",
      "outerwear"
    ],
    "vibe": [
      "minimalist",
      "quiet-luxury",
      "formal"
    ],
    "gender": ["women", "men"],
    "priceRange": "luxury",
    "items": ["wide-leg trouser", "blazer", "shirt", "knitwear", "coat", "shift dress"],
    "about": "London minimalist brand — sculptural silhouettes, luxurious fabrics, architect-inspired restraint"
  },
  {
    "domain": "haruhar.com",
    "categories": [
      "top",
      "bottom",
      "dress",
      "outerwear"
    ],
    "vibe": [
      "seamless",
      "active"
    ]
  },
  {
    "domain": "coverchord.com",
    "categories": [
      "top",
      "bottom",
      "footwear",
      "accessory"
    ],
    "vibe": [
      "gorpcore",
      "japanese",
      "outdoor",
      "active"
    ],
    "languages": [
      "ja",
      "en"
    ],
    "gender": ["men", "women", "unisex"],
    "priceRange": "mid",
    "items": ["outdoor shirt", "technical trouser", "hiking boot", "cap", "anorak", "fleece"],
    "about": "Japanese outdoor-meets-street style — technical fabrics, Tokyo gorpcore aesthetic"
  },
  {
    "domain": "lionessfashion.com",
    "categories": [
      "top",
      "bottom",
      "outerwear"
    ],
    "vibe": [
      "casual",
      "formal"
    ]
  },
  {
    "domain": "and-daughter.com",
    "categories": [
      "top",
      "bottom",
      "outerwear"
    ],
    "vibe": [
      "casual",
      "active"
    ]
  },
  {
    "domain": "vahro.in",
    "categories": [
      "top",
      "bottom",
      "outerwear"
    ],
    "vibe": [
      "active",
      "casual"
    ]
  },
  {
    "domain": "desiminimals.com",
    "categories": [
      "top",
      "bottom",
      "outerwear"
    ],
    "vibe": [
      "casual",
      "formal",
      "denim"
    ]
  },
  {
    "domain": "lovepangolin.com",
    "categories": [
      "top",
      "bottom",
      "outerwear"
    ],
    "vibe": []
  },
  {
    "domain": "chapter2drip.com",
    "categories": [
      "top",
      "outerwear"
    ],
    "vibe": [
      "organic"
    ]
  },
  {
    "domain": "friendswithfrank.com",
    "categories": [
      "top",
      "bottom",
      "outerwear",
      "underwear",
      "accessory"
    ],
    "vibe": []
  },
  {
    "domain": "shop-crowd.com",
    "categories": [
      "top",
      "bottom",
      "outerwear"
    ],
    "vibe": [
      "active",
      "streetwear",
      "casual",
      "seamless",
      "cozy"
    ]
  },
  {
    "domain": "assemblylabel.com",
    "categories": [
      "top",
      "dress",
      "outerwear",
      "footwear",
      "underwear",
      "accessory"
    ],
    "vibe": [
      "organic",
      "casual",
      "minimalist",
      "coastal"
    ],
    "gender": ["women", "men"],
    "priceRange": "mid",
    "items": ["linen shirt", "midi dress", "knitwear", "trouser", "shorts", "tee"],
    "about": "Australian minimalist brand — linen-forward everyday basics, relaxed coastal aesthetic"
  },
  {
    "domain": "solacetheory.com",
    "categories": [
      "top",
      "bottom",
      "outerwear"
    ],
    "vibe": [
      "organic",
      "cozy",
      "active",
      "outdoor"
    ]
  },
  {
    "domain": "hemblanks.com",
    "categories": [
      "top",
      "outerwear"
    ],
    "vibe": [
      "organic",
      "active",
      "cozy"
    ]
  },
  {
    "domain": "yurofficial.com",
    "categories": [
      "top",
      "bottom",
      "outerwear",
      "accessory"
    ],
    "vibe": [
      "streetwear",
      "formal"
    ]
  },
  {
    "domain": "theruesociety.com",
    "categories": [
      "top",
      "bottom",
      "dress",
      "outerwear"
    ],
    "vibe": [
      "streetwear",
      "casual",
      "formal",
      "active",
      "organic"
    ]
  },
  {
    "domain": "malverra.com",
    "categories": [
      "top",
      "dress"
    ],
    "vibe": [
      "cozy",
      "outdoor",
      "active",
      "seamless"
    ]
  },
  {
    "domain": "myfriendjoni.com",
    "categories": [
      "bottom",
      "outerwear"
    ],
    "vibe": []
  },
  {
    "domain": "kartikresearch.com",
    "categories": [
      "apparel"
    ],
    "vibe": [
      "sport",
      "outdoor"
    ]
  },
  {
    "domain": "ceucle.com",
    "categories": [
      "top",
      "bottom",
      "outerwear",
      "accessory"
    ],
    "vibe": [
      "sport"
    ]
  },
  {
    "domain": "pariya.in",
    "categories": [
      "top",
      "bottom",
      "dress"
    ],
    "vibe": [
      "organic"
    ]
  },
  {
    "domain": "aimeleondore.com",
    "categories": [
      "top",
      "bottom",
      "outerwear",
      "footwear",
      "underwear",
      "accessory"
    ],
    "vibe": [
      "preppy",
      "streetwear",
      "old-money",
      "casual"
    ],
    "gender": ["men"],
    "priceRange": "premium",
    "items": ["oxford shirt", "knitwear", "sweatshirt", "trouser", "shorts", "polo", "outerwear", "tote bag"],
    "about": "New York brand mixing Ivy League prep with Queens streetwear — ALD redefines modern menswear"
  },
  {
    "domain": "hommeyusa.myshopify.com",
    "categories": [
      "top",
      "accessory"
    ],
    "vibe": [
      "organic",
      "cozy",
      "sport",
      "active"
    ]
  },
  {
    "domain": "primulaveri.com",
    "categories": [
      "top",
      "bottom",
      "outerwear"
    ],
    "vibe": [
      "organic"
    ]
  },
  {
    "domain": "elkacollective.com",
    "categories": [
      "top",
      "bottom",
      "outerwear",
      "accessory"
    ],
    "vibe": [
      "active",
      "denim",
      "seamless"
    ]
  },
  {
    "domain": "selectedhomme.in",
    "categories": [
      "top",
      "bottom"
    ],
    "vibe": [
      "organic",
      "sport",
      "active"
    ]
  },
  {
    "domain": "rarabarefoot.in",
    "categories": [
      "apparel"
    ],
    "vibe": [
      "outdoor",
      "active",
      "cozy"
    ]
  },
  {
    "domain": "maisonx.in",
    "categories": [
      "top",
      "dress"
    ],
    "vibe": [
      "seamless"
    ]
  },
  {
    "domain": "elvntee.in",
    "categories": [
      "top",
      "bottom",
      "outerwear"
    ],
    "vibe": [
      "active"
    ]
  },
  {
    "domain": "wearbrun.com",
    "categories": [
      "top",
      "bottom",
      "dress",
      "outerwear"
    ],
    "vibe": [
      "outdoor"
    ]
  },
  {
    "domain": "wearloqo.com",
    "categories": [
      "footwear"
    ],
    "vibe": [
      "cozy",
      "workout",
      "active"
    ]
  },
  {
    "domain": "theminimalcloset.in",
    "categories": [
      "top",
      "bottom",
      "outerwear",
      "accessory"
    ],
    "vibe": [
      "seamless",
      "active",
      "denim"
    ]
  },
  {
    "domain": "sleepscientist.in",
    "categories": [
      "top",
      "bottom",
      "outerwear"
    ],
    "vibe": [
      "cozy"
    ]
  },
  {
    "domain": "urbanmonkey.com",
    "categories": [
      "top",
      "bottom",
      "outerwear",
      "accessory"
    ],
    "vibe": [
      "streetwear",
      "casual"
    ],
    "gender": ["men", "women", "unisex"],
    "priceRange": "budget",
    "items": ["cap", "beanie", "bucket hat", "tee", "hoodie", "accessory"],
    "about": "Indian streetwear accessories — bold cap designs, skate/hip-hop culture"
  },
  {
    "domain": "wearcomet.com",
    "categories": [
      "apparel"
    ],
    "vibe": [
      "denim"
    ]
  },
  {
    "domain": "milkandwhisky.in",
    "categories": [
      "footwear",
      "underwear"
    ],
    "vibe": [
      "seamless",
      "organic",
      "sport"
    ]
  },
  {
    "domain": "pepeinner.com",
    "categories": [
      "top",
      "bottom",
      "outerwear",
      "underwear"
    ],
    "vibe": [
      "outdoor"
    ]
  },
  {
    "domain": "monkstory.com",
    "categories": [
      "footwear",
      "underwear"
    ],
    "vibe": [
      "formal",
      "streetwear"
    ]
  },
  {
    "domain": "stooky.in",
    "categories": [
      "top",
      "bottom",
      "outerwear"
    ],
    "vibe": [
      "cozy",
      "seamless"
    ]
  },
  {
    "domain": "senso.myshopify.com",
    "categories": [
      "top",
      "bottom",
      "underwear",
      "accessory"
    ],
    "vibe": [
      "luxury",
      "seamless"
    ]
  },
  {
    "domain": "tezzo.in",
    "categories": [
      "bottom",
      "footwear"
    ],
    "vibe": [
      "active",
      "seamless"
    ]
  },
  {
    "domain": "andreanthony.co.id",
    "categories": [
      "footwear",
      "underwear"
    ],
    "vibe": [
      "organic",
      "streetwear",
      "outdoor"
    ]
  },
  {
    "domain": "shopdozo.com",
    "categories": [
      "dress"
    ],
    "vibe": [
      "cozy",
      "active"
    ]
  },
  {
    "domain": "thekiots.com",
    "categories": [
      "apparel"
    ],
    "vibe": []
  },
  {
    "domain": "urbansocks.in",
    "categories": [
      "underwear"
    ],
    "vibe": [
      "organic",
      "luxury",
      "seamless",
      "casual",
      "sport"
    ]
  },
  {
    "domain": "hzyclo.com",
    "categories": [
      "top",
      "bottom",
      "outerwear"
    ],
    "vibe": [
      "organic",
      "cozy",
      "active"
    ]
  },
  {
    "domain": "lamastore.in",
    "categories": [
      "top"
    ],
    "vibe": [
      "organic"
    ]
  },
  {
    "domain": "xyxxcrew.com",
    "categories": [
      "top",
      "bottom",
      "outerwear",
      "underwear"
    ],
    "vibe": [
      "active",
      "organic"
    ]
  },
  {
    "domain": "biancajeswant.com",
    "categories": [
      "top",
      "bottom",
      "accessory"
    ],
    "vibe": []
  },
  {
    "domain": "saphed.com",
    "categories": [
      "top",
      "bottom",
      "dress",
      "outerwear"
    ],
    "vibe": [
      "streetwear",
      "casual"
    ]
  },
  {
    "domain": "theater.xyz",
    "categories": [
      "footwear",
      "accessory"
    ],
    "vibe": [
      "casual"
    ]
  },
  {
    "domain": "asos.myshopify.com",
    "categories": [
      "apparel"
    ],
    "vibe": [
      "seamless",
      "streetwear",
      "workout"
    ]
  },
  {
    "domain": "biasedblack.com",
    "categories": [
      "top",
      "bottom",
      "outerwear"
    ],
    "vibe": [
      "streetwear",
      "cozy",
      "active",
      "seamless",
      "outdoor"
    ]
  },
  {
    "domain": "thebearhouse.com",
    "categories": [
      "top",
      "bottom"
    ],
    "vibe": []
  },
  {
    "domain": "kairo.store",
    "categories": [
      "top",
      "outerwear"
    ],
    "vibe": [
      "active",
      "denim"
    ]
  },
  {
    "domain": "harlanholden.ph",
    "categories": [
      "top"
    ],
    "vibe": [
      "organic",
      "luxury",
      "seamless",
      "outdoor"
    ]
  },
  {
    "domain": "kaicollections.com",
    "categories": [
      "top",
      "bottom"
    ],
    "vibe": [
      "streetwear",
      "active"
    ]
  },
  {
    "domain": "musclemind.com",
    "categories": [
      "top",
      "bottom",
      "outerwear",
      "underwear"
    ],
    "vibe": [
      "active",
      "workout",
      "casual"
    ]
  },
  {
    "domain": "ballerathletik.com",
    "categories": [
      "top",
      "bottom",
      "underwear",
      "accessory"
    ],
    "vibe": [
      "sport"
    ]
  },
  {
    "domain": "jeffs.myshopify.com",
    "categories": [
      "apparel"
    ],
    "vibe": [
      "streetwear",
      "casual",
      "active",
      "cozy"
    ]
  },
  {
    "domain": "moderaegy.myshopify.com",
    "categories": [
      "top",
      "outerwear"
    ],
    "vibe": [
      "cozy",
      "denim",
      "organic",
      "outdoor"
    ]
  },
  {
    "domain": "ludic.life",
    "categories": [
      "top",
      "accessory"
    ],
    "vibe": [
      "active",
      "organic"
    ]
  },
  {
    "domain": "doodledept.com",
    "categories": [
      "top",
      "outerwear",
      "underwear",
      "accessory"
    ],
    "vibe": [
      "organic",
      "active"
    ]
  },
  {
    "domain": "thestylevault.ae",
    "categories": [
      "dress"
    ],
    "vibe": []
  },
  {
    "domain": "classymastour.fr",
    "categories": [
      "top",
      "outerwear",
      "underwear"
    ],
    "vibe": [
      "luxury"
    ]
  },
  {
    "domain": "theforbiddenfruit.in",
    "categories": [
      "top",
      "bottom",
      "outerwear"
    ],
    "vibe": []
  },
  {
    "domain": "koa.com.pk",
    "categories": [
      "top",
      "bottom",
      "dress",
      "accessory"
    ],
    "vibe": [
      "active",
      "organic",
      "sport",
      "outdoor"
    ]
  },
  {
    "domain": "botnia.in",
    "categories": [
      "top",
      "bottom",
      "dress"
    ],
    "vibe": [
      "outdoor",
      "active"
    ]
  },
  {
    "domain": "orr.store",
    "categories": [
      "top",
      "bottom",
      "outerwear"
    ],
    "vibe": [
      "organic",
      "casual"
    ]
  },
  {
    "domain": "oldlinenmill.com",
    "categories": [
      "top",
      "bottom",
      "dress",
      "accessory"
    ],
    "vibe": [
      "denim",
      "organic",
      "casual",
      "outdoor"
    ]
  },
  {
    "domain": "asslcollectionparis.com",
    "categories": [
      "top",
      "bottom",
      "outerwear",
      "underwear"
    ],
    "vibe": [
      "luxury",
      "streetwear",
      "cozy"
    ]
  },
  {
    "domain": "shopnirvanaa.com",
    "categories": [
      "top",
      "bottom",
      "outerwear"
    ],
    "vibe": []
  },
  {
    "domain": "bamboovogue.in",
    "categories": [
      "top"
    ],
    "vibe": [
      "workout",
      "seamless"
    ]
  },
  {
    "domain": "mugasa.co.in",
    "categories": [
      "top",
      "bottom",
      "dress"
    ],
    "vibe": [
      "active"
    ]
  },
  {
    "domain": "lunaco.in",
    "categories": [
      "top",
      "bottom",
      "outerwear"
    ],
    "vibe": [
      "outdoor"
    ]
  },
  {
    "domain": "daxuen.com",
    "categories": [
      "top",
      "bottom",
      "outerwear"
    ],
    "vibe": []
  },
  {
    "domain": "wtflex.in",
    "categories": [
      "top",
      "bottom"
    ],
    "vibe": [
      "denim",
      "workout",
      "active",
      "outdoor",
      "seamless"
    ]
  },
  {
    "domain": "surmaye.com",
    "categories": [
      "top",
      "dress"
    ],
    "vibe": [
      "luxury",
      "organic",
      "cozy"
    ]
  },
  {
    "domain": "thedeer.in",
    "categories": [
      "top"
    ],
    "vibe": [
      "active",
      "outdoor",
      "organic"
    ]
  },
  {
    "domain": "themusk.in",
    "categories": [
      "top",
      "dress"
    ],
    "vibe": [
      "sport",
      "cozy"
    ]
  },
  {
    "domain": "oziss.in",
    "categories": [
      "top",
      "bottom",
      "dress"
    ],
    "vibe": [
      "active",
      "seamless"
    ]
  },
  {
    "domain": "whipped.store",
    "categories": [
      "top"
    ],
    "vibe": [
      "organic",
      "cozy"
    ]
  },
  {
    "domain": "gangafashions.com",
    "categories": [
      "top"
    ],
    "vibe": [
      "casual",
      "streetwear",
      "active",
      "seamless",
      "formal"
    ]
  },
  {
    "domain": "dushaamai.com",
    "categories": [
      "top",
      "bottom",
      "outerwear"
    ],
    "vibe": [
      "seamless"
    ]
  },
  {
    "domain": "lininworld.com",
    "categories": [
      "top",
      "bottom",
      "dress",
      "outerwear"
    ],
    "vibe": [
      "organic"
    ]
  },
  {
    "domain": "themisnomer.com",
    "categories": [
      "bottom",
      "outerwear",
      "accessory"
    ],
    "vibe": [
      "formal",
      "active",
      "cozy"
    ]
  },
  {
    "domain": "vanshitaaz.in",
    "categories": [
      "top",
      "bottom",
      "dress"
    ],
    "vibe": [
      "cozy",
      "outdoor",
      "active"
    ]
  },
  {
    "domain": "sergebasics.com",
    "categories": [
      "top",
      "bottom"
    ],
    "vibe": [
      "casual",
      "streetwear",
      "active"
    ]
  },
  {
    "domain": "bayek.fr",
    "categories": [
      "top",
      "bottom",
      "outerwear"
    ],
    "vibe": [
      "streetwear"
    ]
  },
  {
    "domain": "coteleparis.com",
    "categories": [
      "bottom",
      "accessory"
    ],
    "vibe": [
      "outdoor",
      "active",
      "organic"
    ]
  },
  {
    "domain": "mariniclothing.com",
    "categories": [
      "top",
      "bottom",
      "outerwear",
      "accessory"
    ],
    "vibe": [
      "formal",
      "casual"
    ]
  },
  {
    "domain": "almostgods.com",
    "categories": [
      "top",
      "bottom",
      "outerwear"
    ],
    "vibe": [
      "streetwear"
    ]
  },
  {
    "domain": "11-11.in",
    "categories": [
      "top",
      "bottom",
      "dress"
    ],
    "vibe": []
  },
  {
    "domain": "shopunrush.com",
    "categories": [
      "top",
      "bottom",
      "dress"
    ],
    "vibe": [
      "cozy"
    ]
  },
  {
    "domain": "kissagoi.com",
    "categories": [
      "top",
      "bottom",
      "dress",
      "outerwear"
    ],
    "vibe": [
      "denim"
    ]
  },
  {
    "domain": "ikaibyraginiahuja.com",
    "categories": [
      "top",
      "bottom",
      "dress",
      "accessory"
    ],
    "vibe": []
  },
  {
    "domain": "sofiedhoore.be",
    "name": "Sofie D'Hoore",
    "categories": ["top", "bottom", "dress", "outerwear", "accessory"],
    "vibe": ["minimalist", "quiet-luxury", "artisan", "french"],
    "gender": ["women"],
    "priceRange": "luxury",
    "items": ["trouser", "blazer", "shirt", "coat", "shift dress", "knitwear"],
    "about": "Belgian minimalist designer — architectural silhouettes, luxurious natural fabrics"
  },
  {
    "domain": "bysera.zid.store",
    "name": "SERA",
    "categories": ["top", "bottom", "dress"],
    "vibe": ["luxury"]
  },
  {
    "domain": "aritzia.com",
    "name": "Aritzia",
    "categories": ["top", "bottom", "dress", "outerwear", "accessory"],
    "vibe": ["formal", "casual", "minimalist", "quiet-luxury"],
    "gender": ["women"],
    "priceRange": "premium",
    "items": ["blazer", "trouser", "bodysuit", "dress", "knitwear", "blouse", "coat"],
    "about": "Canadian premium women's brand — quality tailored basics, TikTok-beloved silhouettes"
  },
  {
    "domain": "slowsteadyclub.com",
    "name": "SlowSteadyClub",
    "categories": ["top", "bottom", "outerwear", "accessory"],
    "vibe": ["streetwear"]
  },
  {
    "domain": "bohemegoods.com",
    "name": "BOHEME",
    "categories": ["top", "bottom", "dress", "accessory"],
    "vibe": ["organic", "casual"]
  },
  {
    "domain": "turnblack.in",
    "name": "Turn Black",
    "categories": ["top", "bottom", "outerwear"],
    "vibe": ["streetwear"]
  },
  {
    "domain": "jucca.it",
    "name": "Jucca",
    "categories": ["top", "bottom", "dress", "outerwear"],
    "vibe": ["casual"]
  },
  {
    "domain": "camper.com",
    "name": "Camper",
    "categories": ["footwear", "accessory"],
    "vibe": ["casual", "artistic", "sustainable"],
    "gender": ["men", "women", "unisex"],
    "priceRange": "mid",
    "items": ["loafer", "boot", "sneaker", "sandal", "mule"],
    "about": "Spanish footwear brand — playful, artisan-adjacent shoe design with European craft tradition"
  },
  {
    "domain": "menspoem.in",
    "name": "Men's Poem",
    "categories": ["top", "bottom", "outerwear"],
    "vibe": ["formal", "casual"]
  },
  {
    "domain": "atpco.it",
    "name": "AT.P.CO",
    "categories": ["top", "bottom", "outerwear"],
    "vibe": ["casual", "formal"]
  },
  {
    "domain": "marksandspencer.in",
    "name": "Marks & Spencer",
    "categories": ["top", "bottom", "dress", "outerwear", "underwear", "accessory"],
    "vibe": ["casual", "formal"]
  },
  {
    "domain": "offonclothing.com",
    "name": "Offon",
    "categories": ["top", "bottom", "dress"],
    "vibe": ["casual"]
  },
  {
    "domain": "thatie.ru",
    "name": "Thatie",
    "categories": ["top", "dress"],
    "vibe": ["casual"]
  },
  {
    "domain": "pertestore.ru",
    "name": "Perte",
    "categories": ["top", "bottom", "outerwear"],
    "vibe": ["streetwear"]
  },
  {
    "domain": "sensclothing.com",
    "name": "Sens",
    "categories": ["top", "bottom", "outerwear"],
    "vibe": ["organic", "casual"]
  },
  {
    "domain": "herbyh.design",
    "name": "Her by H",
    "categories": ["top", "dress"],
    "vibe": ["cozy"]
  },
  {
    "domain": "ekke.co",
    "name": "Ekke",
    "categories": ["top", "bottom", "dress"],
    "vibe": ["casual"]
  },
  {
    "domain": "amoslook.com",
    "name": "Amos Look",
    "categories": ["top", "bottom", "outerwear"],
    "vibe": ["casual"]
  },
  {
    "domain": "studiodoe.cc",
    "name": "Studio Doe",
    "categories": ["top", "bottom", "dress"],
    "vibe": ["organic"]
  },
  {
    "domain": "noconcept.ru",
    "name": "No Concept",
    "categories": ["top", "bottom", "outerwear"],
    "vibe": ["streetwear"]
  },
  {
    "domain": "mimpikita.com.my",
    "name": "Kita&Co",
    "categories": ["top", "dress"],
    "vibe": ["luxury"]
  },
  {
    "domain": "jhoola.com.tr",
    "name": "Jhoola",
    "categories": ["top", "dress"],
    "vibe": ["organic"]
  },
  {
    "domain": "dirtymanners.com",
    "name": "Dirty Manners",
    "categories": ["top", "bottom", "outerwear"],
    "vibe": ["streetwear"]
  },
  {
    "domain": "towards.website",
    "name": "Toward(s)",
    "categories": ["top", "bottom", "outerwear"],
    "vibe": ["streetwear"]
  },
  {
    "domain": "blueowl.us",
    "name": "Blue Owl",
    "categories": ["top", "bottom", "outerwear"],
    "vibe": ["heritage-workwear", "denim", "old-money", "organic"],
    "gender": ["men"],
    "priceRange": "premium",
    "items": ["selvedge denim", "raw denim jacket", "chino", "oxford cloth button-down", "flannel"],
    "about": "Brooklyn denim specialist — premium selvedge, raw denim, quality heritage casualwear"
  },
  {
    "domain": "morrisonshop.com",
    "name": "Morrison",
    "categories": ["top", "bottom", "dress", "outerwear"],
    "vibe": ["casual", "coastal", "organic", "minimalist"],
    "gender": ["women"],
    "priceRange": "mid",
    "items": ["linen dress", "midi dress", "tee", "shirt", "knitwear", "trouser"],
    "about": "Australian women's brand — relaxed resort-influenced pieces, linen and natural textures"
  },
  {
    "domain": "payalkhandwala.com",
    "name": "Payal Khandwala",
    "categories": ["top", "bottom", "dress"],
    "vibe": ["luxury"]
  },
  {
    "domain": "dashanddot.com",
    "name": "Dast & Dot",
    "categories": ["top", "bottom", "dress"],
    "vibe": ["casual"]
  },
  {
    "domain": "azaadclo.com",
    "name": "Azaad",
    "categories": ["top", "bottom", "outerwear"],
    "vibe": ["streetwear"]
  },
  {
    "domain": "ourlegacy.com",
    "name": "Our Legacy",
    "categories": ["top", "bottom", "outerwear", "footwear", "accessory"],
    "vibe": ["streetwear", "luxury", "artistic", "minimalist"],
    "gender": ["men"],
    "priceRange": "premium",
    "items": ["shirt", "trouser", "jacket", "knitwear", "overcoat", "tee"],
    "about": "Stockholm avant-garde — unexpected fabrications, relaxed tailoring, intellectual edge"
  },
  {
    "domain": "harah.in",
    "name": "Harah",
    "categories": ["top", "dress"],
    "vibe": ["organic"]
  },
  {
    "domain": "houseofmasaba.com",
    "name": "House of Masaba",
    "categories": ["top", "bottom", "dress", "accessory"],
    "vibe": ["indian-ethnic", "maximalist", "luxury"],
    "gender": ["women"],
    "priceRange": "luxury",
    "items": ["kurta set", "saree", "co-ord set", "dress", "dupatta", "accessory"],
    "about": "Indian luxury designer — bold prints, modern ethnic fusion, Masaba Gupta's iconic aesthetic"
  }
];

// ── Brand directory ───────────────────────────────────────────────────────────
// Display name for every registry domain. New entries already carry an inline
// `name`; this map backfills the human-facing name for the rest. It powers
// brand-specific search ("show me shirts from Allbirds") and the "From {brand}"
// label, and is the single place to keep brand names in sync with the registry.
export const BRAND_NAMES: Record<string, string> = {
  "gymsharkusa.myshopify.com": "Gymshark",
  "skimsbody.myshopify.com": "SKIMS",
  "aloyoga.com": "Alo Yoga",
  "kith.com": "Kith",
  "fashionnova.com": "Fashion Nova",
  "allbirds.com": "Allbirds",
  "taylorstitch.com": "Taylor Stitch",
  "marinelayer.com": "Marine Layer",
  "bombas.myshopify.com": "Bombas",
  "chubbies.myshopify.com": "Chubbies",
  "goodamerican.com": "Good American",
  "faherty.myshopify.com": "Faherty Brand",
  "pangaia.com": "Pangaia",
  "spanx-com.myshopify.com": "Spanx",
  "outdoorvoices.com": "Outdoor Voices",
  "toa.st": "Toast",
  "backalleybodega.com": "Back Alley Bodega",
  "dissh.com.au": "DISSH",
  "porterjames.com": "Porter James",
  "caseycasey.eu": "Casey Casey",
  "luroq.com": "Luroq London",
  "luso.com.pk": "LUSO",
  "effelements.in": "Eff",
  "favrics.com": "FAVRICS",
  "fromherman.com": "Herman",
  "loomforma.com": "LoomForma",
  "pegador.com": "Pegador",
  "commas.cc": "Commas",
  "finaldraftclo.com": "Final Draft",
  "wearneutralground.com": "Neutral Ground",
  "sweatscollective.com": "SWEATS",
  "gentag.store": "gentag",
  "antifragilecompany.in": "AntiFragile",
  "itsashirt.gr": "It's A Shirt",
  "circolo1901.it": "Circolo 1901",
  "limited-clothing.co.uk": "Limited",
  "laurenmanoogian.com": "Lauren Manoogian",
  "borderlineofficial.com": "Borderline",
  "stosi.in": "Stosi",
  "studiopeterjohn.com": "Peter John",
  "lacorsia.co": "La Corsia",
  "commonleisureweb.com": "Common Leisure",
  "ladywhiteco.com": "Lady White",
  "slvrlake.myshopify.com": "SLVRLAKE",
  "studionicholson.com": "Studio Nicholson",
  "haruhar.com": "Haru Har",
  "coverchord.com": "Coverchord",
  "lionessfashion.com": "Lioness Fashion",
  "and-daughter.com": "&Daughter",
  "vahro.in": "Vahro",
  "desiminimals.com": "Desi Minimals",
  "lovepangolin.com": "Love Pangolin",
  "chapter2drip.com": "Chapter 2",
  "friendswithfrank.com": "Friends with Frank",
  "shop-crowd.com": "CROWD",
  "assemblylabel.com": "Assembly Label",
  "solacetheory.com": "Solace Theory",
  "hemblanks.com": "HemBlanks",
  "yurofficial.com": "YUR",
  "theruesociety.com": "The Rue Society",
  "malverra.com": "Malverra",
  "myfriendjoni.com": "myfriendjoni",
  "kartikresearch.com": "Kartik Research",
  "ceucle.com": "Ceucle",
  "pariya.in": "Pariya",
  "aimeleondore.com": "Aime Leon Dore",
  "hommeyusa.myshopify.com": "Hommey",
  "primulaveri.com": "Primulaveri",
  "elkacollective.com": "Elka Collective",
  "selectedhomme.in": "Selected India",
  "rarabarefoot.in": "Rara Bare Foot",
  "maisonx.in": "Maison X",
  "elvntee.in": "Elvn Tee",
  "wearbrun.com": "Brun",
  "wearloqo.com": "Loqo",
  "theminimalcloset.in": "The Minimal Closet",
  "sleepscientist.in": "Sleep Scientist",
  "urbanmonkey.com": "Urban Monkey",
  "wearcomet.com": "Comet",
  "milkandwhisky.in": "Milk&Whisky",
  "pepeinner.com": "Innerwear by Pepe",
  "monkstory.com": "Monk Story",
  "stooky.in": "Stooky",
  "senso.myshopify.com": "Senso",
  "tezzo.in": "Tezzo",
  "andreanthony.co.id": "Andre Anthony",
  "shopdozo.com": "Dozo",
  "thekiots.com": "Kiots",
  "urbansocks.in": "Urban Socks",
  "hzyclo.com": "Hzy",
  "lamastore.in": "Lama Store",
  "xyxxcrew.com": "XYXX Crew",
  "biancajeswant.com": "Bianca Jeswant",
  "saphed.com": "Saphed",
  "theater.xyz": "Theater",
  "asos.myshopify.com": "Asos",
  "biasedblack.com": "Biased Black",
  "thebearhouse.com": "The Bear House",
  "kairo.store": "Kairo Store",
  "harlanholden.ph": "Harlan Holden",
  "kaicollections.com": "Kai Collections",
  "musclemind.com": "Muscle Mind",
  "ballerathletik.com": "Baller Athletik",
  "jeffs.myshopify.com": "Jeff's",
  "moderaegy.myshopify.com": "Modera",
  "ludic.life": "Ludic",
  "doodledept.com": "Doodle Dept",
  "thestylevault.ae": "The Style Vault",
  "classymastour.fr": "Classy Mastour",
  "theforbiddenfruit.in": "The Forbidden Fruit",
  "koa.com.pk": "Koa",
  "botnia.in": "Botnia",
  "orr.store": "Orr",
  "oldlinenmill.com": "Old Linen Mill",
  "asslcollectionparis.com": "Assl Collection Paris",
  "shopnirvanaa.com": "Nirvanaa",
  "bamboovogue.in": "Bamboo Vogue",
  "mugasa.co.in": "Mugasa",
  "lunaco.in": "Lunaco",
  "daxuen.com": "Daxuen",
  "wtflex.in": "What The Flex",
  "surmaye.com": "Surmaye",
  "thedeer.in": "The Deer",
  "themusk.in": "The Musk India",
  "oziss.in": "Oziss",
  "whipped.store": "Whipped",
  "gangafashions.com": "Ganga",
  "dushaamai.com": "Dusha Amai",
  "lininworld.com": "Linin",
  "themisnomer.com": "The Misnomer",
  "vanshitaaz.in": "Vanshitaaz",
  "sergebasics.com": "Serge",
  "bayek.fr": "Bayek",
  "coteleparis.com": "Cotele Paris",
  "mariniclothing.com": "Marini",
  "almostgods.com": "Almost Gods",
  "11-11.in": "11.11",
  "shopunrush.com": "Unrush",
  "kissagoi.com": "Kissa Goi",
  "ikaibyraginiahuja.com": "Ikai",
  "sofiedhoore.be": "Sofie D'Hoore",
  "bysera.zid.store": "SERA",
  "aritzia.com": "Aritzia",
  "slowsteadyclub.com": "SlowSteadyClub",
  "bohemegoods.com": "BOHEME",
  "turnblack.in": "Turn Black",
  "jucca.it": "Jucca",
  "camper.com": "Camper",
  "menspoem.in": "Men's Poem",
  "atpco.it": "AT.P.CO",
  "marksandspencer.in": "Marks & Spencer",
  "offonclothing.com": "Offon",
  "thatie.ru": "Thatie",
  "pertestore.ru": "Perte",
  "sensclothing.com": "Sens",
  "herbyh.design": "Her by H",
  "ekke.co": "Ekke",
  "amoslook.com": "Amos Look",
  "studiodoe.cc": "Studio Doe",
  "noconcept.ru": "No Concept",
  "mimpikita.com.my": "Kita&Co",
  "jhoola.com.tr": "Jhoola",
  "dirtymanners.com": "Dirty Manners",
  "towards.website": "Toward(s)",
  "blueowl.us": "Blue Owl",
  "morrisonshop.com": "Morrison",
  "payalkhandwala.com": "Payal Khandwala",
  "dashanddot.com": "Dast & Dot",
  "azaadclo.com": "Azaad",
  "ourlegacy.com": "Our Legacy",
  "harah.in": "Harah",
  "houseofmasaba.com": "House of Masaba",
};

// Reduce a domain to a comparable brand token, e.g.
// "gymsharkusa.myshopify.com" -> "gymsharkusa", "wearbrun.com" -> "brun".
// Kept in sync with cleanBrandName() in GlobalCatalogService.
export function cleanBrandToken(domain: string): string {
  if (!domain) return "";
  let c = domain.toLowerCase().trim();
  c = c.replace(/^(https?:\/\/)?(www\.)?/, "").split("/")[0];
  if (c.includes(".myshopify.com")) {
    const parts = c.replace(/\.myshopify\.com$/, "").split(".");
    c = parts[parts.length - 1];
  } else {
    const parts = c.split(".");
    const tlds = new Set(["com", "co", "uk", "org", "net", "store", "in", "us", "ca", "au", "io", "website", "me", "ph", "ae", "fr", "eu", "gr", "it", "id", "xyz", "cc", "be", "pk", "tr", "my", "ru", "design", "life"]);
    const nonTlds = parts.filter(p => !tlds.has(p));
    c = nonTlds.length > 0 ? nonTlds[nonTlds.length - 1] : parts[0];
  }
  c = c.replace(/[\-_]/g, "");
  c = c.replace(/^(shop|weare|the|buy|get|official|studio|wear)/i, "");
  c = c.replace(/(shop|store|clothing|brand|official|studio|wear|collective|denim)$/i, "");
  return c;
}

/** Human-facing brand name for a store profile. */
export function brandDisplayName(p: StoreProfile): string {
  return p.name || BRAND_NAMES[p.domain] || cleanBrandToken(p.domain);
}

// ── Category taxonomy ───────────────────────────────────────────────────────────
// Brands are tagged with flat top-level categories (top, bottom, dress, …). This
// taxonomy expands each one into the subcategories and sub-sub item types it covers,
// so the AI understands the full structure of what each brand can sell and can map a
// user's request ("oxford shirt", "selvedge denim", "chelsea boots") to the right
// brands and a clean, specific searchQuery.
export const CATEGORY_TAXONOMY: Record<string, { label: string; subcategories: Record<string, string[]> }> = {
  top: {
    label: "Tops",
    subcategories: {
      "shirts": ["oxford shirt", "linen shirt", "flannel", "button-down", "overshirt", "camp collar shirt"],
      "t-shirts & tees": ["crew neck tee", "v-neck tee", "graphic tee", "pocket tee", "long-sleeve tee", "ringer tee"],
      "polos & henleys": ["polo", "henley", "rugby shirt"],
      "blouses & tops": ["blouse", "tank top", "camisole", "crop top", "bodysuit", "tube top"],
      "knitwear": ["sweater", "jumper", "turtleneck", "cardigan", "knit polo", "roll-neck", "mock-neck", "crew-neck knit", "chunky knit", "merino sweater", "cashmere cardigan"],
    },
  },
  bottom: {
    label: "Bottoms",
    subcategories: {
      "trousers & pants": ["chinos", "dress pants", "cargo pants", "wide-leg trousers", "pleated trousers", "tailored trouser", "linen trouser", "tweed trouser", "leather trouser", "culottes"],
      "jeans & denim": ["slim jeans", "straight jeans", "wide jeans", "selvedge denim", "baggy jeans"],
      "shorts": ["chino shorts", "denim shorts", "athletic shorts", "linen shorts"],
      "skirts": ["mini skirt", "midi skirt", "maxi skirt", "pleated skirt", "denim skirt"],
      "activewear bottoms": ["leggings", "joggers", "sweatpants", "track pants", "bike shorts"],
    },
  },
  dress: {
    label: "Dresses & One-Pieces",
    subcategories: {
      "dresses": ["mini dress", "midi dress", "maxi dress", "slip dress", "shirt dress", "wrap dress"],
      "jumpsuits & rompers": ["jumpsuit", "romper", "playsuit"],
      "ethnic & occasion": ["gown", "kurta", "saree", "lehenga", "co-ord set"],
    },
  },
  outerwear: {
    label: "Outerwear",
    subcategories: {
      "jackets": ["denim jacket", "bomber", "trucker jacket", "field jacket", "windbreaker", "harrington"],
      "coats": ["overcoat", "trench coat", "wool coat", "parka", "puffer", "raincoat"],
      "blazers & suiting": ["blazer", "sport coat", "suit", "waistcoat"],
      "suits & formal": ["two-piece suit", "three-piece suit", "tuxedo", "waistcoat", "suit jacket"],
      "sweatshirts": ["hoodie", "crewneck sweatshirt", "zip-up", "quarter-zip"],
      "vests": ["gilet", "puffer vest", "fleece vest"],
    },
  },
  footwear: {
    label: "Footwear",
    subcategories: {
      "sneakers": ["low-top", "high-top", "runners", "trainers", "court sneakers"],
      "boots": ["chelsea boots", "chukka", "work boots", "ankle boots", "combat boots"],
      "formal shoes": ["loafers", "derbies", "oxfords", "monk straps", "brogues"],
      "sandals & slides": ["sandals", "slides", "espadrilles", "mules"],
    },
  },
  underwear: {
    label: "Underwear, Loungewear & Socks",
    subcategories: {
      "underwear": ["boxers", "briefs", "trunks", "bralette", "panties"],
      "loungewear & sleepwear": ["pajamas", "robe", "loungewear set", "nightwear"],
      "shapewear": ["shapewear", "bodysuit", "smoothing brief"],
      "socks & hosiery": ["socks", "no-show socks", "tights", "stockings"],
    },
  },
  accessory: {
    label: "Accessories",
    subcategories: {
      "bags": ["tote", "backpack", "crossbody", "weekender", "wallet", "belt bag", "handbag", "clutch", "shoulder bag", "bucket bag", "mini bag", "duffle bag", "messenger bag"],
      "headwear": ["cap", "beanie", "bucket hat", "wide-brim hat"],
      "small accessories": ["belt", "scarf", "gloves", "sunglasses", "tie"],
      "jewelry": ["necklace", "bracelet", "ring", "earrings"],
    },
  },
  swimwear: {
    label: "Swimwear & Beach",
    subcategories: {
      "swimwear": ["bikini", "one-piece", "swimsuit", "swim trunks", "board shorts", "rash guard"],
      "beach cover-ups": ["sarong", "kaftan", "beach shirt", "cover-up dress"],
    },
  },
  jewellery: {
    label: "Jewellery & Fine Accessories",
    subcategories: {
      "fine jewellery": ["gold necklace", "pearl earrings", "diamond ring", "bracelet", "anklet"],
      "fashion jewellery": ["hoop earrings", "stud earrings", "chain necklace", "cuff bracelet", "ring set"],
      "watches": ["watch", "smartwatch"],
    },
  },
  apparel: {
    label: "General Apparel (full range)",
    subcategories: {
      "mixed": ["tops", "bottoms", "outerwear", "accessories"],
    },
  },
};

// ── Vibe glossary ───────────────────────────────────────────────────────────────
// Each brand carries one or more vibe tags. This explains what each tag signals so
// the AI can match a shopper's described mood/style/use-case to the right brands.
export const VIBE_GLOSSARY: Record<string, string> = {
  // Performance
  workout: "gym & training gear — performance fabrics, gym/training sets",
  sport: "athletic, sporty styling with a technical, performance edge",
  active: "activewear & athleisure built for movement",
  seamless: "smooth second-skin basics; sculpting, bonded, no-VPL construction",
  // Casual & Easy
  casual: "everyday relaxed wear that's easy to throw on and style",
  coastal: "Breton stripe, linen, nautical, beach and harbour vibes — Marine Layer energy",
  resort: "vacation-ready cover-ups, printed shirts, light fabrics — poolside to dinner",
  cozy: "soft, comfortable, loungey — knits, fleece, easy comfort",
  // Elevated & Refined
  minimalist: "clean, pared-back design — neutral palette, no logo, quality fabric over decoration",
  "quiet-luxury": "no-logo cashmere/silk/linen, elevated neutrals — Loro Piana energy",
  "old-money": "heritage classics, prep-adjacent, patina over trend — Brooks Brothers energy",
  preppy: "popped collar, chinos, loafers, collegiate Ivy League aesthetic",
  formal: "dressy and tailored — office, occasion and elevated wear",
  luxury: "premium, high-end, designer-grade fabrics and craftsmanship",
  // Street & Urban
  streetwear: "urban and hype-driven — oversized fits, bold graphics, statement pieces",
  denim: "jeans-led or denim-forward collections",
  // Heritage & Craft
  organic: "natural & sustainable fabrics, eco-conscious, quiet minimalist design",
  "heritage-workwear": "duck canvas, selvedge denim, chore coats — Carhartt/Taylor Stitch energy",
  artisan: "handcrafted, slow fashion, natural textiles — woven, knitted, printed by hand",
  sustainable: "certified eco, recycled materials, closed-loop production focus",
  // Aesthetic
  bohemian: "flowing linen, embroidered cotton, global influence — free-spirited and layered",
  "dark-academia": "tweed, herringbone, turtleneck, scholarly layering — library chic",
  maximalist: "pattern-mixing, bold colour, layered jewellery — more is more",
  artistic: "sculptural, avant-garde, gallery-worthy — Comme des Garçons energy",
  // Activity
  outdoor: "rugged and utility-driven — hiking, travel and nature-ready",
  gorpcore: "technical outdoor wear worn in the city — Gore-Tex, trail shoes, fleece",
  // Cultural
  japanese: "Japanese design sensibility — oversized, deconstructed, natural, precise",
  "indian-ethnic": "kurtas, block prints, dupattas, traditional Indian craft modernized",
  french: "Parisian ease, effortlessly chic, understated femininity",
  bodycon: "figure-hugging, curve-celebrating silhouettes — fitted dresses, contour knitwear",
};

/** Human-readable catalog language(s) for a store, from its `languages` field or TLD. */
export function storeLanguageLabel(store: StoreProfile): string {
  const LANG_NAMES: Record<string, string> = {
    en: "English", ja: "Japanese", it: "Italian", fr: "French",
    gr: "Greek", el: "Greek", ru: "Russian", tr: "Turkish",
    nl: "Dutch", de: "German", es: "Spanish", id: "Indonesian",
  };
  if (store.languages && store.languages.length > 0) {
    return store.languages.map(l => LANG_NAMES[l] || l).join("/");
  }
  const d = store.domain.toLowerCase();
  if (d.includes("coverchord")) return "Japanese/English";
  if (d.endsWith(".jp")) return "Japanese/English";
  if (d.endsWith(".gr")) return "Greek/English";
  if (d.endsWith(".it")) return "Italian/English";
  if (d.endsWith(".fr")) return "French/English";
  if (d.endsWith(".ru")) return "Russian/English";
  if (d.endsWith(".tr")) return "Turkish/English";
  if (d.endsWith(".be")) return "Dutch/French/English";
  if (d.endsWith(".co.id")) return "Indonesian/English";
  return "English";
}

/** One directory line per brand: name, domain, categories, vibes and catalog language. */
export function buildBrandDirectory(): string {
  return UCP_REGISTRY.map(store => {
    const name = brandDisplayName(store);
    const cats = store.categories.join(", ");
    const vibes = store.vibe.length > 0 ? store.vibe.join(", ") : "general";
    const lang = storeLanguageLabel(store);
    const genderPart = store.gender ? ` | ${store.gender.join(", ")}` : "";
    const pricePart = store.priceRange ? ` | price: ${store.priceRange}` : "";
    const itemsPart = store.items ? ` | items: ${store.items.join(", ")}` : "";
    const aboutPart = store.about ? ` | ${store.about}` : "";
    return `- ${name} — ${store.domain}${genderPart}${pricePart} | sells: [${cats}]${itemsPart} | style: [${vibes}] | language: ${lang}${aboutPart}`;
  }).join("\n");
}

/** Human-readable category taxonomy (categories → subcategories → item types). */
export function buildCategoryTaxonomy(): string {
  return Object.entries(CATEGORY_TAXONOMY).map(([key, val]) => {
    const subs = Object.entries(val.subcategories)
      .map(([sub, items]) => `    • ${sub}: ${items.join(", ")}`)
      .join("\n");
    return `${val.label} [${key}]\n${subs}`;
  }).join("\n");
}

/** Human-readable vibe glossary. */
export function buildVibeGlossary(): string {
  return Object.entries(VIBE_GLOSSARY).map(([k, v]) => `- ${k}: ${v}`).join("\n");
}

// Display names too generic to match on their own (real English words).
// These brands are still reachable via category search, just not by the bare word.
const GENERIC_BRAND_WORDS = new Set(["limited"]);

function normalizeForBrandMatch(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9& ]+/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Detect explicit brand mentions in a free-text query and return the matching
 * store domains (empty when the user didn't name a brand). Powers
 * brand-specific search like "linen shirt from Taylor Stitch" or "show me Allbirds".
 */
export function detectBrandsInQuery(query: string): string[] {
  if (!query) return [];
  const q = " " + normalizeForBrandMatch(query) + " ";
  const qDespaced = q.replace(/[ &]/g, "");
  const matched: string[] = [];

  for (const p of UCP_REGISTRY) {
    const display = normalizeForBrandMatch(brandDisplayName(p));
    const token = cleanBrandToken(p.domain);
    let hit = false;

    // 1) Whole display-name phrase (handles multi-word brands like "taylor stitch")
    if (display.length >= 3 && !GENERIC_BRAND_WORDS.has(display) && q.includes(" " + display + " ")) {
      hit = true;
    }
    // 2) Despaced display name ("aime leon dore" -> "aimeleondore")
    const displayDespaced = display.replace(/[ &]/g, "");
    if (!hit && displayDespaced.length >= 5 && !GENERIC_BRAND_WORDS.has(displayDespaced) && qDespaced.includes(displayDespaced)) {
      hit = true;
    }
    // 3) Domain-derived token (catches "gymshark" -> gymsharkusa, "brun" -> wearbrun)
    if (!hit && token.length >= 5 && !GENERIC_BRAND_WORDS.has(token) && qDespaced.includes(token)) {
      hit = true;
    }

    if (hit) matched.push(p.domain.toLowerCase().trim());
  }

  return Array.from(new Set(matched));
}
