import * as fs from 'fs';

function main() {
  const jsonPath = './web/scratch/store_profiles.json';
  const tsPath = './web/lib/stores.ts';

  if (!fs.existsSync(jsonPath)) {
    console.error('store_profiles.json not found!');
    return;
  }

  const profiles = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  // Clean the profiles to only keep domain, categories, and vibe
  const cleanedProfiles = profiles.map((p) => ({
    domain: p.domain,
    categories: p.categories || ["apparel"],
    vibe: p.vibe || []
  }));

  const tsContent = `export type StoreProfile = {
  domain: string;
  categories: string[];
  vibe: string[];
};

export const UCP_REGISTRY: StoreProfile[] = ${JSON.stringify(cleanedProfiles, null, 2)};
`;

  fs.writeFileSync(tsPath, tsContent, 'utf8');
  console.log(`Successfully merged profiles into ${tsPath}`);
}

main();
