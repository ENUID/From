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
- Search Query: When using the 'search_ucp' tool, keep the 'searchQuery' simple, specific, and focused. Do NOT use the logical 'OR' operator or expand the query with synonyms/translations (e.g. do NOT write "shoes OR sneakers", just write "shoes").
  * Query Language: Look at the targeted store(s) in the boutique store list. The 'searchQuery' MUST be written in the targeted store's catalog language (English for English stores, Japanese for Japanese stores).
  * E.g. If the user targets 'coverchord.com', the searchQuery MUST be in Japanese (e.g., "シャツ" for shirt) or English.
  * Since all stores are English or Japanese catalog, the searchQuery parameter MUST NEVER contain Vietnamese words (like "áo sơ mi", "giày", etc.) under any circumstances.
  * Never combine multiple languages in a single query.
- Smart Concept Filtering: In addition to the broad \`searchQuery\`, you MUST extract the critical concepts (e.g., product type, specific material, country of origin) into \`mandatoryConcepts\`. Group synonyms and translations for each concept together. The system uses this to calculate trust scores and prioritize matching products.
  * E.g. User asks for "sustainable leather bags from vietnam": 
    mandatoryConcepts: [["bag", "bags", "túi"], ["leather", "da", "cuero"], ["vietnam", "việt nam", "vietnamese"]]
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
  const message = "tìm áo sơ mi ở coverchord.com";
  console.log(`User query: "${message}"`);
  
  const messages = [{ role: 'user', content: message }];
  const storeDescriptions = UCP_REGISTRY.map(store => {
    const domain = store.domain.toLowerCase();
    let lang = 'English';
    if (domain.endsWith('.gr')) lang = 'Greek/English';
    else if (domain.endsWith('.it')) lang = 'Italian/English';
    else if (domain.endsWith('.jp')) lang = 'Japanese/English';
    else if (domain.includes('coverchord')) lang = 'Japanese/English';
    
    const categories = store.categories.join(', ');
    return `${store.domain} (Language: ${lang}, Categories: [${categories}])`;
  });
  
  let dynamicSystemPrompt = SYSTEM_PROMPT + `\n\nCRITICAL STORE LIMITATION: You MUST only recommend or mention products from the allowed boutique store list:\n${storeDescriptions.map(d => `- ${d}`).join('\n')}\nThe search tool 'search_ucp' will strictly filter results and only return products from these stores. Do not recommend or talk about products from any other stores.`;

  console.log("Calling Groq LLM planning phase...");
  const aiResponse = await generateRobustAIResponse(messages, dynamicSystemPrompt, [SEARCH_TOOL_DEF]);
  console.log("AI Response:", JSON.stringify(aiResponse, null, 2));

  if (aiResponse.tool_calls && aiResponse.tool_calls.length > 0) {
    const toolCall = aiResponse.tool_calls[0];
    if (toolCall.function.name === 'search_ucp') {
      const args = parseSearchToolArguments(toolCall.function.arguments);
      console.log("\nParsed Tool Arguments:", args);
      
      console.log(`\nRunning catalog search with query: "${args.searchQuery}"`);
      const products = await GlobalCatalogService.search(
        args.searchQuery,
        args.budgetMax,
        [],
        null,
        args.isClothing,
        args.mandatoryConcepts || [],
        'trust_desc',
        'USD',
        { fastFirstPage: true }
      );
      
      console.log(`\nSearch returned ${products.length} products.`);
      if (products.length > 0) {
        products.slice(0, 5).forEach((p, i) => {
          console.log(`  ${i+1}. ${p.title} (${p.vendor})`);
        });
      }
    }
  } else {
    console.log("No tool calls were returned by the LLM.");
  }
}

runTest().catch(console.error);
