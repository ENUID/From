import { UcpProduct } from './CatalogService';
import { SearchToolArgs } from '../ai/schema';

// Helper to pluralize/singularize basic english words
function getWordVariants(word: string): string[] {
  const w = word.toLowerCase();
  const variants = [w];
  if (w.endsWith('s')) variants.push(w.slice(0, -1));
  else variants.push(w + 's');
  
  if (w.endsWith('es')) variants.push(w.slice(0, -2));
  else if (w.endsWith('y')) variants.push(w.slice(0, -1) + 'ies');
  
  return variants;
}

export class RelevanceService {
  static filterAndRank(products: UcpProduct[], criteria: SearchToolArgs): UcpProduct[] {
    let allProducts = [...products];

    // 1. Budget Filter
    if (criteria.budgetMax) {
      allProducts = allProducts.filter(p => p.price <= criteria.budgetMax!);
    }

    // 2. Deduplicate by Title
    const seen = new Set();
    allProducts = allProducts.filter(p => {
      if (seen.has(p.title)) return false;
      seen.add(p.title);
      return true;
    });

    // 3. Score based on matching keyword terms

    const scoredProducts = allProducts.map(p => {
      let score = 0;
      const searchSpace = `${p.title} ${p.vendor} ${(p.tags || []).join(' ')}`.toLowerCase();
      
      criteria.keywords.forEach(kw => {
        const terms = [kw.term, ...(kw.synonyms || [])].map(t => t.toLowerCase().trim());
        // If the product text contains ANY of the terms in this keyword block, give it +2
        const isMatch = terms.some(term => {
           const variants = getWordVariants(term);
           return variants.some(v => searchSpace.includes(v));
        });
        if (isMatch) {
           score += 2;
        }
      });

      return { ...p, _score: score };
    });

    // 5. Rank
    scoredProducts.sort((a, b) => {
      if (b._score !== a._score) return b._score - a._score;
      return Math.random() - 0.5; // Randomize ties for diversity
    });

    // 6. Select Top
    // Return products that matched at least one keyword (score >= 2)
    let topProducts = scoredProducts.filter(p => p._score >= 2).slice(0, 4);
    
    // Affiliates tracking
    return topProducts.map(product => {
      try {
        const urlObj = new URL(product.store_url);
        urlObj.searchParams.set('ref', 'from_ai_affiliate');
        return {
          ...product,
          store_url: urlObj.toString()
        };
      } catch {
        return product;
      }
    });
  }
}
