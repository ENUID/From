import { z } from 'zod';

export const SearchToolSchema = z.object({
  searchQuery: z.string().describe("The full natural language search query describing the product. e.g. 'eco-friendly denim jeans' or 'linen shirts'"),
  budgetMax: z.number().nullable().optional().describe("Maximum budget if specified")
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
          description: "A natural search query describing the product in English. E.g., 'blue linen shirts', 'ceramic coffee mugs'."
        },
        budgetMax: {
          type: "number",
          description: "The maximum budget the user is willing to spend, if specified."
        }
      },
      required: ["searchQuery"]
    }
  }
};
