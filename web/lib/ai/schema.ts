import { z } from 'zod';

export const SearchToolSchema = z.object({
  coreProduct: z.string().describe("The core noun/product being searched (e.g. 'bowl', 'jacket', 'shoes'). Must be singular."),
  attributes: z.array(z.string()).describe("List of attributes like color, material, or style (e.g. ['minimalist', 'white', 'ceramic'])."),
  searchQuery: z.string().describe("A natural search query incorporating attributes and core product for the search engine (e.g. 'minimalist white ceramic bowl')."),
  budgetMax: z.number().optional().describe("Maximum budget if the user specified one.")
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
