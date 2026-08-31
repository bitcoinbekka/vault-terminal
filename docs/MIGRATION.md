# Vault Terminal — Server Migration Plan

> **Why:** the previous VPS provider (Sovereign Hybrid Compute, IP `23.182.128.82`)
> went offline (domain lapsed + network unreachable). This plan rebuilds every
> service on a new, reliable provider **from GitHub** — no data was lost (code
> on GitHub, user data on Nostr relays, configs documented).

## Recommended architecture

Two servers (more stable than one box doing everything) — or one server if you
prefer simpler. **Assumption:** you've picked a reliable provider (Hetzner,
DigitalOcean, Vultr, Linode…). Suggested sizing: **4 GB RAM / 80 GB disk** per
server.

```
Server A — "web" (the front door + apps)
  Caddy (systemd) on 80/443  ← ONE front door, auto-TLS
    vault.plebeian.build    → nginx 127.0.0.1:8081 (vault + /yahoo /cboe)
    app.plebeian.build      → static /var/www/scheduler-app/dist
    scheduler.plebeian.build→ API → 127.0.0.1:8080 (scheduler backend)
    sahmstr.com, www        → static /var/www/sahmstr.com/
    torii.plebeian.build    → static /var/www/torii.quest/current + /mp → 127.0.0.1:8787
  nginx (internal)          → vault :8081, scheduler-api :8080
  systemd                   → torii-arena-ws (8787), vault-alerts, vault-analyzer
  cron                      → vault snapshots (hourly), SEC fundamentals (daily)

Server B — "relays" (optional but recommended)
  strfry on 127.0.0.1:7777  (sahmstr relay) and 127.0.0.1:7778 (plebeian relay)
  Caddy on Server A routes relay.sahmstr.com → Server-B-IP:7777
                               relay.plebeian.build → Server-B-IP:7778
```

## Step 0 — Write down your new server IPs

`SERVER_A_IP=________` · `SERVER_B_IP=________` (fill in) — you'll need these for
DNS and for the relay proxies.

---

## Step 1 — Base install on each server (fresh Ubuntu 24.04)

```bash
sudo apt update && sudo apt install -y nginx git curl
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo apt-get install -y caddy        # Debian/Ubuntu package (host Caddy)
node -v                              # expect v22.x
```

## Step 2 — Server A: Vault terminal

