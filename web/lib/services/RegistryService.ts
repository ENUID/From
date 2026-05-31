import { UCP_REGISTRY } from '../stores';
import { SearchToolArgs } from '../ai/schema';

export class RegistryService {
  /**
   * Finds relevant store domains from the internal registry based on the AI's categorized search intent.
   * This guarantees 100% UCP compliance and eliminates Google Search latency.
   */
  static findRelevantStores(criteria: SearchToolArgs): string[] {
    const normalizedAttributes = (criteria.attributes || []).map(attr => typeof attr === 'string' ? { primary: attr, synonyms: [] } : attr);
    const attributeStrings = normalizedAttributes.flatMap(a => [a.primary, ...(a.synonyms || [])]);
    const allQueryText = `${criteria.searchQuery} ${attributeStrings.join(' ')}`.toLowerCase();
    const queryWords = Array.from(new Set(allQueryText.split(/[\s,]+/).filter(w => w.length > 2)));
    const coreProduct = criteria.coreProduct.toLowerCase();

    // Score each store based on how well its categories and vibes match the query
    const scoredStores = UCP_REGISTRY.map(store => {
      let score = 0;
      
      const storeKeywords = [...store.categories, ...store.vibe].map(k => k.toLowerCase());
      const storeText = storeKeywords.join(' ');

      // Core product match is highly weighted
      if (storeText.includes(coreProduct)) {
        score += 10;
      } else if (coreProduct.endsWith('s') && storeText.includes(coreProduct.slice(0, -1))) {
        score += 10;
      }

      // Attribute/vibe matching
      queryWords.forEach(word => {
        if (storeText.includes(word)) {
          score += 2;
        } else if (word.endsWith('s') && storeText.includes(word.slice(0, -1))) {
          score += 2;
        }
      });

      return { domain: store.domain, score };
    });

    // Filter out completely irrelevant stores (score 0) and sort by score
    const relevantStores = scoredStores
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score);

    // If no stores matched perfectly, just return the top general stores or all if fallback needed
    // But since we want to be strict, we'll return the ones that matched something.
    // If absolutely none matched, return top 3 default stores so UCP at least tries.
    if (relevantStores.length === 0) {
      return UCP_REGISTRY.slice(0, 3).map(s => s.domain);
    }

    // Return the domains of the top matching stores (max 8 to limit parallel requests)
    return relevantStores.slice(0, 8).map(s => s.domain);
  }
}
