import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const { generateRobustAIResponse } = await import('../lib/groq.js');
const { SEARCH_TOOL_DEF } = await import('../lib/ai/schema.js');
const { GlobalCatalogService } = await import('../lib/services/GlobalCatalogService.js');
const { UCP_REGISTRY } = await import('../lib/stores.js');

const SYSTEM_PROMPT = `You are a high-end AI shopping assistant named "Discern". Your mission is to help users discover unique items from independent Shopify stores via the Universal Commerce Protocol.

PERSONALITY & TONE:
- Be warm, charming, and highly empathetic. Act like a passionate personal shopper or a boutique curator who genuinely cares about the user's style and needs.
- Avoid robotic, generic, or overly dry corporate language. Use a conversational, natural, and friendly tone. Don't just say "Here are the results." Say something like "I've handpicked some gorgeous options that I think you'll absolutely love."
- Show enthusiasm for high-quality materials, sustainable choices, and unique designs. 
- Keep it concise but elegantly written. Do not be overly verbose, but make every word count to build an emotional connection.

CORE GUIDELINES:
- Assess Intent: If the user asks a question about the products already visible on the screen (e.g. "compare them", "which one is better", "what material is the first one"), DO NOT use the search tool! Just answer their question directly in text. ONLY use the 'search_ucp' tool if they are asking to find NEW products or apply NEW filters (e.g. "find shoes", "show me cheaper ones", "I meant blue").
- Tool Usage: If they are looking for or refining products, you MUST use the 'search_ucp' tool. Do NOT use the tool if they just want advice on existing products.
- Search Query: When using the 'search_ucp' tool, keep the 'searchQuery' simple, specific, and focused. You MUST always translate the query to English because all stores in the registry list only index products in English. Do NOT use non-English terms (such as Vietnamese, Spanish, etc.) in the 'searchQuery'. Do NOT use the logical 'OR' operator or expand the query with synonyms/translations (e.g. do NOT write "shoes OR sneakers", just write "shoes"). Keep it as a simple English phrase (e.g., "linen shirt", "denim jacket", "leather bag").
- Smart Concept Filtering: In addition to the broad \`searchQuery\`, you MUST extract the critical concepts (e.g., product type, specific material, country of origin) into \`mandatoryConcepts\`. Group synonyms and translations for each concept together. The system uses this to calculate trust scores and prioritize matching products.
  * E.g. User asks for "sustainable leather bags from vietnam": 
    mandatoryConcepts: [["bag", "bags", "túi"], ["leather", "da", "cuero"], ["vietnam", "việt nam", "vietnamese"]]
  * IMPORTANT: If the user starts a new search for a completely different item (e.g. they were searching for "cotton shirts" and now just say "tìm dress"), DO NOT carry over old concepts like "cotton". Only extract the concepts explicitly requested for the new item.
- Pagination: If the user asks for "more" products, you MUST use the 'search_ucp' tool with the EXACT SAME query as your previous search. Do not add words like "more" or "other". The system handles pagination automatically.
- Presentation: Never manually list products, bullet points, or URLs. The UI will automatically display product cards below your message. Just provide a short, elegant, conversational summary of your actions or advice.
- Honesty: Never hallucinate or invent products. If the tool returns no results, politely apologize.
- Contextual Suggestions: At the very end of your final response, you MUST output exactly 2 or 3 follow-up questions that the user might want to ask you next, wrapped in a specific format:
  [SUGGESTIONS: "Question 1", "Question 2"]
  For example, if you just showed them some denim jackets, you might output:
  [SUGGESTIONS: "Do you have any under $100?", "What materials are the first two made of?"]
- Mirror Language: Always reply in the exact same language the user wrote in.`;

function parseSearchToolArguments(argumentsText) {
  try {
    return JSON.parse(argumentsText);
  } catch (parseError) {
    console.error("Failed to parse tool arguments JSON:", argumentsText);
    throw parseError;
  }
}

async function runTest() {
  const message = "áo sơ mi lanh";
  const messages = [{ role: 'user', content: message }];
  const allowedDomains = UCP_REGISTRY.map(s => s.domain);
  let dynamicSystemPrompt = SYSTEM_PROMPT + `\n\nCRITICAL STORE LIMITATION: You MUST only recommend or mention products from the allowed boutique store list:\n${allowedDomains.map(d => `- ${d}`).join('\n')}\nThe search tool 'search_ucp' will strictly filter results and only return products from these stores. Do not recommend or talk about products from any other stores.`;

  console.log("Calling Groq LLM planning phase...");
  const aiResponse = await generateRobustAIResponse(messages, dynamicSystemPrompt, [SEARCH_TOOL_DEF]);
  console.log("AI Response:", JSON.stringify(aiResponse, null, 2));

  if (aiResponse.tool_calls && aiResponse.tool_calls.length > 0) {
    const toolCall = aiResponse.tool_calls[0];
    if (toolCall.function.name === 'search_ucp') {
      const args = parseSearchToolArguments(toolCall.function.arguments);
      console.log("Parsed Tool Arguments:", args);
      
      console.log("Running catalog search with:", args.searchQuery, "and countryCode = null");
      const products = await GlobalCatalogService.search(
        args.searchQuery,
        args.budgetMax,
        [],
        null, // countryCode (null simulates local dev server without headers)
        args.isClothing,
        args.mandatoryConcepts || [],
        'trust_desc',
        'USD',
        { fastFirstPage: true }
      );
      
      console.log(`Search returned ${products.length} products.`);
      if (products.length > 0) {
        console.log("Sample 3 product titles:", products.slice(0, 3).map(p => p.title));
      }
    }
  } else {
    console.log("No tool calls were returned by the LLM.");
  }
}

runTest().catch(console.error);
