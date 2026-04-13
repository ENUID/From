# OpenAI Setup - Fluid Orbit

## 1. Required environment

Set these values in `web/.env.local`:

```env
OPENAI_API_KEY=your-openai-api-key
OPENAI_EMBED_MODEL=text-embedding-3-small
OPENAI_EMBED_DIMENSIONS=768
OPENAI_CHAT_MODEL=gpt-4o-mini
```

## 2. Install dependencies

```bash
cd web
npm install
```

## 3. Build production

```bash
cd web
npm run build
npm run start
```

## 4. AI status endpoint

```bash
GET http://localhost:3000/api/ai/embed
```

Example response:

```json
{
  "embed_status": {
    "total": 50,
    "embedded": 10,
    "pending": 40,
    "processing": 0,
    "failed": 0
  },
  "ai": {
    "configured": true,
    "provider": "openai",
    "models": ["gpt-4o-mini", "text-embedding-3-small"],
    "embed_model": "text-embedding-3-small",
    "chat_model": "gpt-4o-mini",
    "embed_dimensions": 768
  }
}
```

## 5. Architecture

```text
Buyer chat  -> /api/ai/chat      -> OpenAI API (intent + embed + format)
                                 -> Convex vectorSearch

Shopify sync -> /api/shopify/sync -> Convex upsert
                                   -> products.embedding_status = pending

Embed route  -> /api/ai/embed      -> OpenAI embeddings
                                   -> Convex save vector / mark failed

Convex       -> stores product data + vector search, no direct AI calls
```
