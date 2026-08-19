# ADR 0007 — Hashed tags for derived datasets + client-side privacy mode

- **Status:** Accepted
- **Date:** 2026-08-19

## Context

A security audit (docs/SECURITY.md) found that while all user-data `content`
is NIP-44 encrypted, derived events (hourly snapshots, SEC fundamentals, AI
analysis reports) exposed the **symbol in plaintext** in their `d`/`t` tags —
an observer could learn *which* symbols the owner tracks. Separately, users
wanted to share their screen without exposing quantities or dollar amounts.

## Decision

1. **Hashed symbol keys in tags.** All derived-dataset `d`/`t` tag values use
   `symKey(symbol)` — SHA-256 of the uppercase symbol, hex, first 16 chars —
   computed client-side with `crypto.subtle` and server-side with
   `node:crypto`. The symbol itself only ever appears inside the encrypted
   content. Exact-`#d` lookups (fundamentals, analysis) and `#t` lookups
   (snapshots) keep working because both sides derive the same key.
2. **Privacy mode.** A persisted client-side toggle (`usePrivacyMode`,
   shared via `useSyncExternalStore`) plus a `Mask` component renders `••••`
   for quantities, cost bases, values, P/L, totals, allocation %, and option
   payoff amounts across the portfolio/watchlist. Public market prices stay
   visible so the screen remains useful when shared.

## Consequences

- Metadata exposure reduced to "this pubkey publishes derived events" — not
  which symbols.
- Old plaintext-tagged events are not found by the new lookups; services
  re-publish with hashed tags on their schedules (snapshots hourly, SEC
  daily, analysis on demand). Acceptable for a personal app.
- Privacy mode is a UI-layer mask — it does not change what's stored or
  published; it's for screen sharing.
