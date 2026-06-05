const registryDomains = [
  "allbirds.com"
];

const productDomains = [
  "weareallbirds.myshopify.com"
];

function cleanBrandName(domain) {
  if (!domain) return '';
  let cleaned = domain.toLowerCase().trim();
  
  // Remove protocols
  cleaned = cleaned.replace(/^(https?:\/\/)?(www\.)?/, '');
  cleaned = cleaned.split('/')[0];

  // If it ends with myshopify.com, get the part right before myshopify
  if (cleaned.includes('.myshopify.com')) {
    const parts = cleaned.replace(/\.myshopify\.com$/, '').split('.');
    cleaned = parts[parts.length - 1];
  } else {
    // Split by . and filter out TLDs
    const parts = cleaned.split('.');
    const tlds = new Set(['com', 'co', 'uk', 'org', 'net', 'store', 'in', 'us', 'ca', 'au', 'io', 'website', 'com', 'au', 'me', 'ph', 'ae', 'fr', 'eu', 'gr', 'it', 'co', 'id', 'xyz', 'cc']);
    const nonTlds = parts.filter(p => !tlds.has(p));
    if (nonTlds.length > 0) {
      cleaned = nonTlds[nonTlds.length - 1];
    } else {
      cleaned = parts[0];
    }
  }

  // Remove all hyphens and underscores to handle "alo-yoga" -> "aloyoga"
  cleaned = cleaned.replace(/[\-_]/g, '');

  // Remove common prefixes
  cleaned = cleaned.replace(/^(shop|weare|the|buy|get|official|studio|wear)\-?/i, '');
  
  // Remove common suffixes
  cleaned = cleaned.replace(/\-?(shop|store|clothing|brand|official|studio|wear|collective|denim)$/i, '');
  return cleaned;
}

function isDomainMatch(productDomain, allowedDomain) {
  const p = cleanBrandName(productDomain);
  const a = cleanBrandName(allowedDomain);
  if (!p || !a) return false;
  if (p === a) return true;
  if (p.length >= 3 && a.length >= 3) {
    if (p.startsWith(a) || a.startsWith(p)) return true;
  }
  return false;
}

console.log("=== Matching Results ===");
productDomains.forEach(p => {
  registryDomains.forEach(r => {
    if (isDomainMatch(p, r)) {
      console.log(`✅ [${p}] matches registry [${r}] (Cleaned: Product="${cleanBrandName(p)}", Registry="${cleanBrandName(r)}")`);
    }
  });
});
