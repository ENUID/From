# FROM — Architecture

FROM is a **two-sided platform** in a single repository:

- **People side (shoppers)** — the AI shopping search + stylist.
- **Brand side (merchants)** — brands connect their store, get a dashboard,
  AI tools, and a public profile.
- **Operator side (you)** — review/approve brands, run the corpus pipeline.

All three sit on **one shared backend** (Postgres corpus, Shopify ingestion,
hybrid search, embeddings, Groq AI). One repo, one deploy — the sides are kept
cleanly separated by folder, not by duplicating infrastructure. A second repo
would force duplicating that shared backend, so we deliberately don't.

## Where each side lives

| Concern | People (shoppers) | Brand (merchants) | Operator |
|---|---|---|---|
| **Pages** | `web/app/(shop)/` | `web/app/(brand)/brands/`, `web/app/(brand)/brand/[domain]/` | `web/app/(brand)/admin/` |
| **Feature UI** | `web/features/from/` | `web/features/brands/` | (uses `features/brands/theme`) |
| **API routes** | `web/app/api/ai/`, `web/app/api/v2/` (search) | `web/app/api/brands/*` | `web/app/api/admin/brands`, `web/app/api/v2/setup|sync` |
| **Backend libs** | `web/lib/services/` (live search) | `web/lib/shopify/`, `web/lib/brands/` | — |

> Route groups `(shop)` and `(brand)` are organizational only — the parentheses
> are ignored by Next.js routing, so URLs are unchanged (`/`, `/brands`,
> `/brand/[domain]`, `/admin`).

## Shared backend (used by both sides)

- `web/lib/db/` — Neon Postgres client + schema
- `web/lib/ingestion/` — crawl → normalize → embed (anonymous corpus)
- `web/lib/search/` — hybrid FTS + pgvector search, corpus adapter
- `web/lib/groq.ts` — LLM (chat, stylist, vision)
- `web/convex/` — auth, saves, taste profile, search history

## Data flow

```
Brand connects (Shopify OAuth)  ─┐
Anonymous crawl (curated stores) ─┤→  products corpus (Postgres + pgvector)
                                  │      • source: 'connected' | 'crawl'
                                  │      • published: gated by brand approval
                                  ▼
                         hybrid search (FTS + vector)
                                  ▼
                          shopper search results
```

A connected brand's products only become visible to shoppers
(`published = TRUE`) after the operator approves the brand in `/admin`.

## Keeping the sides from intermixing

- Brand-only code imports from `features/brands/*`, `lib/shopify/*`,
  `lib/brands/*`. Shopper code does not import these, and vice versa.
- The only shared surface is the backend libs above and the Postgres schema.
- When adding a feature, put pages under the right route group and API routes
  under the matching `api/` namespace.
