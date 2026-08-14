# Vault Terminal — Custom Nostr Schema

This document describes the custom data schemas defined by Vault Terminal (this project).

All app data uses the existing **NIP-78 (Application-specific Data)** event kind `30078`,
keyed by a `d` tag prefixed with `vault:`. No new event kinds are introduced.

## Watchlist (`d` = `vault:watchlist`)

Stores the tickers the user follows. Symbols are mirrored into single-letter `t` tags so
they remain queryable at the relay level.

**Tags**

| Tag | Values | Purpose |
| --- | --- | --- |
| `d` | `vault:watchlist` | Addressable identifier |
| `t` | uppercase symbol, e.g. `AAPL` | Queryable symbol list (one per ticker) |
| `client` | hostname | Added automatically by the publish hook (NIP-89) |

**Content** (JSON):

```json
{
  "version": 1,
  "symbols": ["AAPL", "MSFT", "NVDA"]
}
```

## Positions (`d` = `vault:positions`)

Stores the user's portfolio: equity shares and option contracts.

**Tags**

| Tag | Values | Purpose |
| --- | --- | --- |
| `d` | `vault:positions` | Addressable identifier |
| `client` | hostname | Added automatically by the publish hook |

**Content** (JSON):

```json
{
  "version": 1,
  "positions": [
    {
      "symbol": "AAPL",
      "quantity": 10,
      "avgCost": 180.5,
      "note": "Long-term hold"
    },
    {
      "symbol": "AAPL",
      "contract": "AAPL260919C00200000",
      "strike": 200,
      "expiry": 1790035200,
      "optionType": "C",
      "quantity": 2,
      "avgCost": 3.2,
      "note": ""
    }
  ]
}
```

**Field semantics**

- `symbol` — underlying ticker (uppercase).
- `quantity` — number of shares, or number of option contracts.
- `avgCost` — average cost per share, or per contract (not per 100-share lot).
- `contract` — OCC option symbol (e.g. `AAPL260919C00200000`); present only for option positions.
- `strike` / `expiry` / `optionType` — parsed from the OCC contract; denormalized for convenience.
- `note` — optional free-text.

## Alerts (`d` = `vault:alerts`)

Stores the user's price alerts. Checked client-side every 60s while the terminal
is open; fires browser notifications + sound when a condition is met, then marks
the alert as fired (re-armable).

**Tags**

| Tag | Values | Purpose |
| --- | --- | --- |
| `d` | `vault:alerts` | Addressable identifier |
| `client` | hostname | Added automatically by the publish hook |

**Content** (JSON):

```json
{
  "version": 1,
  "alerts": [
    {
      "id": "cryptographic-uuid",
      "symbol": "NVDA",
      "direction": "above",
      "value": 520,
      "note": "Breakout level",
      "createdAt": 1786730000,
      "firedAt": 1786733600
    }
  ]
}
```

**Field semantics**

- `direction` — `above` (price > value), `below` (price < value), `pctUp`
  (gains ≥ value % vs previous close), `pctDown` (falls ≥ value %).
- `value` — target price for above/below, target percent for pctUp/pctDown.
- `createdAt` / `firedAt` — unix seconds; `firedAt` absent while armed.

## Trade Journal (`d` = `vault:trades`)

Stores the user's logged buy/sell trades. Realized P/L, win rate and average
hold time are computed client-side with FIFO cost-basis accounting
(see `src/lib/journal.ts`).

**Tags**

| Tag | Values | Purpose |
| --- | --- | --- |
| `d` | `vault:trades` | Addressable identifier |
| `client` | hostname | Added automatically by the publish hook |

**Content** (JSON):

```json
{
  "version": 1,
  "trades": [
    {
      "id": "cryptographic-uuid",
      "symbol": "NVDA",
      "side": "buy",
      "quantity": 10,
      "price": 480.5,
      "date": 1786550000,
      "fees": 0.5,
      "note": "Breakout retest"
    }
  ]
}
```

**Field semantics**

- `side` — `buy` opens a lot, `sell` closes lots FIFO (oldest first).
- `quantity` — shares (option contracts are logged at 1× contract count).
- `price` — execution price.
- `date` — unix seconds of execution.
- `fees` — optional, subtracted from realized P/L.

## Queries

All events are read with the same author-constrained pattern (shown here for
the watchlist):

```ts
nostr.query([{ kinds: [30078], authors: [user.pubkey], '#d': ['vault:watchlist'], limit: 1 }]);
nostr.query([{ kinds: [30078], authors: [user.pubkey], '#d': ['vault:positions'], limit: 1 }]);
```

`authors` is always constrained — this is user-owned data; the `d` tag alone is not a trust boundary.

## Market data

Quotes, charts, search and trending: Yahoo Finance (`query1.finance.yahoo.com`), fetched through the
Shakespeare CORS proxy with a direct-fetch fallback. Options chains: CBOE delayed quotes CDN
(`cdn.cboe.com`). All market data is delayed and informational only — not financial advice.
