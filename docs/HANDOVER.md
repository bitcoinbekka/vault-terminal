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
- **Command line (`/` shortcut or `>_` button)** — Bloomberg-style `<GO>` bar:
  tickers (`AAPL <GO>`) and mnemonics (`TOP`, `EQS`, `DES NVDA`,
  `OPTIONS NVDA`, `HELP`). See `src/lib/commands.ts` + `CommandBar.tsx`.
- **Equity screener (`/screener`, `EQS <GO>`)** — filter the liquid universe
  by % change, volume, price and 52-week proximity.
- **Stock page (`/stock/:symbol`)** — live quote header, candlestick chart with
  indicator overlays (SMA/EMA/BOLL/VWAP/RSI/MACD), options chain with expected
  move + greeks, corporate news.
- **Trade journal (`/journal`)** — log buys/sells; FIFO realized P/L, win
  rate, avg hold time, open lots.
- **Position sizer (`/sizer`, `SIZER <GO>`)** — risk-based sizing (account %,
  entry, stop → shares/$ risked/position value); prefilled from stock pages.
- **Currency converter (`/fx`, `FX <GO>`)** — live Yahoo FX pairs (e.g.
  `USDCAD=X`) routed through USD for cross pairs; stock pages show the ≈ USD
  equivalent for non-USD listings (`src/lib/fx.ts`, `src/hooks/useFx.ts`).
