# ADR 0005 — Env-configurable data path for self-hosting

- **Status:** Accepted
- **Date:** 2026-08-14

## Context

The app runs in the Shakespeare preview out of the box, but users may want to
host it on their own VPS. The only external dependency that can break is the
browser CORS problem for Yahoo/CBOE (see ADR 0001).

## Decision

Make the market-data path **build-time configurable** with no code changes for
different hosts:

- `VITE_MARKET_BASE=https://vault.example.com` — enables a **same-origin
  reverse proxy** mode: the app fetches `/yahoo/*` and `/cboe/*` on the app's
  own origin, which needs **no CORS headers at all** (recommended).
- `VITE_CORS_PROXY=…` — overrides the `?url=` CORS proxy (defaults to
  `https://proxy.shakespeare.diy/?url=`).
- Neither set → default behavior (proxy, then direct).

Supporting files:

- `deploy/nginx-vault.conf` — serves `dist/` with SPA fallback and reverse
  proxies `/yahoo/` and `/cboe/` to the upstream hosts on the same origin
  (standard 80/443 path, TLS via certbot).
- `deploy/nginx-vault-internal.conf` — variant for hosts where another web
  server already owns 80/443 (e.g. a Caddy container). nginx listens on port
  **8081 on all interfaces** (a Docker bridge container cannot reach the host's
  loopback) and Caddy fronts it with `reverse_proxy <bridge-gateway>:8081`,
  handling TLS itself (no certbot). Real-world lesson from the first
  deployment: get the upstream IP from `docker network inspect`, not a guess.
- `.env.example` — documents the build-time variables.
- `server/.env.example` + `server/vault-alerts.service` — companion-service
  config and systemd unit for the VPS.

The app remains fully functional in the hosted preview with no configuration.

## Consequences

- Self-hosted installs have **zero third-party dependency** for market data.
- HTTPS is required (wss relays + secure-context APIs) — noted in the nginx
  config via certbot instructions.
- Env vars are read defensively (`import.meta.env` access is guarded) so the
  build never breaks when they are absent.
