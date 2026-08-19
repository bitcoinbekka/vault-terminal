# Vault Terminal — Guide for AI Agents ("clankers")

> You are an AI agent about to work on this codebase. It is **live in
> production** on the owner's VPS (`vault.plebeian.build`) with real user data
> on Nostr. Read this first — breaking things here costs real money and trust.

## What this is

A decentralized, Bloomberg-style market terminal: React 19 + Vite + Tailwind 4
+ Nostrify frontend, plus Node services on the owner's VPS. All user data
(watchlist, positions, alerts, journal, snapshots, SEC fundamentals, AI
reports) lives on **Nostr as kind 30078 events, NIP-44 encrypted to the
owner's key**. Market data (Yahoo + CBOE, delayed) is a view; Nostr is the
source of truth.

## Architecture in 60 seconds

```
src/
  pages/       Index (dashboard), StockPage, JournalPage, ScreenerPage (EQS),
               SizerPage, FxPage, NIP19Page
  components/terminal/   Panels, CandleChart, CommandBar, dialogs, Mask, ...
  hooks/       useYahoo (quotes/charts/options), useWatchlist/Positions/Alerts/
               Trades/Snapshots/Fundamentals/Analysis (Nostr data, encrypted),
               useFx, useMomentum, usePrivacyMode, ...
  lib/         yahoo.ts (fetch+CORS), nostrCrypto.ts (NIP-44 + symKey),
               session.ts (pre/post hours), indicators.ts, journal.ts (FIFO),
               options.ts, fx.ts, commands.ts, format.ts, sanitize.ts
server/        alerts-watcher.mjs, market-snapshot.mjs, sec-fundamentals.mjs,
               analyzer.mjs, vault-alerts.service, vault-analyzer.service
deploy/        nginx-vault.conf (80/443), nginx-vault-internal.conf (8081+Caddy)
docs/          USER_GUIDE, INSTALL, DEPLOY, HANDOVER, SECURITY, ADRs, NIP.md
NIP.md         the Nostr data schema (authoritative)
```

## Hard rules (do not violate)

1. **Never break production.** The VPS runs nginx (internal 8081), a Caddy
   container on 80/443, and systemd services `vault-alerts` + `vault-analyzer`.
   Don't stop/restart Docker containers or disable services. Don't leave
   dangling nginx symlinks. Always `sudo nginx -t` before reloading.
2. **Never put secrets in chat or the repo** — nsecs/API keys live in
   `/etc/vault-alerts.env` on the server. Repo has `.env.example` only.
3. **Encrypt on write, decrypt on read.** All user data content goes through
   `encryptOwnData` / `nip44Encrypt` with an `enc` tag; reads use
   `decryptOwnData` and are **always author-constrained** (`authors:[pubkey]`).
   Never publish plaintext user content to relays.
4. **No plaintext symbols in tags.** Use `symKey(symbol)` (SHA-256 hex slice)
   for `d`/`t` tags of derived events (snapshots/fundamentals/analysis) —
   client uses `crypto.subtle`, server uses `node:crypto` `createHash`. Keep
   both in sync or lookups break.
5. **Query by exact `#d` where possible.** Don't rely on `#t` with a small
   limit — high-frequency snapshot events share `#t` and crowd out rarer
   events (this bit us once; see HANDOVER §12).
6. **Never use `dangerouslySetInnerHTML`/raw `innerHTML`** with event data.
   Render note/feed text as plaintext; sanitize every URL
   (`sanitizeUrl`/`sanitizeImageUrl`).
7. **Don't run simultaneous deploy/setup sessions on the same VPS.** Sequence
   work; one misstep in shared nginx/Caddy breaks all subdomains.
8. **Keep the CSP restrictive** (`script-src 'self'`) — never add
   `'unsafe-eval'`/`'unsafe-inline'`/wildcard connect-src.

## How to work on it

- The sandbox has **no Node runtime** — you can't run `tsc`/`eslint`/`vitest`
  here. Validate by careful review + `build_project` (esbuild-wasm), and let
  the owner run `npm test` locally. Watch the preview console for errors.
- Preview quirk: the hosted preview loads deps from `esm.sh` at runtime and can
  time out; the **deployed site is fully self-contained** (no esm.sh).
- Data-flow facts: market data goes through the layered fetch in
  `lib/yahoo.ts` (same-origin `/yahoo /cboe` → `?url=` proxy → direct). The
  proxy (`proxy.shakespeare.diy`) is known-flaky; the VPS same-origin path is
  the reliable one.
- UI conventions: shadcn/ui primitives in `components/ui`, `cn()` for classes,
  `Panel` wrapper for terminal cards, mono + uppercase headers, gain/loss
  colors (`text-gain`/`text-loss`), 8px spacing, mobile-aware (buttons always
  visible on touch, confirm destructive deletes with `ConfirmDialog`).

## Commands the owner uses

```bash
bash deploy.sh https://vault.plebeian.build   # pull → build → nginx reload
sudo systemctl status vault-alerts            # 24/7 alert watcher
sudo systemctl status vault-analyzer          # AI analyzer (loop)
journalctl -u vault-analyzer -n 30 --no-pager # analyzer logs
```

## Docs worth reading before you touch code

`docs/HANDOVER.md` (architecture + gotchas) · `docs/SECURITY.md` (threat model
+ audit) · `NIP.md` (data schema) · `docs/adr/` (why decisions were made) ·
`docs/DEPLOY.md` (admin).
