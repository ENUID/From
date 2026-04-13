# Partner Handoff

This project handoff is intentionally sanitized.

It does not include:
- real `.env` or `.env.local` files
- Google, Shopify, NextAuth, or Convex secrets
- `node_modules`
- Next build output such as `web/.next`
- local log files
- the duplicate `fo/` copy

## What Your Partner Needs

1. Node.js 18+ installed.
2. Their own credentials for:
   - Convex
   - Google OAuth
   - Shopify OAuth
   - NextAuth secret
   - OpenAI API

## Setup

### Root

Copy `.env.example` to `.env.local` or `.env` and fill in Convex values.

Install root dependencies:

```powershell
npm install
```

### Web App

Copy `web/.env.example` to `web/.env.local` and fill in the required values.

Install web dependencies:

```powershell
cd web
npm install
```

## Run

From the project root:

```powershell
npm run dev:convex
```

In another terminal:

```powershell
cd web
npm run dev
```

If local `next dev` is restricted in the environment, they can still use:

```powershell
cd web
npm run build
npm run start
```

## Notes

- Buyer search will return empty results until a real store is connected and synced.
- Merchant login requires valid Google OAuth configuration.
- Shopify onboarding requires a valid Shopify app configuration.
- AI chat and embedding now use OpenAI API, not local Ollama.
- The current package excludes your personal secrets on purpose.
