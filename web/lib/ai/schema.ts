import { z } from 'zod';

export const SearchToolSchema = z.object({
  searchQuery: z.string().describe("The full natural language search query describing the product. e.g. 'eco-friendly denim jeans' or 'linen shirts'"),
  budgetMax: z.number().nullable().optional().describe("Maximum budget if specified"),
  budgetCurrency: z.string().length(3).optional().describe("ISO 4217 currency code for the budget, if the user explicitly names a currency."),
  isClothing: z.boolean().optional().describe("Set to true if the product category is clothing, shoes, apparel, jewelry, bags, or other fashion/style accessories."),
  sort: z.enum(['price_asc', 'price_desc', 'relevance']).optional().describe("Requested sorting order. 'price_asc' (cheapest first), 'price_desc' (most expensive first), or 'relevance'. Default is price_asc.")
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
          description: "An expanded search query combining 5-8 translations (e.g. Vietnamese, English, Japanese, Korean), synonyms, plurals, or brand variations using 'OR' logic to cast the widest net possible. E.g., 'shirt OR shirts OR áo sơ mi OR シャツ OR button down OR 셔츠'."
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
        sort: {
          type: "string",
          enum: ["price_asc", "price_desc", "relevance"],
          description: "The requested sorting order. 'price_asc' (cheapest first), 'price_desc' (most expensive first), or 'relevance'. If the user doesn't specify, omit this."
        }
      },
      required: ["searchQuery"]
    }
  }
};
