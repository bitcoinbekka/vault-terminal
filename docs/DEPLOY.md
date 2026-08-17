# Vault Terminal — Deploy to your VPS (vault.plebeian.build)

Follow top to bottom. Each numbered step is one command block — run it, move on.
Assumes Ubuntu/Debian.

---

## Step 0 — DNS (do first, let it propagate)

At your DNS provider, create an A record:

```
vault.plebeian.build  →  A  →  <your VPS IP>
```

Check it resolved (from anywhere):

```bash
dig +short vault.plebeian.build
```

If `dig` isn't installed, use `nslookup vault.plebeian.build`.

---

## Step 1 — Log into your VPS

```bash
ssh root@<your-vps-ip>
```

(or however you normally access it)

---

## Step 2 — Install system packages

```bash
sudo apt update
```

```bash
sudo apt install -y nginx certbot python3-certbot-nginx git curl
```

Node.js (the app needs Node 20.19+ — distro Node is too old, use NodeSource):

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
```

```bash
sudo apt install -y nodejs
```

Verify:

```bash
node -v
```

Should print `v22.x` or higher.

---

## Step 3 — Get the code

```bash
git clone https://github.com/bitcoinbekka/vault-terminal.git /var/www/vault
```

```bash
cd /var/www/vault
```

---

## Step 4 — Install dependencies

```bash
npm ci
```

---

## Step 5 — Build the app (with your domain baked in)

This is the key step — `VITE_MARKET_BASE` makes the app fetch market data from
**your own origin** (`/yahoo/*`, `/cboe/*`), so no CORS proxy is needed at all.

```bash
VITE_MARKET_BASE=https://vault.plebeian.build npm run build
```

You should see `dist/` get created. Check:

```bash
ls dist/index.html
```

---

## Step 6 — Install the nginx config

Copy the config into place:

```bash
sudo cp deploy/nginx-vault.conf /etc/nginx/sites-available/vault-terminal
```

Swap the placeholder domain for yours:

```bash
sudo sed -i 's/vault\.example\.com/vault.plebeian.build/' /etc/nginx/sites-available/vault-terminal
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/vault-terminal /etc/nginx/sites-enabled/
```

Remove the default site (it would shadow yours):

```bash
sudo rm -f /etc/nginx/sites-enabled/default
```

Test the config:

```bash
sudo nginx -t
```

You must see `syntax is ok` and `test is successful`. Then reload:

```bash
sudo systemctl reload nginx
```

---

## Step 7 — Enable HTTPS

```bash
sudo certbot --nginx -d vault.plebeian.build
```

Follow the prompts (email, agree, redirect HTTP→HTTPS: yes).

```bash
sudo systemctl reload nginx
```

---

## Step 8 — Open the firewall (if ufw is enabled)

```bash
sudo ufw allow 80,443/tcp
```

---

## Step 9 — Verify it works

Check the site responds:

```bash
curl -sI https://vault.plebeian.build | head -3
```

Check the market-data proxy (should return Yahoo JSON — means no CORS problem):

```bash
curl -s "https://vault.plebeian.build/yahoo/v8/finance/chart/AAPL?range=1d&interval=5m" | head -c 120
```

Then open `https://vault.plebeian.build` in your browser:
- Log in with your Nostr npub (Join button)
- The ticker tape should stream live quotes
- **No** "Market feed unavailable" banner (that only appears when the fallback
  proxy is down — with same-origin you're independent of it)

---

## Step 10 (optional) — 24/7 alert watcher (systemd)

Create the config:

```bash
sudo cp server/.env.example /etc/vault-alerts.env
```

Edit it and set your nsec:

```bash
sudo nano /etc/vault-alerts.env
```

Install the service:

```bash
sudo cp server/vault-alerts.service /etc/systemd/system/
```

```bash
sudo systemctl daemon-reload
```

```bash
sudo systemctl enable --now vault-alerts
```

Check it's running:

```bash
sudo systemctl status vault-alerts
```

Watch the log:

```bash
journalctl -u vault-alerts -f
```

---

## Step 11 (optional) — Hourly snapshot pusher (cron)

Add a cron job:

```bash
crontab -e
```

Add this line (hourly):

```
0 * * * * cd /var/www/vault && /usr/bin/node server/market-snapshot.mjs >> /var/log/vault-snapshot.log 2>&1
```

Then watch it work:

```bash
cat /var/log/vault-snapshot.log
```

---

## Updating the app later (after future changes are pushed)

```bash
cd /var/www/vault && git pull
```

```bash
VITE_MARKET_BASE=https://vault.plebeian.build npm run build
```

```bash
sudo systemctl reload nginx
```

That's it — one-liner updates forever.
