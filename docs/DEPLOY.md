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

Start nginx now (installed but not running by default on some images):

```bash
sudo systemctl enable --now nginx
```

```bash
sudo systemctl status nginx
```

Should show `Active: active (running)`.

> **Gotcha — port 80 already in use:** if `nginx` fails with
> `bind() to 0.0.0.0:80 failed`, something else is on port 80 (often Apache on
> VPS images). Find it, stop it, then start nginx:
>
> ```bash
> sudo ss -tlnp | grep -E ':80\b'
> ```
> ```bash
> sudo systemctl stop apache2 && sudo systemctl disable apache2
> ```
> ```bash
> sudo systemctl start nginx
> ```

---

## Step 3 — Get the code

`/var/www` is owned by root, so first create the folder and take ownership of
it (this also lets `npm ci` / the build write files without sudo):

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

---

## Appendix — Option B: Caddy already owns ports 80/443

If another web server owns 80/443 on the host (e.g. the `torii-quest-web`
Caddy container on this box), **don't stop it**. Front Vault with Caddy
instead: Caddy (public 80/443) reverse-proxies `vault.plebeian.build` to
nginx on an internal port, and auto-issues the TLS cert (no certbot).

```
Browser → https://vault.plebeian.build (443) → Caddy (torii-quest-web)
        → reverse_proxy → host nginx 127.0.0.1:8081 → dist + /yahoo /cboe
```

**1. Install the internal-port nginx config** (from the repo):

```bash
sudo cp deploy/nginx-vault-internal.conf /etc/nginx/sites-available/vault-terminal
```

```bash
sudo sed -i 's/vault\.example\.com/vault.plebeian.build/' /etc/nginx/sites-available/vault-terminal
```

```bash
sudo ln -s /etc/nginx/sites-available/vault-terminal /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
```

```bash
sudo nginx -t && sudo systemctl start nginx
```

**2. Find where Caddy's config lives** (the container's Caddyfile):

```bash
sudo docker inspect torii-quest-web --format '{{json .Mounts}}'
```

Look for a mount containing `Caddyfile` — the host path (to edit) and the
container path (usually `/etc/caddy/Caddyfile`).

**3. Check the network mode** (tells us the upstream IP):

```bash
sudo docker inspect torii-quest-web --format '{{.HostConfig.NetworkMode}}'
```

- `bridge` → upstream is the docker gateway: `172.17.0.1:8081`
- `host` → upstream is `127.0.0.1:8081`

**4. Add the site block to the Caddyfile**:

```
vault.plebeian.build {
    reverse_proxy 172.17.0.1:8081
}
```

(Use `127.0.0.1:8081` for host networking.)

**5. Apply it** — if the Caddyfile is a mounted file, edit it on the host,
then reload (no restart needed):

```bash
sudo docker exec torii-quest-web caddy reload --config /etc/caddy/Caddyfile
```

If it's baked into the image instead: copy it in and restart:

```bash
sudo docker cp /path/to/edited/Caddyfile torii-quest-web:/etc/caddy/Caddyfile
sudo docker restart torii-quest-web
```

**6. Verify** — DNS must point `vault.plebeian.build` at this VPS (Caddy needs
it to issue the cert):

```bash
curl -sI https://vault.plebeian.build | head -3
```

Caddy auto-issues and renews the TLS cert — **skip the certbot step entirely**
when using this option.
