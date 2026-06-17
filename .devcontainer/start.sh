#!/usr/bin/env bash
# Runs every time the Codespace starts. Starts the Next.js dev server
# in the background so the port is forwarded immediately.
set -e

# Derive the public URL from the Codespace name (set by GitHub automatically)
if [ -n "$CODESPACE_NAME" ]; then
  export NEXTAUTH_URL="https://${CODESPACE_NAME}-3000.app.github.dev"
else
  export NEXTAUTH_URL="http://localhost:3000"
fi

echo "Starting FROM dev server at ${NEXTAUTH_URL} …"
cd "$(dirname "$0")/../web"

# Start Next.js dev server; log to /tmp so it's inspectable
NEXTAUTH_URL="$NEXTAUTH_URL" npm run dev > /tmp/nextjs.log 2>&1 &
echo $! > /tmp/nextjs.pid

# Tail the log for a few seconds so postStartCommand output is visible
sleep 5
echo "--- Server log (last 20 lines) ---"
tail -20 /tmp/nextjs.log || true
echo "----------------------------------"
echo "Dev server running. Visit port 3000 → /discover"
