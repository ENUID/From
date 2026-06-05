const VIETNAMESE_TO_ENGLISH = {
  'lanh': 'linen',
  'thun': 'cotton',
  'len': 'wool',
  'lụa': 'silk',
  'tơ': 'silk',
  'da': 'leather',
  'bò': 'denim',
  'kaki': 'khaki',
  'áo': 'shirt',
  'sơ mi': 'shirt',
  'quần': 'pants',
  'váy': 'dress',
  'đầm': 'dress',
  'khoác': 'jacket',
  'giày': 'shoes',
  'dép': 'sandals',
  'túi': 'bag',
  'ví': 'wallet',
  'mũ': 'hat',
  'nón': 'hat',
  'kính': 'glasses',
  'trắng': 'white',
  'đen': 'black',
  'xanh': 'blue',
  'đỏ': 'red',
  'hồng': 'pink',
  'nâu': 'brown',
  'vàng': 'yellow'
};

function translateVietnameseToEnglish(query) {
  const normalized = query.toLowerCase();
  
  // Replace compound phrases first
  let cleaned = normalized
    .replace(/\bsơ\s+mi\b/g, 'shirt')
    .replace(/\báo\s+khoác\b/g, 'jacket')
    .replace(/\báo\s+thun\b/g, 't-shirt');
    
  // Split into words
  const words = cleaned.split(/\s+/).map(w => w.trim()).filter(Boolean);
  const translatedWords = [];
  
  for (const word of words) {
    if (VIETNAMESE_TO_ENGLISH[word]) {
      translatedWords.push(VIETNAMESE_TO_ENGLISH[word]);
    } else {
      const isAscii = !/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(word);
      if (isAscii) {
        translatedWords.push(word);
      }
    }
  }
  
  const unique = Array.from(new Set(translatedWords));
  
  if (unique.includes('jacket') && unique.includes('shirt')) {
    const idx = unique.indexOf('shirt');
    unique.splice(idx, 1);
  }
  
  const materials = ['linen', 'cotton', 'wool', 'silk', 'leather', 'denim', 'khaki'];
  const colors = ['white', 'black', 'blue', 'red', 'pink', 'brown', 'yellow'];
  
  const matchesMaterials = unique.filter(w => materials.includes(w));
  const matchesColors = unique.filter(w => colors.includes(w));
  const matchesOthers = unique.filter(w => !materials.includes(w) && !colors.includes(w));
  
  const reordered = [...matchesColors, ...matchesMaterials, ...matchesOthers];
  
  return reordered.join(' ');
}

function cleanQueryForStorefront(query) {
  const parts = query.split(/\s+OR\s+/i).map(p => p.trim()).filter(Boolean);
  if (parts.length === 0) return '';
  
  for (const part of parts) {
    const isEnglish = !/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(part);
    if (isEnglish) {
      return part;
    }
  }
  
  const translated = translateVietnameseToEnglish(parts[0]);
  if (translated) {
    return translated;
  }
  
  return parts[0];
}

const testCases = [
  "áo sơ mi lanh",
  "đầm lụa hồng",
  "giày bò",
  "áo khoác len",
  "quần thun đen",
  "túi da",
  "áo sơ mi lanh OR linen shirt",
  "áo sơ mi lanh OR linen shirt OR lanh áo"
];

console.log("Testing Vietnamese search translations:");
testCases.forEach((tc, idx) => {
  const cleaned = cleanQueryForStorefront(tc);
  console.log(`[${idx+1}] Input: "${tc}" -> Cleaned/Translated: "${cleaned}"`);
});
