# Vault Terminal — Handover Document

> Decentralized, Bloomberg-style market terminal. Track stocks, options,
> portfolio, alerts and a trade journal — with your watchlist/positions/alerts/
> journal stored on Nostr and following your npub.
>
> **Handover date:** 2026-08-14 · **Stack:** React 19 + Vite + Tailwind 4 +
> shadcn/ui + Nostrify · **Template:** MKStack

---

## 1. What this app is

A dark "terminal" for retail traders:

- **Dashboard (`/`)** — portfolio (top, under the ticker), market indices,
  macro regime (VIX/yields/gold/BTC), watchlist, market movers, sector
  rotation, options flow, trending, market news.
- **Stock page (`/stock/:symbol`)** — live quote header, candlestick chart with
  indicator overlays (SMA/EMA/BOLL/VWAP/RSI/MACD), options chain with expected
  move + greeks, corporate news.
- **Trade journal (`/journal`)** — log buys/sells; FIFO realized P/L, win
  rate, avg hold time, open lots.
- **Profile pages (`/:nip19`)** — real Nostr profile/note/event views.
- **Alerts** — price alerts with browser notifications (client-side, while the
  tab is open) **and** a server-side 24/7 watcher (VPS companion, sends
  encrypted Nostr DMs + webhook).

Market data is **delayed** (Yahoo Finance + CBOE, free, no API key) — the app
is decision-support, not execution.

---

## 2. Tech stack

