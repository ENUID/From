import { z } from 'zod';

export const SearchToolSchema = z.object({
  keywords: z.array(
    z.object({
      term: z.string().describe("A keyword from the user's intent"),
      synonyms: z.array(z.string()).max(3).describe("2-3 synonyms for this keyword").optional()
    })
  ).describe("List of all keywords (product nouns, materials, colors) extracted from the query, translated to English."),
  searchQuery: z.string().describe("The full natural language search query describing the product"),
  budgetMax: z.number().optional().describe("Maximum budget if specified")
});

export type SearchToolArgs = z.infer<typeof SearchToolSchema>;

export const SEARCH_TOOL_DEF = {
  type: "function",
  function: {
    name: "search_ucp",
    description: "Search for products across independent Shopify stores using Universal Commerce Protocol.",
    parameters: {
      type: "object",
      properties: {
        keywords: {
          type: "array",
          items: {
            type: "object",
            properties: {
              term: { type: "string" },
              synonyms: { type: "array", items: { type: "string" } }
            },
            required: ["term"]
          },
          description: "List of keywords and their synonyms to search for. Must be in English."
        },
        searchQuery: {
          type: "string",
          description: "A natural search query incorporating all keywords for context."
        },
        budgetMax: {
          type: "number",
          description: "The maximum budget the user is willing to spend, if specified."
        }
      },
      required: ["keywords", "searchQuery"]
    }
  }
};
