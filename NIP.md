# Vault Terminal — Custom Nostr Schema

This document describes the custom data schemas defined by Vault Terminal (this project).

All app data uses the existing **NIP-78 (Application-specific Data)** event kind `30078`,
keyed by a `d` tag prefixed with `vault:`. No new event kinds are introduced.

## Encryption (NIP-44)

All four user datasets (watchlist, positions, alerts, trades) are **encrypted to the
owner's own pubkey** with **NIP-44** — the same cipher used by NIP-17 gift-wrapped DMs.

- The event's `content` is the NIP-44 ciphertext of the JSON shown below.
- An `enc` tag (`["enc", "nip44"]`) marks the event as encrypted.
- Only the owner's signer (`nsec` / NIP-07 extension / NIP-46 remote signer) — or the
  server-side alert watcher, which holds the owner's nsec — can decrypt.
- Legacy events written before encryption (no `enc` tag) remain readable via the plaintext
  schema; clients attempt decryption first, then fall back to plaintext.

## Watchlist (`d` = `vault:watchlist`)

Stores the tickers the user follows.

**Tags**

| Tag | Values | Purpose |
| --- | --- | --- |
| `d` | `vault:watchlist` | Addressable identifier |
| `enc` | `nip44` | Content is NIP-44 ciphertext (owner-only) |
| `client` | hostname | Added automatically by the publish hook (NIP-89) |

**Content** (plaintext JSON, then encrypted):

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
| `enc` | `nip44` | Content is NIP-44 ciphertext (owner-only) |
| `client` | hostname | Added automatically by the publish hook |

**Content** (plaintext JSON, then encrypted):

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
the alert as fired (re-armable). The server-side watcher decrypts and re-encrypts
these events with the owner's nsec.

**Tags**

| Tag | Values | Purpose |
| --- | --- | --- |
| `d` | `vault:alerts` | Addressable identifier |
| `enc` | `nip44` | Content is NIP-44 ciphertext (owner-only) |
| `client` | hostname | Added automatically by the publish hook |

**Content** (plaintext JSON, then encrypted):

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
| `enc` | `nip44` | Content is NIP-44 ciphertext (owner-only) |
| `client` | hostname | Added automatically by the publish hook |

**Content** (plaintext JSON, then encrypted):

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

## Market Snapshots (`d` = `vault:snapshot:<SYMBOL>:<unix-hour>`)

Written by the server-side snapshot pusher (`server/market-snapshot.mjs`) on the
owner's VPS — usually hourly — to build a private, decentralized price history.
One addressable event per symbol per hour, so relays retain the full series.

**Tags**

| Tag | Values | Purpose |
| --- | --- | --- |
| `d` | `vault:snapshot:AAPL:1786734000` | Hour-bucketed addressable id |
| `t` | uppercase symbol | Relay-queryable per symbol |
| `enc` | `nip44` | Content is NIP-44 ciphertext (owner-only) |
| `client` | hostname | Added by the publish path where present |

**Content** (plaintext JSON, then encrypted):

```json
{
  "version": 1,
  "symbol": "AAPL",
  "name": "Apple Inc.",
  "price": 305.85,
  "prevClose": 305.26,
  "changePct": 0.19,
  "volume": 15762797,
  "ts": 1786734000
}
```

Read via `{ kinds: [30078], authors: [owner], '#t': [symbol], limit: 24 }` and
filtered by the `d` prefix. Snapshots are market data (not financial advice).

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
