/**
 * Run once to create the FROM v2 schema in your Neon/Supabase database.
 *
 * Usage:
 *   DATABASE_URL=postgres://... npx tsx scripts/db-setup.ts
 *
 * Or copy the contents of web/lib/db/schema.sql and run in the Neon SQL editor.
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import { neon } from '@neondatabase/serverless'

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL environment variable is required')
    process.exit(1)
  }

  const schemaPath = join(__dirname, '../lib/db/schema.sql')
  const schema = readFileSync(schemaPath, 'utf8')

  const db = neon(url)

  console.log('Applying schema...')
  // Split on semicolons to run each statement individually
  const statements = schema
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))

  for (const stmt of statements) {
    try {
      await db.unsafe(stmt + ';')
      console.log('✓', stmt.slice(0, 60).replace(/\n/g, ' '))
    } catch (err) {
      console.error('✗', stmt.slice(0, 60).replace(/\n/g, ' '))
      console.error('  Error:', (err as Error).message)
    }
  }

  console.log('\nSchema applied. Check above for any errors.')
  console.log('\nNext steps:')
  console.log('1. Add DATABASE_URL to your Vercel environment variables')
  console.log('2. Optionally add OPENAI_API_KEY for semantic search')
  console.log('3. Trigger initial sync: POST /api/v2/sync with x-cron-secret header')
  console.log('4. After 1000+ products: CREATE INDEX idx_products_embedding ON products')
  console.log('   USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
