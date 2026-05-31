export type SearchParams = {
  query: string
  budgetMax?: number
}

export type UcpProduct = {
  id: string
  title: string
  vendor: string
  price: number
  currency: string
  store_url: string
  image_url: string
  in_stock: boolean
  tags: string[]
}

export async function searchUCP(params: SearchParams): Promise<UcpProduct[]> {
  console.log('Mock: Calling Shopify UCP with params:', params)
  
  // Fake mock results representing products found via UCP
  const results = [
    {
      id: 'ucp-1',
      title: `${params.query} - Premium Edition`,
      vendor: 'Acme Store',
      price: params.budgetMax ? params.budgetMax * 0.9 : 120,
      currency: 'USD',
      store_url: `https://acme.store/products/mock-premium`,
      image_url: 'https://images.unsplash.com/photo-1627384113743-6bd5a479fffd?auto=format&fit=crop&w=600&q=80',
      in_stock: true,
      tags: ['Handmade', 'Premium']
    },
    {
      id: 'ucp-2',
      title: `${params.query} - Essential`,
      vendor: 'Global Goods',
      price: params.budgetMax ? params.budgetMax * 0.5 : 80,
      currency: 'USD',
      store_url: `https://globalgoods.store/products/mock-standard`,
      image_url: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=600&q=80',
      in_stock: true,
      tags: ['Essential', 'Minimalist']
    }
  ]

  // Add affiliate tracking IDs to the URLs
  return results.map(product => {
    const urlObj = new URL(product.store_url)
    urlObj.searchParams.set('ref', 'from_ai_affiliate')
    return {
      ...product,
      store_url: urlObj.toString()
    }
  })
}