- **Supply chain (`SupplyChainPanel`)** — news-based connected-company
  discovery for any stock (`useSupplyChain` searches "{symbol} supplier /
  supply chain / customer", aggregates relatedTickers + headlines).
- **SEC fundamentals (`FundamentalsPanel`)** — `server/sec-fundamentals.mjs`
  pulls annual 10-K figures from SEC EDGAR (US equities in the watchlist,
  free XBRL) and publishes encrypted reports to Nostr
  (`vault:fundamentals:<SYMBOL>`); the stock page's FUNDAMENTALS tab renders
  revenue/income/margins charts + key stats. Canadian filings are manual
  (SEDAR has no API) — the Phase 2 AI analyzer adds PDF upload.
- **Hourly snapshots** — `server/market-snapshot.mjs` publishes per-symbol
  hourly snapshots to Nostr (kind 30078 `vault:snapshot:<SYMBOL>:<hour>`,
  encrypted, `t`-tagged); the stock page shows them in
  `SnapshotsPanel` via `useSnapshots`.
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
  pages/            Index (dashboard), StockPage, JournalPage, ScreenerPage (EQS),
                    SizerPage, FxPage, NIP19Page, NotFound
  components/
    terminal/       TerminalLayout, TickerTape, CommandBar (GO bar), Panels
                    (Watchlist, Portfolio, Movers, Trending, SectorRotation,
                    OptionsFlow, MarketRegime, MarketIndices), CandleChart,
                    IndicatorToolbar, Sparkline, OptionPayoff, SnapshotsPanel,
                    SupplyChainPanel, FundamentalsPanel,
                    dialogs (AddSymbol/Position/Trade/Alert), AlertBell, AlertWatcher
    nostr/          ProfileView, EventView (NIP-19 route rendering)
    auth/           LoginArea, AccountSwitcher (template)
    ui/             shadcn/ui primitives
  hooks/            useYahoo (chart/search/trending/options/quotes/chains),
                    useWatchlist, usePositions, useAlerts, useTrades (Nostr data),
                    useSnapshots, useFundamentals, useSupplyChain, useFx,
                    useCurrentUser, useNostrPublish, useAuthor, ...
  lib/              yahoo.ts (data layer + CORS fetch), fx.ts, commands.ts,
                    indicators.ts, journal.ts, options.ts, nostrCrypto.ts,
                    format.ts, sanitize.ts, marketUniverse.ts, notify.ts
  contexts/ AppContext.tsx, components/AppProvider.tsx (theme + NIP-65 relays)
server/             alerts-watcher.mjs, market-snapshot.mjs, sec-fundamentals.mjs,
                    .env.example, vault-alerts.service
deploy/             nginx-vault.conf (80/443 + same-origin proxy),
                    nginx-vault-internal.conf (8081 + Caddy-fronted variant)
docs/               adr/ (0001-0006), HANDOVER.md, DEPLOY.md, INSTALL.md, USER_GUIDE.md
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

VPS (optional, 24/7 — see ADR 0006)
 ├─ alerts-watcher.mjs:   reads encrypted alerts → polls Yahoo → NIP-17 DM
 │                        + webhook → publishes firedAt
 ├─ market-snapshot.mjs:  watchlist → hourly encrypted snapshots (cron)
 └─ sec-fundamentals.mjs: watchlist (US) → SEC EDGAR → encrypted reports (cron)
    (planned) analyzer.mjs: watches request events → LLM (OpenAI-compatible)
                        → encrypted analysis reports
```

**Key principle:** market data is a *view*; Nostr is the *source of truth* for
everything the user owns — including the data the VPS services write.

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

**Endpoints in use (browser, via the layered fetch):**

- `query1.finance.yahoo.com/v8/finance/chart/{sym}?range&interval` — quotes + OHLCV
- `…/v1/finance/search?q=` — symbol search + news (+ supply-chain queries)
- `…/v1/finance/trending/US` — trending symbols
- `…/v8/finance/chart/XXXYYY=X` — FX pairs (e.g. `USDCAD=X`), via `lib/fx.ts`
- `cdn.cboe.com/api/global/delayed_quotes/options/{sym}.json` — options chains
  (OCC symbols, greeks, vol/OI). ~1.5 MB per symbol — **lazy-loaded** (only
  when the Options tab opens or the flow scanner runs).

**Endpoints used server-side only (no CORS matters there):**

- `data.sec.gov/api/xbrl/companyfacts/CIK{…}.json` + `…/company_tickers.json` —
  SEC EDGAR fundamentals (requires a descriptive User-Agent; rate-limit ~10/s).
- Note: Wikipedia's API is **CORS-blocked** in browsers, which is why the
  supply-chain panel is news-based rather than Wikipedia-based.

---

## 7. Nostr data model

See **`NIP.md`** — it is the authoritative schema reference. Summary
(kind 30078, all author-constrained, all **NIP-44 encrypted to the owner**):

| Dataset | `d` tag | Notes |
| --- | --- | --- |
| Watchlist | `vault:watchlist` | content encrypted; `enc` tag |
| Positions | `vault:positions` | equity + OCC option contracts, encrypted |
| Alerts | `vault:alerts` | above/below/pctUp/pctDown; `firedAt`; encrypted |
| Trades | `vault:trades` | buy/sell, FIFO accounting; encrypted |
| Snapshots | `vault:snapshot:<SYMBOL>:<hour>` | hourly history, encrypted, `t`-tagged |
| Fundamentals | `vault:fundamentals:<SYMBOL>` | SEC 10-K figures, encrypted, `t`-tagged |

Encryption uses the user's signer (`user.signer.nip44.encrypt/decrypt`,
NIP-44 = the cipher behind NIP-17 DMs); see `src/lib/nostrCrypto.ts`. The
server watcher decrypts/re-encrypts alerts with the owner's nsec. Legacy
plaintext events still parse via a fallback.

Login/relays are handled by the template (`NostrSync` loads the user's NIP-65
list into `AppContext`). Default relays: `src/lib/appRelays.ts`.

---

## 8. Routing (`AppRouter.tsx`)

```
/                      dashboard (inside TerminalLayout)
/stock/:symbol         stock page
/journal               trade journal
/screener              EQS equity screener
/sizer                 position sizing calculator
/fx                    currency converter
/:nip19                NIP-19 identifiers (npub/nprofile/note/nevent/naddr)
*                      NotFound
```

All NIP-19 identifiers live at the URL root. Profiles/notes are rendered by
`src/components/nostr/*`. Always decode before querying and constrain
addressable lookups by `authors` (see the `nip19-routing` skill).

---

## 9. Companion services (alerts + snapshots + fundamentals)

The browser handles the app; the VPS runs background services over the same
Nostr events (see **ADR 0006**):

1. **Client alerts** (`AlertWatcher` in the layout): polls every 60s while the
   tab is open — browser notification + beep + toast; marks `firedAt`.
2. **Server watcher** (`server/alerts-watcher.mjs`): reads alerts from relays,
   polls Yahoo directly, sends a **NIP-17 encrypted DM** + optional webhook +
   publishes `firedAt`. Run `--once` to test, `--dry-run` to preview. 24/7 via
   `server/vault-alerts.service` (env: `/etc/vault-alerts.env`).
3. **Snapshot pusher** (`server/market-snapshot.mjs`) — hourly, cron-friendly.
4. **SEC fetcher** (`server/sec-fundamentals.mjs`) — daily, cron-friendly.
5. **Analyzer** (planned, Phase 2) — model-agnostic LLM over
   OpenAI-compatible endpoints (DeepSeek / Ollama).

All four share `VAULT_NSEC`/`VAULT_RELAYS` and the encrypted-events pattern.
**Cron jobs must source the env file first** — they don't read the systemd
`EnvironmentFile`: `cd /var/www/vault && set -a && . /etc/vault-alerts.env && set +a && node server/…`

---

## 10. Deployment

### Shakespeare preview
`build_project` → static files in `dist/`. No configuration needed.

### Self-hosted VPS (recommended for independence)
Full step-by-step in **`docs/DEPLOY.md`** and the beginner guide in
**`docs/INSTALL.md`**. The two supported layouts:

- **Standard (nginx owns 80/443):** `npm ci && VITE_MARKET_BASE=https://your.domain npm run build`
  → serve `dist/` with `deploy/nginx-vault.conf` → certbot for TLS.
- **Caddy already owns 80/443** (e.g. a Docker Caddy container): use
  `deploy/nginx-vault-internal.conf` (nginx on **0.0.0.0:8081**) and let Caddy
  reverse-proxy `your.domain → <docker-bridge-gateway>:8081` — Caddy does TLS,
  no certbot. Get the upstream IP from `docker network inspect`, not a guess.
- Either way: market data flows same-origin (**no CORS, no third-party proxy**).
- Optional services: `VAULT_NSEC` + systemd for the watcher; cron for
  snapshots + SEC fundamentals (sourcing `/etc/vault-alerts.env`).

Updates: `git pull && VITE_MARKET_BASE=… npm run build && sudo systemctl reload nginx`

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
- **Data is private on Nostr** — `content` is NIP-44 encrypted to the owner;
  legacy plaintext events remain readable. Signers must support
  `nip44.encrypt/decrypt`.
- **Deployment gotchas** (all learned the hard way on a live VPS):
  - Port 80/443 owned by another process (Docker/Caddy) → use the internal
    config, don't fight it.
  - A Docker-bridge container can't reach the host's `127.0.0.1` — nginx must
    listen on all interfaces and Caddy must use the bridge **gateway** IP.
  - `systemctl reload` can silently keep old sockets — use `restart` when a
    `listen` change doesn't take.
  - Cron jobs don't read the systemd env file — source it (`set -a && . …`).
  - `systemctl status`/`journalctl` open a pager — press `q` (or add
    `--no-pager`).
- The project directory is `/projects/vault` (do not confuse with any
  `untitled` stub dirs that may exist in the workspace).
- Platform sandbox has **no Node runtime** — `tsc`/`eslint`/`vitest` can't run
  here; validate via careful review + `build_project`, and rely on the user's
  `npm test` locally.
- IV "RICH/CHEAP" thresholds are absolute heuristics, not historical
  percentiles (no IV history from the free feed).

---

## 13. Roadmap / suggested next steps

- [ ] **Phase 2 — AI filing analyzer** (`server/analyzer.mjs`): model-agnostic
      LLM (DeepSeek API or local Ollama via `ANALYZER_BASE_URL`), triggered by
      Nostr request events; upload PDFs to Blossom; encrypted analysis reports
      on the FUNDAMENTALS tab. Covers Canadian (SEDAR) via manual upload.
- [ ] Server-side **options-flow alerts** (watcher scans chains for vol/OI spikes → DM).
- [ ] Watchlist **momentum score** (rank tickers by trend + RSI + relative strength).
- [ ] **52W LOW** tab in the movers scanner.
- [ ] `og:image` social cards now that a public URL exists; publish as a
      **NIP-89 app**; "Edit with Shakespeare" badge.
- [ ] Consider a paid feed (e.g. Finnhub) behind the same-origin proxy for
      real-time quotes.

---

*Related docs: `NIP.md` (schema) · `docs/adr/0001–0006` (decisions) ·
`docs/DEPLOY.md` (admin) · `docs/INSTALL.md` (beginner install) ·
`docs/USER_GUIDE.md` (end users) · `.env.example` + `deploy/*` + `server/*` (ops).*
