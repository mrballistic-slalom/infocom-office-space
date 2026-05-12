#!/usr/bin/env bash
#
# In-place deploy: build from this checkout and update /var/www/initech and
# /opt/initech-backend on the same machine. Use this when SSH'd into the
# Ubuntu host. For deploying *to* a remote host from your laptop, use
# deploy/deploy.sh instead.
#
# Workflow:
#   cd ~/src/initech-terminal
#   git pull
#   ./deploy/deploy-local.sh
#
# Requires sudo (writes /var/www/initech, /opt/initech-backend, switches to
# the initech user for pm2). Will prompt for password if not cached.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

WEB_ROOT="${WEB_ROOT:-/var/www/initech}"
BACKEND_DIR="${BACKEND_DIR:-/opt/initech-backend}"
BACKEND_USER="${BACKEND_USER:-initech}"
WEB_USER="${WEB_USER:-www-data}"
WEB_GROUP="${WEB_GROUP:-$WEB_USER}"
ENV_FILE="${ENV_FILE:-/etc/initech.env}"

# Preflight sanity.
if [[ ! -f package.json ]]; then
  echo "ERROR: not inside the repo root (no package.json found)" >&2
  exit 1
fi
if [[ ! -d server ]]; then
  echo "ERROR: server/ directory missing — wrong branch? (need 'selfhost-gemini')" >&2
  exit 1
fi
if [[ ! -r "$ENV_FILE" ]] && ! sudo test -r "$ENV_FILE"; then
  echo "ERROR: $ENV_FILE missing — see deploy/README.md for one-time setup" >&2
  exit 1
fi
if ! id "$BACKEND_USER" >/dev/null 2>&1; then
  echo "ERROR: user '$BACKEND_USER' does not exist — see deploy/README.md" >&2
  exit 1
fi
for cmd in node npm pm2 rsync sudo; do
  command -v "$cmd" >/dev/null || { echo "ERROR: '$cmd' not in PATH"; exit 1; }
done

echo ">>> [1/5] Building SPA"
npm ci
npm run build

echo
echo ">>> [2/5] Building server"
( cd server && npm ci && npm run build )

echo
echo ">>> [3/5] Publishing SPA → $WEB_ROOT"
sudo mkdir -p "$WEB_ROOT"
sudo rsync -a --delete --chown="$WEB_USER:$WEB_GROUP" dist/ "$WEB_ROOT/"

echo
echo ">>> [4/5] Publishing server → $BACKEND_DIR"
sudo mkdir -p "$BACKEND_DIR"
sudo rsync -a --delete --chown="$BACKEND_USER:$BACKEND_USER" \
    server/dist/ "$BACKEND_DIR/dist/"
sudo install -o "$BACKEND_USER" -g "$BACKEND_USER" -m 0644 \
    server/package.json \
    server/package-lock.json \
    server/ecosystem.config.cjs \
    -t "$BACKEND_DIR/"

echo
echo ">>> [5/5] Installing prod deps + pm2 reload (zero-downtime)"
# Drop into the backend user so node_modules ownership stays correct and pm2
# operates on the right HOME (~/.pm2). Login shell so PATH picks up node/pm2.
# Source $ENV_FILE so APP_PASSWORD / JWT_SECRET / GEMINI_KEY are visible to
# `pm2 reload --update-env` (pm2 snapshots the env at reload time).
sudo -u "$BACKEND_USER" -H bash -lc "
  set -euo pipefail
  set -a; source '$ENV_FILE'; set +a
  cd '$BACKEND_DIR'
  npm ci --omit=dev
  if pm2 describe initech-backend >/dev/null 2>&1; then
    pm2 reload ecosystem.config.cjs --env production --update-env
  else
    pm2 start ecosystem.config.cjs --env production
    pm2 save
  fi
  pm2 status initech-backend
"

echo
echo ">>> Smoke test /health"
# Tiny grace period for cluster workers to take traffic again.
sleep 1
curl -fsS http://127.0.0.1:3001/health && echo
echo ">>> Done."
