export type StoreProfile = {
  domain: string;
  categories: string[];
  vibe: string[];
};

export const UCP_REGISTRY: StoreProfile[] = [
  { 
    domain: 'heathceramics.com', 
    categories: ['ceramics', 'bowls', 'plates', 'mugs', 'vases', 'tableware'], 
    vibe: ['minimalist', 'handcrafted', 'modern'] 
  },
  { 
    domain: 'artfulhome.com', 
    categories: ['decor', 'art', 'glass', 'sculpture', 'ceramics'], 
    vibe: ['artisan', 'unique', 'handcrafted'] 
  },
  { 
    domain: 'notaryceramics.com', 
    categories: ['ceramics', 'soap', 'kitchenware', 'decor', 'vases'], 
    vibe: ['minimalist', 'earthy', 'rustic'] 
  },
  { 
    domain: 'theminimalistceramist.com', 
    categories: ['ceramics', 'decor', 'minimalist'], 
    vibe: ['minimalist', 'modern'] 
  },
  { 
    domain: 'allbirds.com', 
    categories: ['shoes', 'sneakers', 'apparel', 'socks'], 
    vibe: ['sustainable', 'comfortable', 'minimalist'] 
  },
  {
    domain: 'colourpop.com',
    categories: ['makeup', 'cosmetics', 'beauty', 'skincare'],
    vibe: ['vibrant', 'trendy']
  },
  {
    domain: 'gymshark.com',
    categories: ['gymwear', 'activewear', 'fitness', 'apparel', 'shorts', 'leggings'],
    vibe: ['athletic', 'performance']
  }
];
