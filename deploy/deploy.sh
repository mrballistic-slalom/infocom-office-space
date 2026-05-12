#!/usr/bin/env bash
#
# Build the SPA + server locally and rsync them to an Ubuntu host running
# pm2 + Apache (or Nginx). Server-side state changes:
#   - SPA: /var/www/initech (owned by www-data, read-only to others)
#   - Server: /opt/initech-backend (owned by initech user, pm2 process)
#   - Env file: /etc/initech.env (created out-of-band, 0640 root:initech)
#
# Usage:
#   DEPLOY_HOST=user@your.server.com ./deploy/deploy.sh
#   DEPLOY_HOST=... DEPLOY_REMOTE_USER=initech ./deploy/deploy.sh

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

: "${DEPLOY_HOST:?Set DEPLOY_HOST=user@your.server}"
DEPLOY_WEB_ROOT="${DEPLOY_WEB_ROOT:-/var/www/initech}"
DEPLOY_BACKEND_DIR="${DEPLOY_BACKEND_DIR:-/opt/initech-backend}"

echo ">>> Building SPA"
npm ci
npm run build

echo ">>> Building server"
( cd server && npm ci && npm run build )

echo ">>> Syncing SPA → $DEPLOY_HOST:$DEPLOY_WEB_ROOT"
rsync -avz --delete --chmod=Du=rwx,Dgo=rx,Fu=rw,Fgo=r \
    dist/ "$DEPLOY_HOST:$DEPLOY_WEB_ROOT/"

echo ">>> Syncing backend → $DEPLOY_HOST:$DEPLOY_BACKEND_DIR"
# Ship dist/, package.json, package-lock.json, ecosystem manifest.
# DO NOT ship node_modules — install on the server so native bindings match.
rsync -avz --delete \
    server/dist/                   "$DEPLOY_HOST:$DEPLOY_BACKEND_DIR/dist/"
rsync -avz \
    server/package.json \
    server/package-lock.json \
    server/ecosystem.config.cjs \
    "$DEPLOY_HOST:$DEPLOY_BACKEND_DIR/"

echo ">>> Installing production deps + reloading pm2 (zero-downtime)"
ssh "$DEPLOY_HOST" bash -s <<EOF
set -euo pipefail
cd "$DEPLOY_BACKEND_DIR"
npm ci --omit=dev
# 'pm2 reload' replaces workers one at a time — no dropped requests.
# If the app isn't running yet, fall back to 'start'.
if pm2 describe initech-backend >/dev/null 2>&1; then
  pm2 reload ecosystem.config.cjs --env production --update-env
else
  pm2 start ecosystem.config.cjs --env production
  pm2 save
fi
pm2 status initech-backend
EOF

echo ">>> Smoke test"
ssh "$DEPLOY_HOST" 'curl -fsS http://127.0.0.1:3001/health' && echo
echo ">>> Done."
