# ADR 0003 — Client-side analytics: indicators, FIFO journal, options math

- **Status:** Accepted
- **Date:** 2026-08-14

## Context

We wanted technical indicators, realized P/L accounting, and options risk
metrics — without adding charting libraries, backend services, or paid data.

## Decision

Implement all analytics as **pure client-side functions** over data we already
fetch (OHLCV candles, option chains, logged trades):

- `src/lib/indicators.ts` — SMA, EMA, RSI (Wilder), MACD, Bollinger Bands,
  VWAP. All return arrays aligned to the input with `null` until warm-up.
- `src/lib/journal.ts` — FIFO cost-basis engine over logged trades: realized
  P/L (gross and net of fees), win rate, quantity-weighted average hold time,
  open lots per symbol, realized P/L per symbol.
- `src/lib/options.ts` — expected move from the ATM straddle (~1σ to expiry),
  breakevens, per-contract payoff at expiry, max profit/loss.
- `src/components/terminal/CandleChart.tsx` — a custom SVG candlestick chart
  (no chart library) with volume bars, gridlines, crosshair tooltip, and
  toggleable overlay lines + RSI/MACD strips rendered from the indicator lib.

TanStack Query caches the source data (60s–5min stale times) so analytics
recompute cheaply and dedupe across panels (watchlist, tape, portfolio, movers
all share quote query keys).

## Consequences

- Zero new runtime dependencies and no server-side compute.
- Deterministic, auditable math (FIFO matches broker-style accounting).
- Custom chart keeps the Bloomberg aesthetic and full styling control, at the
  cost of maintaining the SVG code ourselves.
- Expected-move and IV comparisons are absolute heuristics (e.g. "RICH" = IV ≥
  60%) rather than historical percentiles — no IV history is available from
  the free feed.
