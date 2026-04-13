# Ollama Setup - Fluid Orbit

## 1. Cai Ollama
```bash
# macOS / Linux
curl -fsSL https://ollama.ai/install.sh | sh
# Windows: https://ollama.ai/download
```

## 2. Pull models
```bash
ollama pull nomic-embed-text
ollama pull llama3.2:3b
# hoac llama3.1:8b neu may co RAM lon hon
```

## 3. Chay Ollama
```bash
ollama serve
```

## 4. Push Convex dev schema/functions
```bash
npx convex dev --once --tail-logs disable
```

## 5. Chay Next.js
```bash
cd web
npm install
npm run dev
```

## 6. Kiem tra status
```bash
GET http://localhost:3000/api/ai/embed
```

Response mau:
```json
{
  "embed_status": {
    "total": 50,
    "embedded": 10,
    "pending": 40,
    "processing": 0,
    "failed": 0
  },
  "ollama": {
    "running": true,
    "models": ["nomic-embed-text:latest", "llama3.2:3b"]
  }
}
```

## 7. Queue-based embedding worker
Sync Shopify chi upsert products va danh dau `embedding_status=pending`.
Embedding khong con phu thuoc vao route noi bo co session.

Chay worker:
```bash
npm run worker:embed
```

Re-index tat ca:
```bash
npm run worker:embed -- --force
```

Chay 1 batch duy nhat:
```bash
npm run worker:embed -- --once --limit=20
```

## 8. Architecture
```text
Buyer chat  -> /api/ai/chat      -> Ollama (intent + embed + format)
                                 -> Convex vectorSearch

Shopify sync -> /api/shopify/sync -> Convex upsert
                                   -> products.embedding_status = pending

Worker       -> npm run worker:embed -> Convex claim queue
                                      -> Ollama embed
                                      -> Convex save vector / mark failed

Convex       -> chi luu data + vector search, khong goi AI truc tiep
```
