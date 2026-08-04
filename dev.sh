#!/usr/bin/env bash
# Start the BFF and the Vite dev server together.
#
#   ./dev.sh
#
# Ctrl-C stops both. Backend logs are prefixed [api], frontend [web].
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_PORT=4000
WEB_PORT=5173

if [ ! -f "$REPO/server/.env" ]; then
  echo "server/.env is missing — copy server/.env.example and fill it in." >&2
  exit 1
fi

for dir in server client; do
  if [ ! -d "$REPO/$dir/node_modules" ]; then
    echo "==> Installing $dir dependencies"
    npm install --prefix "$REPO/$dir"
  fi
done

# Reclaim the ports so a stale process from a previous run can't silently win
# the bind and leave you looking at old code.
for port in $API_PORT $WEB_PORT; do
  pids=$(lsof -ti :$port 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "==> Freeing port $port ($pids)"
    kill -9 $pids 2>/dev/null || true
  fi
done

pids=()
cleanup() {
  trap - INT TERM EXIT
  echo
  echo "==> Stopping"
  for pid in "${pids[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
}
trap cleanup INT TERM EXIT

npm start --prefix "$REPO/server" 2>&1 | sed "s/^/[api] /" &
pids+=($!)

npm run dev --prefix "$REPO/client" 2>&1 | sed "s/^/[web] /" &
pids+=($!)

echo "==> api  http://localhost:$API_PORT"
echo "==> web  http://localhost:$WEB_PORT"
echo "==> Ctrl-C to stop both"

wait
