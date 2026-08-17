# Vault Terminal 🎛️

**A decentralized, Bloomberg-style market terminal.** Track stocks, options,
gold/silver, crypto and a full portfolio — with alerts, charts, screening,
SEC fundamentals and AI filing analysis — all in one dark terminal. Your
watchlist, positions, alerts, journal and AI reports live on **Nostr**,
encrypted to your key, and follow your npub to any device.

> Live demo: [https://vault.plebeian.build](https://vault.plebeian.build)
>
> [![Edit with Shakespeare](https://shakespeare.diy/badge.svg)](https://shakespeare.diy/clone?url=https%3A%2F%2Fgithub.com%2Fbitcoinbekka%2Fvault-terminal.git)

---

## ✨ What you get

| | |
|---|---|
| **Terminal dashboard** | Portfolio (top), market indices, macro regime (VIX/gold/BTC), watchlist with momentum scores, market movers, sector rotation, options flow, trending, news |
| **Bloomberg-style `<GO>` bar** | Type `AAPL <GO>`, `TOP <GO>`, `EQS <GO>`, `OPTIONS NVDA <GO>`… (press `/` to open) |
| **Stock pages** | Candlestick charts + indicators (SMA/EMA/BOLL/VWAP/RSI/MACD), options chains with expected move + greeks, corporate news, supply-chain coverage, SEC fundamentals |
| **Equity screener** | Filter the liquid universe by change, volume, price, 52-week proximity |
| **Position sizer** | Risk-based sizing (account %, entry, stop → shares) |
| **Currency converter** | Live USD/CAD/EUR/JPY… with USD-normalized portfolio totals |
| **Trade journal** | FIFO realized P/L, win rate, avg hold, open lots |
| **Privacy mode** | 🕶️ One click hides all quantities & dollar amounts for screen sharing |
| **Alerts** | In-browser + 24/7 server watcher → encrypted Nostr DMs |
| **AI filing analysis** | One click: the VPS AI summarizes SEC filings (strengths, risks, verdict) |

**Decentralized by design:** your data is stored as Nostr events (kind 30078),
**NIP-44 encrypted to your key** — relays only see ciphertext. Market data
(Yahoo Finance + CBOE, delayed) is a view; Nostr is the source of truth.

---

## 🚀 Quick start

### Use it (2 min)
1. Open the app (live demo above, or your own deployment)
2. Click **Join** → log in with your Nostr npub (nsec / extension / remote signer)
3. **+ ADD** symbols, **TRACK POSITION** what you own, set **ALERTS** — done

### Self-host it (~20 min, needs a VPS + domain)
Follow **`docs/INSTALL.md`** — it's a beginner-friendly, copy-paste guide:
DNS → packages → clone → build → nginx → HTTPS → optional 24/7 extras.

```bash
git clone https://github.com/bitcoinbekka/vault-terminal.git /var/www/vault
cd /var/www/vault
npm ci
VITE_MARKET_BASE=https://your.domain npm run build
```

---

## 📚 Docs

- **`docs/USER_GUIDE.md`** — how to use the app (end users)
- **`docs/INSTALL.md`** — easy self-host install (beginners)
- **`docs/DEPLOY.md`** — admin deployment detail (nginx, Caddy, cron)
- **`docs/HANDOVER.md`** — architecture & full handover
- **`docs/adr/`** — architecture decision records (0001–0006)
- **`NIP.md`** — the Nostr data schema (authoritative)

## 🧰 Repo layout

```
src/       React 19 + Vite + Tailwind + Nostrify app
server/    VPS companions: alerts-watcher, market-snapshot, sec-fundamentals, analyzer
deploy/    nginx configs (standard + Caddy-fronted)
docs/      guides + ADRs
```

## ⚠️ Notes

- Market data is **delayed** (free feeds) — decision-support, not execution.
- AI analysis is **opinion, not financial advice** — always verify.
- Your Nostr events are **public on relays** but the *content* is encrypted to
  your key — only you can read it.

---

*Vibed with Shakespeare · Built on Nostr · Not financial advice*
