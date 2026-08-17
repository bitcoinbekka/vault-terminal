# Vault Terminal — Easy Install Guide

> Run your own decentralized market terminal on a VPS. This guide is written
> for beginners — copy-paste each command, follow the order, you're done in
> ~20 minutes. All commands assume **Ubuntu/Debian**.

## What you need
- A VPS (any provider) running Ubuntu — a 1–2 GB box is plenty
- A domain you control (we'll use `your.domain` below — replace it everywhere)
- The ability to set a **DNS record** at your domain registrar

---

## Step 1 — Point your domain at your VPS (5 min)
At your registrar, add an **A record**:

```
vault.your.domain  →  A  →  <your VPS IP>
```

Wait a few minutes, then check it from your computer:
```bash
dig +short vault.your.domain
```
It should print your VPS IP.

---

## Step 2 — Log into your VPS
```bash
ssh root@<your-vps-ip>
```
(or however you normally log in)

## Step 3 — Install the required software
```bash
sudo apt update
```
```bash
sudo apt install -y nginx certbot python3-certbot-nginx git curl
```
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
```
```bash
sudo apt install -y nodejs
```
```bash
node -v
```
Should print `v22.x` or higher.

## Step 4 — Download the app
```bash
sudo mkdir -p /var/www/vault
```
```bash
sudo chown $USER:$USER /var/www/vault
```
```bash
git clone https://github.com/bitcoinbekka/vault-terminal.git /var/www/vault
```
```bash
cd /var/www/vault
```

## Step 5 — Install dependencies and build
```bash
npm ci
```
```bash
VITE_MARKET_BASE=https://vault.your.domain npm run build
```
This bakes your domain in so market data flows through **your own server** —
no third-party proxy, no CORS issues.

---

## Step 6 — Set up the web server

### Option A: nginx owns ports 80/443 (simplest — most VPSes)
```bash
sudo cp deploy/nginx-vault.conf /etc/nginx/sites-available/vault-terminal
```
```bash
sudo sed -i "s/vault\.example\.com/vault.your.domain/" /etc/nginx/sites-available/vault-terminal
```
```bash
sudo ln -sfn /etc/nginx/sites-available/vault-terminal /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
```
```bash
sudo nginx -t && sudo systemctl enable --now nginx
```

### Option B: something else already uses port 80/443 (e.g. Docker, Caddy, Apache)
Don't fight it — use the internal-port config and let the existing server
front it:
```bash
sudo cp deploy/nginx-vault-internal.conf /etc/nginx/sites-available/vault-terminal
sudo sed -i "s/vault\.example\.com/vault.your.domain/" /etc/nginx/sites-available/vault-terminal
sudo ln -sfn /etc/nginx/sites-available/vault-terminal /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl enable --now nginx
```
Then add a reverse proxy on your existing server:
- **Caddy:** add to its Caddyfile → `vault.your.domain { reverse_proxy 172.18.0.1:8081 }` (use your Docker bridge gateway — see the DEPLOY.md appendix)
- **Apache:** create a virtual host proxying to `127.0.0.1:8081`

## Step 7 — Turn on HTTPS
Option A (nginx owns 80/443):
```bash
sudo certbot --nginx -d vault.your.domain
```
Option B (Caddy fronts it): **skip this — Caddy does TLS automatically.**

Firewall, if enabled:
```bash
sudo ufw allow 80,443/tcp
```

---

## Step 8 — Verify it works
```bash
curl -sI https://vault.your.domain | head -3
```
```bash
curl -s "https://vault.your.domain/yahoo/v8/finance/chart/AAPL?range=1d&interval=5m" | head -c 120
```
Both should succeed. Open `https://vault.your.domain` in your browser, click
**Join**, log in with your Nostr npub — and the ticker streams.

---

## Step 9 (optional but recommended) — 24/7 extras

**Alert watcher** (fires notifications as encrypted Nostr DMs even when the
app is closed):
```bash
sudo cp server/.env.example /etc/vault-alerts.env
```
```bash
sudo nano /etc/vault-alerts.env
```
Change `VAULT_NSEC=nsec1...` to your own key, then save with **Ctrl+O**, Enter,
**Ctrl+X**. Then:
```bash
sudo cp server/vault-alerts.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now vault-alerts
```

**Hourly price snapshots + daily SEC fundamentals** (your own Nostr price
history + the FUNDAMENTALS tab):
```bash
crontab -e
```
Add these two lines (then **Ctrl+O**, Enter, **Ctrl+X**):
```
0 * * * * cd /var/www/vault && set -a && . /etc/vault-alerts.env && set +a && /usr/bin/node server/market-snapshot.mjs >> /var/log/vault-snapshot.log 2>&1
0 6 * * * cd /var/www/vault && set -a && . /etc/vault-alerts.env && set +a && /usr/bin/node server/sec-fundamentals.mjs >> /var/log/vault-sec.log 2>&1
```

---

## Updating the app later (after changes are pushed to GitHub)
```bash
cd /var/www/vault && git pull
```
```bash
VITE_MARKET_BASE=https://vault.your.domain npm run build
```
```bash
sudo systemctl reload nginx
```

---

## Troubleshooting — quick fixes
| Problem | Fix |
| --- | --- |
| `bind() to 0.0.0.0:80 failed` | Something already uses port 80. Find it: `sudo ss -tlnp \| grep :80`, then stop it, or use Option B (internal config). |
| Terminal stuck at `(END)` | Press `q`. |
| Stuck in nano | `Ctrl+O` saves, `Ctrl+X` exits — in that order. |
| `VAULT_NSEC is not set` errors in cron | The cron lines must source the env file (they do in Step 9). |
| Site loads but no quotes | `curl -s "https://vault.your.domain/yahoo/v8/finance/chart/AAPL?range=1d&interval=5m"` — if empty, check nginx is running: `sudo systemctl status nginx`. |

---

*More detail: `docs/DEPLOY.md` (admin) · `docs/USER_GUIDE.md` (using the app) ·
`docs/HANDOVER.md` (architecture) · `docs/adr/` (decisions).*
