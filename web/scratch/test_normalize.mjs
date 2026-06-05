const p = {
  "id": "gid://shopify/Product/8404288012468",
  "title": "Alosoft Crop Finesse Short Sleeve - Navy",
  "description": {
    "plain": "A perfect throw-on-and-go piece. The Alosoft Crop Finesse Short Sleeve is made with our signature brushed Alosoft fabric, featuring a relaxed crop silhouette, side slits, and a classic crew neck."
  },
  "options": [
    {
      "name": "Size",
      "values": [
        {
          "label": "xxs"
        }
      ]
    }
  ],
  "metadata": {},
  "media": [
    {
      "type": "image",
      "url": "https://cdn.shopify.com/s/files/1/2185/2813/files/W1406R_03842_b2_s1_a1_dSP26_m262.jpg",
      "alt_text": "Alosoft Crop Finesse Short Sleeve - Navy"
    }
  ],
  "variants": [
    {
      "id": "gid://shopify/ProductVariant/42702758117556",
      "title": "Alosoft Crop Finesse Short Sleeve - Navy / xxs",
      "description": {
        "plain": "A perfect throw-on-and-go piece."
      },
      "url": "https://www.aloyoga.com/products/w1406r-alosoft-crop-finesse-short-sleeve-navy?variant=42702758117556",
      "price": {
        "amount": 5800,
        "currency": "USD"
      },
      "availability": {
        "available": true
      },
      "options": [
        {
          "name": "Size",
          "label": "xxs"
        }
      ],
      "media": [
        {
          "type": "image",
          "url": "https://cdn.shopify.com/s/files/1/2185/2813/files/W1406R_03842_b2_s1_a1_dSP26_m262.jpg",
          "alt_text": "Alosoft Crop Finesse Short Sleeve - Navy"
        }
      ],
      "seller": {
        "id": "gid://shopify/Shop/21852813",
        "name": "Alo Yoga",
        "url": "https://www.aloyoga.com",
        "domain": "alo-yoga.myshopify.com"
      }
    }
  ]
};

function normalizeImageUrl(url) {
  if (!url) return '';
  let normalized = url.startsWith('//') ? `https:${url}` : url;
  if (normalized.includes('cdn.shopify.com')) {
    try {
      const urlObj = new URL(normalized);
      urlObj.searchParams.set('width', '400');
      normalized = urlObj.toString();
    } catch {}
  }
  return normalized;
}

const variant = p.variants?.[0] || {};
const image_url = normalizeImageUrl(p.media?.[0]?.url || variant.media?.[0]?.url || '');
console.log("p.media?.[0]?.url:", p.media?.[0]?.url);
console.log("variant.media?.[0]?.url:", variant.media?.[0]?.url);
console.log("image_url:", image_url);
console.log("image_url length:", image_url.length);
console.log("!image_url:", !image_url);
