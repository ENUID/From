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
    // Include synonyms in the core noun checking
    const allNouns = [criteria.coreProduct, ...(criteria.synonyms || [])];
    const coreVariants = allNouns.flatMap(n => getWordVariants(n));
    
    // 4. Score based on explicit attribute blocks and core variants

    const scoredProducts = allProducts.map(p => {
      let score = 0;
      const searchSpace = `${p.title} ${p.vendor} ${(p.tags || []).join(' ')}`.toLowerCase();
      
      const normalizedAttributes = (criteria.attributes || []).map(attr => typeof attr === 'string' ? { primary: attr, synonyms: [] } : attr);
      normalizedAttributes.forEach(attr => {
        const terms = [attr.primary, ...(attr.synonyms || [])].map(t => t.toLowerCase().trim());
        // If the product text contains ANY of the terms in this attribute block, give it +2
        const isMatch = terms.some(term => {
           const variants = getWordVariants(term);
           return variants.some(v => searchSpace.includes(v));
        });
        if (isMatch) {
           score += 2;
        }
      });
      
      // Strict check: Does the title or tags contain the core product noun?
      const hasCoreProduct = coreVariants.some(variant => searchSpace.includes(variant));
      
      if (hasCoreProduct) {
        score += 10; // Huge base score for actually being the right object type
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
    let topProducts = scoredProducts.filter(p => p._score >= 10).slice(0, 4);
    
    // Fallback: If no products have the exact core product (e.g. searching for "bowl" but the store calls it "dish"),
    // but the product matches multiple strong attributes (score >= 4), we allow it.
    // This prevents the system from returning nothing when a valid synonym exists, 
    // while still aggressively blocking garbage like "Soap" (score 0-2).
    if (topProducts.length === 0) {
      topProducts = scoredProducts.filter(p => p._score >= 4).slice(0, 4);
    }
    
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
