#!/usr/bin/env bash
# Codespaces setup — installs deps and writes a minimal .env.local so the
# app boots. The discovery feed (/discover) works with no secrets because it
# falls back to live UCP store crawling. Add DATABASE_URL / GROQ_API_KEY etc.
# as Codespace secrets to enable the full app.
set -e

cd "$(dirname "$0")/../web"

echo "Installing dependencies…"
npm install

# Only create .env.local if it doesn't already exist (Codespace secrets win)
if [ ! -f .env.local ]; then
  echo "Writing starter .env.local…"
  cat > .env.local <<'EOF'
# Public Convex URL (safe, client-side by design)
NEXT_PUBLIC_CONVEX_URL=https://tangible-shrimp-237.convex.cloud
NEXTAUTH_SECRET=dev-preview-secret-change-me
EOF
fi

# Layer in any Codespace secrets that are present in the environment
{
  [ -n "$DATABASE_URL" ]   && echo "DATABASE_URL=$DATABASE_URL"
  [ -n "$GROQ_API_KEY" ]   && echo "GROQ_API_KEY=$GROQ_API_KEY"
  [ -n "$OPENAI_API_KEY" ] && echo "OPENAI_API_KEY=$OPENAI_API_KEY"
  [ -n "$CRON_SECRET" ]    && echo "CRON_SECRET=$CRON_SECRET"
} >> .env.local

# NEXTAUTH_URL is set dynamically at start time using $CODESPACE_NAME
# (can't hardcode here because name isn't known until runtime)

echo "Setup complete."
