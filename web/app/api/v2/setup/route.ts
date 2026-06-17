/**
 * POST /api/v2/setup
 *
 * One-time database schema setup. Creates all tables and indexes.
 * Safe to run multiple times (IF NOT EXISTS everywhere).
 * Protected by CRON_SECRET.
 */

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db/client'

export const runtime = 'nodejs'
export const maxDuration = 60

const SCHEMA = `
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS stores (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain        TEXT NOT NULL UNIQUE,
  name          TEXT,
  categories    TEXT[]  DEFAULT '{}',
  vibe          TEXT[]  DEFAULT '{}',
  gender        TEXT[]  DEFAULT '{}',
  price_range   TEXT,
  about         TEXT,
  is_active     BOOLEAN DEFAULT TRUE,
  product_count INT     DEFAULT 0,
  last_crawled_at TIMESTAMPTZ,
  crawl_error   TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id      UUID    REFERENCES stores(id) ON DELETE CASCADE,
  external_id   TEXT    NOT NULL,
  title         TEXT    NOT NULL,
  vendor        TEXT,
  price_min     NUMERIC,
  price_max     NUMERIC,
  currency      TEXT    DEFAULT 'USD',
  store_url     TEXT,
  image_url     TEXT,
  images        JSONB   DEFAULT '[]',
  in_stock      BOOLEAN DEFAULT TRUE,
  tags          TEXT[]  DEFAULT '{}',
  description   TEXT,
  categories    TEXT[]  DEFAULT '{}',
  gender        TEXT[]  DEFAULT '{}',
  options       JSONB   DEFAULT '[]',
  variants      JSONB   DEFAULT '[]',
  fts_vector    TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce(title, '')                        || ' ' ||
      coalesce(vendor, '')                       || ' ' ||
      coalesce(description, '')                  || ' ' ||
      coalesce(array_to_string(tags, ' '), '')   || ' ' ||
      coalesce(array_to_string(categories, ' '), '')
    )
  ) STORED,
  embedding     vector(1536),
  quality_score NUMERIC DEFAULT 0.5,
  crawled_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (store_id, external_id)
);

CREATE TABLE IF NOT EXISTS discovery_feeds (
  id          UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_key    TEXT  NOT NULL UNIQUE,
  product_ids UUID[] DEFAULT '{}',
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Brands that connect their own store (Shopify OAuth). A connected brand is the
-- authoritative, live source for its products — higher trust than a crawl.
CREATE TABLE IF NOT EXISTS brand_accounts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_domain   TEXT NOT NULL UNIQUE,
  public_domain  TEXT,
  display_name   TEXT,
  platform       TEXT DEFAULT 'shopify',
  access_token   TEXT,
  scope          TEXT,
  plan           TEXT DEFAULT 'free',
  status         TEXT DEFAULT 'connected',
  store_id       UUID REFERENCES stores(id) ON DELETE SET NULL,
  product_count  INT  DEFAULT 0,
  connected_at   TIMESTAMPTZ DEFAULT now(),
  last_synced_at TIMESTAMPTZ,
  sync_error     TEXT,
  updated_at     TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE products ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'crawl';
ALTER TABLE products ADD COLUMN IF NOT EXISTS brand_account_id UUID REFERENCES brand_accounts(id) ON DELETE SET NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_products_source        ON products (source);
CREATE INDEX IF NOT EXISTS idx_products_brand_account ON products (brand_account_id);
CREATE INDEX IF NOT EXISTS idx_brand_accounts_domain  ON brand_accounts (store_domain);

CREATE TABLE IF NOT EXISTS sync_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at        TIMESTAMPTZ DEFAULT now(),
  finished_at       TIMESTAMPTZ,
  stores_attempted  INT DEFAULT 0,
  stores_succeeded  INT DEFAULT 0,
  products_upserted INT DEFAULT 0,
  error             TEXT
);

CREATE INDEX IF NOT EXISTS idx_products_store_id   ON products (store_id);
CREATE INDEX IF NOT EXISTS idx_products_fts        ON products USING GIN (fts_vector);
CREATE INDEX IF NOT EXISTS idx_products_tags       ON products USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_products_gender     ON products USING GIN (gender);
CREATE INDEX IF NOT EXISTS idx_products_in_stock   ON products (in_stock);
CREATE INDEX IF NOT EXISTS idx_products_price_min  ON products (price_min);
CREATE INDEX IF NOT EXISTS idx_products_updated    ON products (updated_at DESC);
`

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') ?? req.headers.get('authorization')?.replace('Bearer ', '')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'DATABASE_URL not set' }, { status: 500 })
  }

  const db = sql()
  const results: string[] = []
  const errors: string[] = []

  // Run each statement separately
  const statements = SCHEMA
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 2 && !s.startsWith('--'))

  for (const stmt of statements) {
    try {
      await db.unsafe(stmt)
      const label = stmt.slice(0, 60).replace(/\s+/g, ' ')
      results.push(`✓ ${label}`)
    } catch (err) {
      const label = stmt.slice(0, 60).replace(/\s+/g, ' ')
      errors.push(`✗ ${label}: ${(err as Error).message}`)
    }
  }

  return NextResponse.json({
    ok: errors.length === 0,
    executed: results.length,
    results,
    errors,
    next: errors.length === 0
      ? 'Schema ready. Now POST /api/v2/sync to load products.'
      : 'Some statements failed — check errors above.',
  })
}
