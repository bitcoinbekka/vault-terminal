# Vault Terminal — How to Use

Your personal, decentralized Bloomberg-style market terminal. One dark screen
for stocks, options, portfolio, alerts and market news — with your data living
on **Nostr**, so it follows your identity (npub) instead of an app account.

---

## Getting started (30 seconds)

1. Open the app. Click **Join** (top right).
2. Log in with your Nostr identity — paste an `nsec`, connect a browser
   extension, or use a remote signer. No account to create, no email.
3. Done. The **ticker tape** at the top streams indices and your watchlist.

---

## The home screen (Terminal), top to bottom

| Section | What it does |
| --- | --- |
| **Portfolio** | Track the shares & options you own → live day P/L, unrealized/realized/net P/L, allocation bar, best/worst positions, and option payoff diagrams |
| **Market Indices** | S&P 500, NASDAQ, Dow, Russell 2K, VIX with sparklines |
| **Macro Regime** | VIX fear gauge, 10Y yield, gold, silver, BTC, ETH |
| **Watchlist** | Your stocks with live quotes, % change, volume, sparklines |
| **Market Movers** | Gainers, losers, most-active, and 52-week-high breakouts |
| **Sector Rotation** | Which sectors are leading/trailing today (XLK, XLF, XLE…) |
| **Options Flow** | Unusual volume vs open-interest activity in your watchlist's options |
| **Trending + News** | What the market is talking about |

---

## Key actions

**Build your watchlist**
- On any stock page hit **WATCH**, or on the home screen hit **+ ADD** and
  search (works for stocks, indices like `^VIX`, ETFs, even `BTC-USD`).

**Track what you own**
- **TRACK POSITION** on any stock page → add shares (symbol, qty, avg cost) or
  option contracts (paste the OCC contract like `AAPL260919C00200000`).
- **Gold, silver, crypto & FX work too** — quick picks in the dialog (GOLD
  `GC=F`, SILVER `SI=F`, BITCOIN `BTC-USD`, ETHEREUM `ETH-USD`), or type any
  symbol. Quantity = ounces / coins, avg cost per unit; market value tracks
  live.
- Your portfolio then shows live P/L, day P/L, allocation, and for options:
  **breakeven, max profit/loss, and a payoff diagram** with the current price
  marked.

**Never stare at the screen**
- **ALERT** on any stock page → pick "price above / below" or "% up / down",
  set the level. Checked every 60s while the terminal is open → browser
  notification + sound. Manage/re-arm from the **bell icon** in the header.
- Want 24/7 alerts even with the app closed? Run the included **server-side
  watcher** on your VPS — it reads your alerts from Nostr and DMs you (any
  Nostr client) when something fires.

**Keep a trade journal**
- **LOG TRADE** on any stock page, or open the **JOURNAL** page. Log buys/sells
  with price, fees and a note. The app computes your **realized P/L (FIFO),
  win rate, average hold time, and open lots** automatically.

**Options chain**
- Stock page → **OPTIONS** tab → pick an expiry. You'll see the **expected
  move** (±% the market prices in), calls/puts side-by-side with strike, bid/
  ask, volume, open interest, IV and greeks. Click any row to copy the contract.

**Chart analysis**
- Stock page chart → toggle **SMA, EMA, Bollinger, VWAP, RSI, MACD** overlays.
- Hover for OHLCV + indicator values; use 1D→MAX ranges.

**The command line — Bloomberg-style `<GO>`**
- Hit the **`>_` button** in the header (or press **`/`**) to open the command bar.
- Type a ticker or mnemonic and press **Enter (green `<GO>`)**:
  - `AAPL <GO>` — open a stock page (aliases: `SPX`, `NDX`, `VIX`, `GOLD`, `BTC`…)
  - `TOP <GO>` — market news · `MOVERS <GO>` · `SECTOR <GO>` · `REGIME <GO>` · `PORTFOLIO <GO>` · `WATCHLIST <GO>`
  - `EQS <GO>` — open the equity screener
  - `DES NVDA <GO>` / `OPTIONS NVDA <GO>` — jump straight to a stock's overview/options tab
  - `JOURNAL <GO>` · `TERMINAL <GO>` · `HELP <GO>` (command legend)

**Equity screening — `EQS <GO>`**
- The **EQS** page screens the terminal's liquid universe (mega-caps + sector ETFs + your watchlist).
- Filter by min/max % change, minimum volume, minimum price, and proximity to the 52-week high.
- Sort by % change, volume, or 52-week proximity. (Fundamentals like P/E need a paid feed — noted on the page.)

**Position sizing — `SIZER <GO>`**
- Risk-based sizer: account size, risk % per trade, entry and stop → **shares, $ risked, position value, % of account**.
- Hit **SIZER** on any stock page to prefill the symbol and current price.

**Currency converter — `FX <GO>`**
- Live converter for cross-border stocks: USD, CAD, EUR, JPY and 20+ currencies via Yahoo FX.
- On any stock listed in a non-USD currency (e.g. a Canadian ticker), the header shows the **≈ USD equivalent** automatically.

**Supply chain — stock page → Overview tab**
- See **connected companies** (who supplies whom) and **supply-chain news** for any stock, e.g. chip suppliers for NVDA.
- Sourced from news coverage — a guide, not an exhaustive database.

**Your own price history — Hourly Snapshots**
- Run `node server/market-snapshot.mjs` on your VPS (cron: hourly) and every watchlist symbol's price is
  snapshotted to Nostr, encrypted to your key.
- Stock pages then show an **HOURLY SNAPSHOTS // NOSTR HISTORY** panel — your own decentralized record,
  stored on the network, not on an app server.

---

## The decentralized part

- Your **watchlist, positions, alerts and journal** are stored as Nostr events
  (kind 30078) **encrypted to your own key** (NIP-44) — relays store ciphertext
  only you can read. Log in with the same npub on any device and everything is
  there — no account database, no company holding your data.
- Market data itself is *viewed*, not owned — quotes are **delayed** (free
  feeds: Yahoo Finance + CBOE).

---

## Good to know

- **Delayed data** — quotes/charts/options are delayed, not real-time. This is
  a decision-support tool, not an execution platform.
- **Alerts** — in-app alerts only fire while the terminal is open. For
  24/7, run the server watcher on your own VPS.
- **Feed outages** — if market data is unreachable you'll see a "feed
  unavailable" banner with a Retry button; your Nostr data keeps working.
- **Privacy** — your data is encrypted to your own key on Nostr (NIP-44), so
  only you can read it. Logging in requires your signer to decrypt.
- Nothing here is financial advice. 😉

---

*Also see: `NIP.md` (how your data is stored) and `docs/HANDOVER.md`
(technical details).*
