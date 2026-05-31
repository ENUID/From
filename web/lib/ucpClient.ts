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
  url: string
}

export async function searchUCP(params: SearchParams): Promise<UcpProduct[]> {
  console.log('Mock: Calling Shopify UCP with params:', params)
  
  // Fake mock results representing products found via UCP
  const results = [
    {
      id: 'ucp-1',
      title: `${params.query} - Premium`,
      vendor: 'Acme Store',
      price: params.budgetMax ? params.budgetMax * 0.9 : 120,
      currency: 'USD',
      url: `https://acme.store/products/mock-premium`
    },
    {
      id: 'ucp-2',
      title: `${params.query} - Standard`,
      vendor: 'Global Goods',
      price: params.budgetMax ? params.budgetMax * 0.5 : 80,
      currency: 'USD',
      url: `https://globalgoods.store/products/mock-standard`
    }
  ]

  // Add affiliate tracking IDs to the URLs
  return results.map(product => {
    const urlObj = new URL(product.url)
    urlObj.searchParams.set('ref', 'from_ai_affiliate')
    return {
      ...product,
      url: urlObj.toString()
    }
  })
}
