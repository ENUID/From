export type DiscoverProduct = {
  id: string
  title: string
  vendor: string
  price_min: number
  price_max: number
  currency: string
  store_url: string
  image_url: string
  images: string[]
  in_stock: boolean
  tags: string[]
  description: string
  gender: string[]
  options: Array<{ name: string; values: string[] }>
  variants: Array<{
    id: string
    title: string
    price: number
    availability: boolean
    options: Array<{ name: string; label: string }>
  }>
  store_domain: string
  store_about: string
  hybrid_score?: number
}

export type Aesthetic = {
  key: string
  label: string
  emoji: string
}

export const AESTHETICS: Aesthetic[] = [
  { key: '',             label: 'For You',       emoji: '✦'  },
  { key: 'quiet-luxury', label: 'Quiet Luxury',  emoji: '🕊' },
  { key: 'minimalist',   label: 'Minimalist',    emoji: '◻' },
  { key: 'old-money',    label: 'Old Money',     emoji: '⚜' },
  { key: 'streetwear',   label: 'Streetwear',    emoji: '🔥' },
  { key: 'heritage',     label: 'Heritage',      emoji: '🧵' },
  { key: 'coastal',      label: 'Coastal',       emoji: '🌊' },
  { key: 'gorpcore',     label: 'Gorpcore',      emoji: '🏔' },
  { key: 'athleisure',   label: 'Athleisure',    emoji: '⚡' },
  { key: 'dark-academia',label: 'Dark Academia', emoji: '📚' },
  { key: 'bohemian',     label: 'Bohemian',      emoji: '🌿' },
  { key: 'cottagecore',  label: 'Cottagecore',   emoji: '🌸' },
  { key: 'clean-girl',   label: 'Clean Girl',    emoji: '✨' },
  { key: 'ballet-core',  label: 'Ballet Core',   emoji: '🩰' },
  { key: 'y2k',          label: 'Y2K',           emoji: '💿' },
  { key: 'maximalist',   label: 'Maximalist',    emoji: '🎨' },
]

export type Gender = 'all' | 'women' | 'men'
