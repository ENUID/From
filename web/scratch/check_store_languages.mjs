async function checkStore(domain) {
  const endpoint = `https://${domain}/api/mcp`;
  const payload = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "search_catalog",
      arguments: {
        catalog: {
          query: "shirt",
          filters: { available: true },
          pagination: { limit: 3 }
        }
      }
    }
  };

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(6000)
    });
    const data = await res.json();
    
    let products = [];
    if (data?.result?.structuredContent?.products) {
      products = data.result.structuredContent.products;
    } else {
      const textContent = data?.result?.content?.[0]?.text;
      if (textContent && typeof textContent === 'string') {
        try {
          const parsedInner = JSON.parse(textContent);
          products = parsedInner.products || [];
        } catch {}
      }
    }
    
    console.log(`\nDomain: ${domain}`);
    if (products.length === 0) {
      console.log("  No products found for 'shirt'. trying generic search...");
      // Try empty query or generic query
      return;
    }
    products.forEach((p, i) => {
      console.log(`  ${i+1}. Title: "${p.title}" | Tags: ${p.tags ? p.tags.slice(0, 3).join(', ') : 'NONE'}`);
    });
  } catch (err) {
    console.error(`  Error for ${domain}:`, err.message);
  }
}

async function main() {
  const stores = [
    "itsashirt.gr",       // Greece
    "circolo1901.it",     // Italy
    "coverchord.com",     // Japan / international
    "desiminimals.com"    // India
  ];
  for (const s of stores) {
    await checkStore(s);
  }
}

main().catch(console.error);
