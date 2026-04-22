# Fluid Orbit 🌌

**Fluid Orbit** is an AI Shopping OS, **YOU** describes what you want, and AI Agents finds the best, trusted, quality products from independent Brand/Stores, no ads/sponsors, no marketplace manipulation. you can search, compare, buy, and receive products, with tryons, comparison, agentic checkout, tracking and delivery and more all handled in a single chat.

## 🚀 Live Demo
- **Fluid Orbit**: [https://fo.enuid.com](https://fo.enuid.com)
- **Brand/Store Dashboard**: [https://store.enuid.com](https://store.enuid.com)

## ✨ Features
- **Intent-Based Search**: Buyers can search for products using natural language (e.g., "Handmade leather boots under $200").
- **Subdomain Routing**: Dedicated spaces for Buyers (`fo.`) and Merchants (`store.`).
- **Smart Catalog Sync**: Automated product synchronization from Shopify with vector embedding for semantic search.
- **Premium UI**: Minimalist, human-centric design with smooth transitions and intent-focused layout.

## 🛠️ Architecture
- **Framework**: Next.js 15
- **Backend**: [Convex](https://www.convex.dev/) (Real-time database & Vector search)
- **AI**: OpenAI (GPT-4o-mini & Text-Embedding-3-Small)
- **OAuth**: Google & Shopify Integration

## 📂 Documentation
- [OpenAI Configuration](./OPENAI_SETUP.md)
- [Partner Handoff Guide](./PARTNER_HANDOFF.md)

## ⚡ Quick Start

### 1. Installation
```powershell
# Root dependencies
npm install

# Web dependencies
cd web
npm install
```

### 2. Environment Setup
Copy `.env.example` to `.env.local` in both root and `web/` directories and fill in your credentials.

### 3. Development
```powershell
# Start Convex
npm run dev:convex

# Start Next.js (in another terminal)
cd web
npm run dev
```

---
Built by [ENUID](https://github.com/ENUID)
