# ADR 0001 — Market data via Yahoo Finance + CBOE through a layered CORS strategy

- **Status:** Accepted
- **Date:** 2026-08-14

## Context

The terminal needs quotes, OHLCV candles, symbol search, news, trending symbols
and options chains. Options considered:

- **Paid feeds** (Finnhub, Polygon, etc.): reliable but require API keys, cost
  money, and add signup friction for users.
- **Free feeds without keys**: Yahoo Finance (quotes/charts/search/trending)
  and the CBOE delayed-quotes CDN (options with full greeks) are excellent —
  but **neither sends CORS headers**, so browsers refuse to read them directly.
- **The platform CORS proxy** (`https://proxy.shakespeare.diy/?url=…`) is the
  documented mechanism but has been observed intermittently down (HTTP 522).

## Decision

1. **Data sources:** Yahoo Finance `query1.finance.yahoo.com` for chart, search,
   trending and quotes; CBOE `cdn.cboe.com` delayed-quotes API for options
   chains (OCC contract symbols, full greeks, vol/OI). All delayed, all free.
2. **Fetch strategy (`src/lib/yahoo.ts`, `buildAttempts()`)** — try in order:
   1. A **same-origin reverse proxy** when `VITE_MARKET_BASE` is set
      (`/yahoo/*` and `/cboe/*` paths — zero CORS needed).
   2. A **CORS proxy** using the `?url=` convention (`VITE_CORS_PROXY`, or the
      Shakespeare default).
   3. A **direct fetch** (works only where CORS is relaxed).
3. Responses that are not JSON (e.g. HTML error pages) are treated as failures
   and the next attempt is tried. Every panel renders a graceful error/empty
   state plus a retry affordance when the feed is unreachable.

## Consequences

- No API keys or paid subscriptions required; the app works out of the box.
- Data is **delayed, not real-time** — positioning the product as
  decision-support rather than execution.
- When `proxy.shakespeare.diy` is down, the app shows a "Market feed
  unavailable" banner with a retry button; panels degrade gracefully.
- Self-hosters can eliminate the dependency entirely (see ADR 0005).
