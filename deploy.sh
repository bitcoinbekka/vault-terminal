#!/usr/bin/env bash
#
# Vault Terminal — one-command VPS update.
#
# Pulls the latest code, installs deps, rebuilds with your domain baked in,
# and reloads nginx. Run it from the project directory on the VPS:
#
#   ./deploy.sh
#
# Set your domain once (or pass it as an argument):
#   VITE_MARKET_BASE=https://vault.plebeian.build ./deploy.sh
#   ./deploy.sh https://vault.plebeian.build
#
set -euo pipefail

cd "$(dirname "$0")"

DOMAIN="${1:-${VITE_MARKET_BASE:-}}"
if [[ -z "$DOMAIN" ]]; then
  echo "ERROR: set VITE_MARKET_BASE or pass your domain as an argument." >&2
  echo "  e.g. ./deploy.sh https://vault.plebeian.build" >&2
  exit 1
fi

echo "==> git pull"
git pull

echo "==> npm ci"
npm ci

echo "==> building with VITE_MARKET_BASE=$DOMAIN"
VITE_MARKET_BASE="$DOMAIN" npm run build

echo "==> nginx"
sudo nginx -t
sudo systemctl reload nginx

echo "==> done: $DOMAIN is live"
