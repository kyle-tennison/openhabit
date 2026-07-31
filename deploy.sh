#!/usr/bin/env bash
# Deploy openhabit to the Lightsail box.
#
#   ./deploy.sh
#
# Builds the SPA locally (the box only has ~200 MB of RAM free, so a Vite build
# there is likely to OOM), rsyncs the artifacts up, installs production deps
# with the nvm-managed Node 20, and restarts the service.
#
# First-time setup (systemd unit, nginx vhost, .env, TLS) is not done here —
# see README "Deploying".
set -euo pipefail

HOST=lightsail
APP_DIR=/home/ubuntu/openhabit
WEB_DIR=/webdirectory/openhabit
NODE_BIN=/home/ubuntu/.nvm/versions/node/v20.13.1/bin
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> Building client"
npm run build --prefix "$REPO/client"

echo "==> Syncing server source"
rsync -az --delete \
  --exclude node_modules --exclude .env \
  "$REPO/server/" "$HOST:$APP_DIR/server/"

echo "==> Syncing built SPA"
rsync -az --delete "$REPO/client/dist/" "$HOST:$APP_DIR/client/dist/"

# npm's shebang is `#!/usr/bin/env node`, and /usr/bin/node on the box is v12 —
# so nvm's bin has to be on PATH, not just referenced by absolute path.
echo "==> Installing production dependencies"
ssh "$HOST" "export PATH=$NODE_BIN:\$PATH && cd $APP_DIR/server && npm ci --omit=dev --silent"

echo "==> Publishing SPA to $WEB_DIR"
ssh "$HOST" "sudo rsync -a --delete $APP_DIR/client/dist/ $WEB_DIR/"

echo "==> Restarting service"
ssh "$HOST" "sudo systemctl restart openhabit && sleep 2 && systemctl is-active openhabit"

echo "==> Health check"
ssh "$HOST" "curl -fsS localhost:8124/api/health" && echo
echo "Done: https://openhabit.co"
