import { z } from 'zod';

export const SearchToolSchema = z.object({
  coreProduct: z.string().describe("The singular core noun of what the user is looking for (e.g. 'bowl', 'jacket', 'vase'). Must be a single word if possible."),
  synonyms: z.array(z.string()).max(3).describe("2 to 3 absolute direct synonyms for the core product (e.g. if core is 'bowl', synonyms could be 'dish', 'basin'). Do NOT use broad categories.").optional(),
  attributes: z.array(z.string()).describe("List of attributes like color, material, style (e.g. ['white', 'ceramic', 'minimalist'])"),
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
        coreProduct: {
          type: "string",
          description: "The absolute core noun/product being searched (e.g. 'bowl', 'jacket', 'shoes'). Must be singular."
        },
        attributes: {
          type: "array",
          items: { type: "string" },
          description: "List of attributes like color, material, or style (e.g. ['minimalist', 'white', 'ceramic'])."
        },
        searchQuery: {
          type: "string",
          description: "A natural search query incorporating attributes and core product for the search engine (e.g. 'minimalist white ceramic bowl')."
        },
        budgetMax: {
          type: "number",
          description: "The maximum budget the user is willing to spend, if specified."
        }
      },
      required: ["coreProduct", "attributes", "searchQuery"]
    }
  }
};