| Concern | Choice |
| --- | --- |
| UI | React 19, TailwindCSS 4 (CSS-first config), shadcn/ui primitives (`src/components/ui/`) |
| Build | Vite (the platform's `build_project` uses esbuild-wasm via esm.sh) |
| Data fetching | TanStack Query v5 (caching, dedupe, optimistic mutations) |
| Routing | React Router v7 (`AppRouter.tsx`) |
| Nostr | Nostrify (`@nostrify/react`) + `nostr-tools` (server watcher) |
| Charts | Custom SVG (candlesticks, sparklines, payoff diagrams) — no chart lib |
| Fonts | Inter Variable (UI) + JetBrains Mono Variable (terminal numbers) |
| Icons | lucide-react |

---

## 3. Quick start

```bash
npm ci                     # install
npm run dev                # dev server
npm run build              # production build -> dist/
npm test                   # tsc + eslint + vitest + vite build
npm run watch:alerts       # run the server-side alert watcher
```

The platform preview builds with `build_project` (no Node needed in the
sandbox; type-checking must be done carefully by review).

---

## 4. Project structure

```
src/
  pages/            Index (dashboard), StockPage, JournalPage, NIP19Page, NotFound
  components/
    terminal/       TerminalLayout, TickerTape, Panels (Watchlist, Portfolio,
                    Movers, Trending, SectorRotation, OptionsFlow, MarketRegime,
                    MarketIndices), CandleChart, Sparkline, OptionPayoff,
                    dialogs (AddSymbol/Position/Trade/Alert), AlertBell, AlertWatcher
    nostr/          ProfileView, EventView (NIP-19 route rendering)
    auth/           LoginArea, AccountSwitcher (template)
    ui/             shadcn/ui primitives
  hooks/            useYahoo (chart/search/trending/options/quotes/chains),
                    useWatchlist, usePositions, useAlerts, useTrades (Nostr data),
                    useCurrentUser, useNostrPublish, useAuthor, ...
  lib/              yahoo.ts (data layer + CORS fetch), indicators.ts, journal.ts,
                    options.ts, format.ts, sanitize.ts, marketUniverse.ts, notify.ts
  contexts/ AppContext.tsx, components/AppProvider.tsx (theme + NIP-65 relays)
server/             alerts-watcher.mjs (24/7 watcher), .env.example, vault-alerts.service
deploy/             nginx-vault.conf (same-origin reverse proxy)
docs/               adr/ (0001-0005), HANDOVER.md (this file)
NIP.md              Nostr storage schema (authoritative)
```

---

## 5. Architecture & data flow

```
Browser (React)
 ├─ Market data: lib/yahoo.ts fetch layer
 │    attempts: VITE_MARKET_BASE same-origin (/yahoo /cboe)
 │              → VITE_CORS_PROXY or proxy.shakespeare.diy?url=
 │              → direct
 │    sources:  Yahoo (chart/search/trending) · CBOE (options chains)
 │
 ├─ User data:   kind 30078 events (vault:watchlist|positions|alerts|trades)
 │               read via nostr.query (authors-constrained) → TanStack Query
 │               write via useNostrPublish (adds client tag)
 │
 ├─ Alerts:      AlertWatcher polls prices every 60s while tab open
 │               → browser notification + sound + firedAt on Nostr
 │
 └─ Analytics:   pure functions over cached candles/trades/chains
      indicators.ts · journal.ts (FIFO) · options.ts (expected move/payoff)

VPS (optional, 24/7)
 └─ server/alerts-watcher.mjs: reads alerts from Nostr → polls Yahoo directly
      → NIP-17 encrypted DM + webhook → publishes firedAt
```

**Key principle:** market data is a *view*; Nostr is the *source of truth* for
everything the user owns.

---

## 6. Data sources & the CORS gotcha (read this)

Yahoo and CBOE send **no CORS headers**, so browsers can't read them directly.
The app therefore tries multiple paths in order (`src/lib/yahoo.ts`
`buildAttempts()`):

1. **Same-origin reverse proxy** (`VITE_MARKET_BASE`) — no CORS at all.
2. **CORS proxy** `?url=` convention (`VITE_CORS_PROXY`, default
   `https://proxy.shakespeare.diy/?url=`).
3. **Direct** fetch (last resort).

**Known issue:** `proxy.shakespeare.diy` has been observed returning
`HTTP 522` (origin down). When that happens the ticker tape shows a
"Market feed unavailable" banner with a **Retry** button and panels show
graceful empty/error states. The Nostr-backed features (login, watchlist,
positions, alerts, journal) keep working regardless. Self-hosting with
`VITE_MARKET_BASE` removes the dependency entirely (see ADR 0005).

**Endpoints in use:**

- `query1.finance.yahoo.com/v8/finance/chart/{sym}?range&interval` — quotes + OHLCV
- `…/v1/finance/search?q=` — symbol search + news
- `…/v1/finance/trending/US` — trending symbols
- `cdn.cboe.com/api/global/delayed_quotes/options/{sym}.json` — options chains
  (OCC symbols, greeks, vol/OI). ~1.5 MB per symbol — **lazy-loaded** (only
  when the Options tab opens or the flow scanner runs).

---

## 7. Nostr data model

See **`NIP.md`** — it is the authoritative schema reference. Summary
(kind 30078, all author-constrained):

| Dataset | `d` tag | Notes |
| --- | --- | --- |
| Watchlist | `vault:watchlist` | symbols also mirrored to `t` tags |
| Positions | `vault:positions` | equity + OCC option contracts |
| Alerts | `vault:alerts` | above/below/pctUp/pctDown; `firedAt` |
| Trades | `vault:trades` | buy/sell, FIFO accounting |

Login/relays are handled by the template (`NostrSync` loads the user's NIP-65
list into `AppContext`). Default relays: `src/lib/appRelays.ts`.

---

## 8. Routing (`AppRouter.tsx`)

```
/                      dashboard (inside TerminalLayout)
/stock/:symbol         stock page
/journal               trade journal
/:nip19                NIP-19 identifiers (npub/nprofile/note/nevent/naddr)
*                      NotFound
```

All NIP-19 identifiers live at the URL root. Profiles/notes are rendered by
`src/components/nostr/*`. Always decode before querying and constrain
addressable lookups by `authors` (see the `nip19-routing` skill).

---

## 9. Alerts architecture (two layers)

1. **Client** (`AlertWatcher` in the layout): polls every 60s while the tab is
   open. Uses shared query keys (`['yahoo','chart',sym,'1D']`) so it reuses
   quotes already fetched by the watchlist/tape. Browser notification + beep +
   toast; marks `firedAt`.
2. **Server** (`server/alerts-watcher.mjs`): reads alerts from relays, polls
   Yahoo directly, and on trigger sends a **NIP-17 encrypted DM** + optional
   webhook + publishes `firedAt`. Run with `--once` to test, `--dry-run` to
   preview. Configure via env (see `server/.env.example`); run 24/7 with
   `server/vault-alerts.service`.

---

## 10. Deployment

### Shakespeare preview
`build_project` → static files in `dist/`. No configuration needed.

### Self-hosted VPS (recommended for independence)
1. `npm ci && VITE_MARKET_BASE=https://your.domain npm run build`
2. Serve `dist/` with `deploy/nginx-vault.conf` (also reverse-proxies
   `/yahoo/` and `/cboe/` same-origin → **no CORS, no third-party proxy**).
3. Enable HTTPS (certbot) — required for wss relays.
4. Optional 24/7 alerts: configure `VAULT_NSEC` and install the systemd unit.

---

## 11. Security notes (from the `nostr-security` skill)

- **Never** use `dangerouslySetInnerHTML`/`innerHTML` with event data. Note
  content is rendered as plaintext (`whitespace-pre-wrap`).
- Sanitize every event/feed-sourced URL and image (`lib/sanitize.ts`) before
  use as `href`/`src`/CSS `url()`.
- Author-constrain all Nostr queries that imply trust (addressable events,
  user-owned data).
- `nsec` keys live in `localStorage` (template behavior) — XSS is the top
  threat; the shipped CSP (`script-src 'self'`) is defense-in-depth.
- **Never render or log decoded `nsec`** (NIP19Page returns 404 for it).

---

## 12. Known issues & gotchas

- **CORS proxy may be down** → feed-unavailable banner + retry (see §6).
- **Market data is delayed**, not real-time.
- **Client alerts only fire while the tab is open**; 24/7 requires the server
  watcher.
- **Options chains are heavy** (~1.5 MB each) — lazy-loading is intentional;
  don't fetch them eagerly on the dashboard.
- **Data is public on Nostr** — nothing sensitive is stored (positions/trades
  are visible to anyone with the pubkey).
- The project directory is `/projects/vault` (do not confuse with any
  `untitled` stub dirs that may exist in the workspace).
- Platform sandbox has **no Node runtime** — `tsc`/`eslint`/`vitest` can't run
  here; validate via careful review + `build_project`, and rely on the user's
  `npm test` locally.
- IV "RICH/CHEAP" thresholds are absolute heuristics, not historical
  percentiles (no IV history from the free feed).

---

## 13. Roadmap / suggested next steps

- [ ] Server-side **options-flow alerts** (watcher scans chains for vol/OI spikes → DM).
- [ ] Position sizing calculator (risk % × account / stop distance).
- [ ] Watchlist momentum score (rank tickers by trend + RSI + relative strength).
- [ ] 52W LOW tab in the movers scanner.
- [ ] Deploy to a public URL; add `og:image` once a URL exists; optionally
      publish as a NIP-89 app.
- [ ] Consider a paid feed (e.g. Finnhub) behind the same-origin proxy for
      real-time/fundamentals.

---

*Related docs: `NIP.md` (schema) · `docs/adr/0001–0005` (decisions) ·
`.env.example` + `deploy/nginx-vault.conf` + `server/.env.example` (ops).*
