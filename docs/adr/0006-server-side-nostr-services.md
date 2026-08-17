# ADR 0006 — Server-side Nostr companion services

- **Status:** Accepted
- **Date:** 2026-08-17

## Context

Beyond the browser app, several capabilities only make sense as background
processes on the owner's VPS: 24/7 price alerts (the browser is often closed),
hourly price snapshots (personal history), SEC fundamentals (browser can't
reach EDGAR — no CORS), and — planned — an AI filing analyzer. All must stay
decentralized and keep user data encrypted.

## Decision

Run **Nostr-driven worker services** on the owner's VPS, one per concern, all
sharing the same shape (`server/*.mjs`):

- **`alerts-watcher.mjs`** — reads the owner's encrypted alerts, polls Yahoo
  server-side (no CORS server-side), sends NIP-17 encrypted DMs + optional
  webhook, re-encrypts and publishes `firedAt`.
- **`market-snapshot.mjs`** — reads the encrypted watchlist, snapshots quotes
  hourly, publishes encrypted `vault:snapshot:<SYMBOL>:<hour>` events
  (`t`-tagged so each symbol's series is relay-queryable).
- **`sec-fundamentals.mjs`** — reads the encrypted watchlist, filters US
  equities, pulls annual 10-K figures from SEC EDGAR (free structured XBRL),
  publishes encrypted `vault:fundamentals:<SYMBOL>` reports.
- **`analyzer.mjs` (planned)** — watches Nostr for encrypted analysis-request
  events the app publishes, fetches the document (SEC text or a Blossom PDF),
  runs a **model-agnostic** LLM over an OpenAI-compatible endpoint
  (`ANALYZER_BASE_URL` + `ANALYZER_API_KEY` — DeepSeek, OpenAI, or local
  Ollama all work), and publishes the encrypted report back to Nostr.

Shared rules:

- All services take `VAULT_NSEC` + `VAULT_RELAYS` from
  `/etc/vault-alerts.env` (systemd `EnvironmentFile`, or sourced by cron —
  cron jobs do **not** read the systemd file, so they `set -a && .` it first).
- All content is NIP-44 encrypted to the owner; the owner's key lives only on
  the owner's VPS (a documented tradeoff: a personal bot on personal hardware).
- No open ports on the VPS — the app triggers via Nostr events, services reply
  via Nostr events.

## Consequences

- Truly decentralized: data lives on Nostr, compute lives on the owner's box,
  and no third-party infrastructure is required.
- The owner's nsec on the VPS is the risk surface — mitigated by the file
  being root-only on hardware they control; an optional "dedicated watcher
  key" (dual-encryption) is a documented future path for those who want the
  main key entirely off the server.
- Freshness depends on the external feed (Yahoo/CBOE/SEC are delayed or daily),
  not on the services.
