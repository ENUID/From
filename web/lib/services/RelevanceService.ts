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

    // 3. Strict Core Product Filter (e.g. must contain "bowl")
    const coreVariants = getWordVariants(criteria.coreProduct);
    
    // 4. Scoring logic
    const scoredProducts = allProducts.map(p => {
      let score = 0;
      const searchSpace = `${p.title} ${p.vendor} ${(p.tags || []).join(' ')}`.toLowerCase();
      
      // Strict check: Does the title or tags contain the core product noun?
      // If not, score remains 0 which usually filters it out entirely.
      const hasCoreProduct = coreVariants.some(variant => searchSpace.includes(variant));
      
      if (hasCoreProduct) {
        score += 10; // Huge base score for actually being the right object type
      }

      // Add points for attributes matching
      criteria.attributes.forEach(attr => {
        if (searchSpace.includes(attr.toLowerCase())) {
          score += 2;
        }
      });
      
      // Add points for exact natural string matching
      if (searchSpace.includes(criteria.searchQuery.toLowerCase())) {
        score += 5;
      }

      return { ...p, _score: score };
    });

    // 5. Rank
    scoredProducts.sort((a, b) => {
      if (b._score !== a._score) return b._score - a._score;
      return Math.random() - 0.5; // Randomize ties for diversity
    });

    // 6. Select Top
    // Ideally only return products that passed the Core Product check (_score >= 10).
    // If none passed, fallback to returning nothing, because returning "Soap" when asking for "Bowl" is unacceptable.
    let topProducts = scoredProducts.filter(p => p._score >= 10).slice(0, 4);
    
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