```bash
sudo mkdir -p /var/www/vault && sudo chown $USER:$USER /var/www/vault
git clone https://github.com/bitcoinbekka/vault-terminal.git /var/www/vault
cd /var/www/vault
npm ci
VITE_MARKET_BASE=https://vault.plebeian.build npm run build
```
Serve it via internal nginx (same as before) — from the repo:
```bash
sudo cp deploy/nginx-vault-internal.conf /etc/nginx/sites-available/vault-terminal
sudo sed -i 's/vault\.example\.com/vault.plebeian.build/' /etc/nginx/sites-available/vault-terminal
sudo ln -sfn /etc/nginx/sites-available/vault-terminal /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl enable --now nginx
```
Add the vault Caddy block (Server A's Caddyfile):
```caddyfile
vault.plebeian.build {
    reverse_proxy 127.0.0.1:8081
}
```
Reload + verify:
```bash
sudo systemctl reload caddy
curl -s -o /dev/null -w "%{http_code}\n" https://vault.plebeian.build/
```

## Step 3 — Server A: Scheduler app

Clone the scheduler app repo (you know its GitHub URL — it was at
`/home/ubuntu/scheduler-app` on the old box), then:
```bash
cd <scheduler-app> && npm ci && npm run build
sudo mkdir -p /var/www/scheduler-app && sudo cp -a dist/. /var/www/scheduler-app/dist/
```
Run its backend on 127.0.0.1:8080 (systemd unit — check the app's repo/docs), then
add to Caddy:
```caddyfile
app.plebeian.build {
    root * /var/www/scheduler-app/dist
    encode gzip
    try_files {path} /index.html
    file_server
}
scheduler.plebeian.build {
    reverse_proxy 127.0.0.1:8080
}
```

## Step 4 — Server A: torii-quest game (bare-metal)

```bash
git clone https://github.com/ChiefmonkeyArt/torii-quest.git ~/torii-quest
cd ~/torii-quest
git fetch --tags origin && git checkout <NEWEST-TAG>   # e.g. v0.2.709-alpha
npm ci && npm run build && npm run check
VER=$(node -p "require('./package.json').version")
sudo mkdir -p /var/www/torii.quest/releases/$VER
sudo cp -a dist/. /var/www/torii.quest/releases/$VER/
sudo ln -sfn /var/www/torii.quest/releases/$VER /var/www/torii.quest/current
```
Caddy block:
```caddyfile
torii.plebeian.build {
    root * /var/www/torii.quest/current
    encode zstd gzip
    try_files {path} /index.html
    file_server

    @wasm path *.wasm
    header @wasm Content-Type application/wasm

    @assets path /assets/*
    header @assets Cache-Control "public, max-age=31536000, immutable"
    header /index.html Cache-Control "no-cache"
}
```
Multiplayer + admin (per the game's docs §16.2/16.2a): create
`/etc/systemd/system/torii-arena-ws.service` with
`Environment=QUEST_ADMIN_NPUB=npub1...` + HOST/PORT, enable it, and add to the
torii Caddy block: `handle /mp { reverse_proxy 127.0.0.1:8787 }`.

## Step 5 — Vault's 24/7 services (Server A)

```bash
sudo cp server/.env.example /etc/vault-alerts.env   # set VAULT_NSEC + ANALYZER_*
sudo cp server/vault-alerts.service server/vault-analyzer.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now vault-alerts vault-analyzer
crontab -e   # add snapshot + SEC lines (source /etc/vault-alerts.env)
```

## Step 6 — Server B: relays (optional)

Follow the sahmstr repo's `docs/RELAY.md` for strfry on 7777 (sahmstr) and 7778
(plebeian), with write-policy + allowlist. Then on **Server A's Caddy**:
```caddyfile
relay.sahmstr.com    { reverse_proxy <SERVER_B_IP>:7777 }
relay.plebeian.build { reverse_proxy <SERVER_B_IP>:7778 }
```

## Step 7 — DNS cutover (Njalla)

Point every subdomain's **A record** at the new IPs. Keep the old IP until all
sites verify:

| Record | → |
| --- | --- |
| `vault.plebeian.build` | SERVER_A_IP |
| `app.plebeian.build` | SERVER_A_IP |
| `scheduler.plebeian.build` | SERVER_A_IP |
| `sahmstr.com` + `www` | SERVER_A_IP |
| `torii.plebeian.build` | SERVER_A_IP |
| `relay.sahmstr.com` | SERVER_B_IP |
| `relay.plebeian.build` | SERVER_B_IP |

Wait for propagation, then verify each: `curl -s -o /dev/null -w "%{http_code}\n" https://<site>/`

## Step 8 — Verify everything + rules

```bash
for s in vault app scheduler torii sahmstr; do
  echo -n "$s "; curl -s -o /dev/null -w "%{http_code}\n" https://$s.plebeian.build/ 2>/dev/null || curl -s -o /dev/null -w "%{http_code}\n" https://$s.com/
done
```

Copy the shared rules to the new box and tell every clanker:
```bash
sudo cp /var/www/vault/docs/VPS_OPS.md /home/ubuntu/VPS_OPS.md
```
Rule #1: **one Caddy front door, append-only, `caddy validate` before `reload`.**
Rule #2: **if a site dies, check `systemctl status nginx` first.**

## Rollback / safety
- Keep the old DNS pointing at the old IP until the cutover verifies (old IP is
  dead, but the record is harmless).
- All app repos are on GitHub; every deploy is re-runnable.
- If the old provider miraculously comes back: skip migration, just call support.

---

*More detail: `docs/INSTALL.md`, `docs/DEPLOY.md`, `docs/VPS_OPS.md` — all in the
vault repo, and `docs/adr/` for why decisions were made.*
