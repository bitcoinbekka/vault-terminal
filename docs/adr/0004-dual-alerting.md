# ADR 0004 — Dual alerting: client watcher + server-side 24/7 watcher

- **Status:** Accepted
- **Date:** 2026-08-14

## Context

Price alerts are the primary "don't stare at the screen" feature. A browser
can only check prices while a tab is open; users also wanted alerts that fire
with the app closed ("wake me even with the app closed").

## Decision

Ship **two complementary watchers** over the same Nostr alert event
(`vault:alerts`):

1. **Client watcher** (`src/components/terminal/AlertWatcher.tsx`) — mounted in
   the layout; polls active alerts every 60s using TanStack Query keys shared
   with the rest of the app (dedupe). Fires a browser notification + WebAudio
   beep, toasts in-app, and marks the alert `firedAt` on Nostr. Zero
   infrastructure.
2. **Server watcher** (`server/alerts-watcher.mjs`) — Node 18+ companion that
   runs on the user's VPS (systemd unit included). Reads alerts straight from
   Nostr, polls Yahoo server-side (no CORS), and on trigger:
   - sends an **encrypted NIP-17 gift-wrapped DM** to the owner (appears in
     any Nostr client),
   - optionally POSTs a JSON webhook (ntfy.sh, Discord, etc.),
   - publishes the `firedAt` update so the app's bell shows FIRED.
   Flags: `--once`, `--dry-run`, `--no-dm`. A 10-minute per-alert dedupe
   guard prevents notification storms if the fired-state publish fails.

## Consequences

- Tab-open alerts work everywhere with zero setup; server watcher gives 24/7
  coverage for self-hosters.
- The server watcher needs `VAULT_NSEC` (the owner's key) to sign DM/fired
  updates — acceptable since it runs on the owner's own VPS; documented tradeoff.
- No central push infrastructure; the notification channel is Nostr itself.
