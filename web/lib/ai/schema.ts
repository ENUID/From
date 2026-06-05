import { z } from 'zod';

export const SearchToolSchema = z.object({
  searchQuery: z.string().describe("A clean, simple search query in the dominant language of the target storefront(s) (e.g. 'linen shirt' or 'shoes'). Do NOT use logical OR, synonyms, or multiple languages."),
  budgetMax: z.number().nullable().optional().describe("Maximum budget if specified"),
  budgetCurrency: z.string().length(3).optional().describe("ISO 4217 currency code for the budget, if the user explicitly names a currency."),
  isClothing: z.boolean().optional().describe("Set to true if the product category is clothing, shoes, apparel, jewelry, bags, or other fashion/style accessories."),
  mandatoryConcepts: z.array(z.array(z.string())).optional().describe("Groups of essential concepts that MUST be present. Each group is an array of synonyms/translations. E.g. [['bag', 'túi'], ['vietnam', 'việt nam', 'vietnamese']]"),
  sort: z.enum(['price_asc', 'price_desc', 'relevance', 'trust_desc']).optional().describe("Requested sorting order. 'price_asc' (cheapest first), 'price_desc' (most expensive first), 'relevance', or 'trust_desc' (highest reputation shops first). Default is trust_desc.")
});

export type SearchToolArgs = z.infer<typeof SearchToolSchema>;

export const SEARCH_TOOL_DEF = {
  type: "function",
  function: {
    name: "search_ucp",
    description: "Search for NEW products across hundreds of millions of Shopify stores. DO NOT use this tool if the user is asking you to compare products already in the chat. If the user asks for 'more' products or 'others', you MUST use the EXACT SAME searchQuery as your previous search. Do not add words like 'more' or 'other' to the query, the system will automatically handle pagination.",
    parameters: {
      type: "object",
      properties: {
        searchQuery: {
          type: "string",
          description: "A clean, simple search query containing only keywords in the dominant language of the target storefront(s) (e.g. 'linen shirt' for English stores, 'シャツ' for Japanese stores). Do NOT use logical OR, synonyms, or multiple languages."
        },
        budgetMax: {
          type: "number",
          description: "The maximum budget the user is willing to spend, if specified."
        },
        budgetCurrency: {
          type: "string",
          description: "Three-letter ISO currency code for budgetMax if the user explicitly specifies one, e.g. USD, EUR, VND, JPY. Omit it when the currency is implicit."
        },
        isClothing: {
          type: "boolean",
          description: "Set to true if the search query targets clothing, shoes, apparel, garments, jewelry, bags, or other fashion/style accessories."
        },
        mandatoryConcepts: {
          type: "array",
          items: {
            type: "array",
            items: { type: "string" }
          },
          description: "Extract the most critical concepts the user requested (e.g. product type, origin, material). For each concept, provide an array of synonyms and translations. Example for 'leather bags vietnam': [['bag', 'bags', 'túi'], ['leather', 'da'], ['vietnam', 'việt nam', 'vietnamese']]. The system will filter out any products that don't match ALL concept groups."
        },
        sort: {
          type: "string",
          enum: ["price_asc", "price_desc", "relevance", "trust_desc"],
          description: "Requested sorting order. 'price_asc' (cheapest first), 'price_desc' (most expensive first), 'relevance', or 'trust_desc' (prioritize shops with highest prestige/reputation). Default is trust_desc."
        }
      },
      required: ["searchQuery"]
    }
  }
};
