-- FROM v2 — Persistent product corpus
-- Run once against your Neon/Supabase database.
-- Requires pgvector extension.

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ─── Stores ────────────────────────────────────────────────────────────────────

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

-- ─── Products ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS products (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id      UUID    REFERENCES stores(id) ON DELETE CASCADE,
  external_id   TEXT    NOT NULL,

  -- Core fields
  title         TEXT    NOT NULL,
  vendor        TEXT,
  price_min     NUMERIC,
  price_max     NUMERIC,
  currency      TEXT    DEFAULT 'USD',
  store_url     TEXT,
  image_url     TEXT,
  images        JSONB   DEFAULT '[]'::JSONB,
  in_stock      BOOLEAN DEFAULT TRUE,
  tags          TEXT[]  DEFAULT '{}',
  description   TEXT,
  categories    TEXT[]  DEFAULT '{}',
  gender        TEXT[]  DEFAULT '{}',
  options       JSONB   DEFAULT '[]'::JSONB,
  variants      JSONB   DEFAULT '[]'::JSONB,

  -- Full-text search (Postgres GIN, English stemming)
  fts_vector    TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce(title, '')                        || ' ' ||
      coalesce(vendor, '')                       || ' ' ||
      coalesce(description, '')                  || ' ' ||
      coalesce(array_to_string(tags, ' '), '')   || ' ' ||
      coalesce(array_to_string(categories, ' '), '')
    )
  ) STORED,

  -- Semantic embedding (OpenAI text-embedding-3-small = 1536 dims)
  embedding     vector(1536),

  -- Metadata
  quality_score NUMERIC DEFAULT 0.5,
  crawled_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),

  UNIQUE (store_id, external_id)
);

-- ─── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_products_store_id    ON products (store_id);
CREATE INDEX IF NOT EXISTS idx_products_fts         ON products USING GIN (fts_vector);
CREATE INDEX IF NOT EXISTS idx_products_tags        ON products USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_products_gender      ON products USING GIN (gender);
CREATE INDEX IF NOT EXISTS idx_products_categories  ON products USING GIN (categories);
CREATE INDEX IF NOT EXISTS idx_products_in_stock    ON products (in_stock);
CREATE INDEX IF NOT EXISTS idx_products_price_min   ON products (price_min);
CREATE INDEX IF NOT EXISTS idx_products_updated     ON products (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_title_trgm  ON products USING GIN (title gin_trgm_ops);

-- Vector index: create AFTER initial data load (needs ≥1000 rows for ivfflat to be effective)
-- Run manually: CREATE INDEX idx_products_embedding ON products
--   USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ─── Discovery feed cache ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS discovery_feeds (
  id          UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_key    TEXT  NOT NULL UNIQUE,   -- e.g. "women:quiet-luxury", "men:streetwear", "all:trending"
  product_ids UUID[] DEFAULT '{}',
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ─── Sync log ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sync_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at  TIMESTAMPTZ DEFAULT now(),
  finished_at TIMESTAMPTZ,
  stores_attempted INT DEFAULT 0,
  stores_succeeded INT DEFAULT 0,
  products_upserted INT DEFAULT 0,
  error       TEXT
);
