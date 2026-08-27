# VPS Ops — Rules for ALL Agents working on this box

> Shared Ubuntu VPS (`ch-server`, user `ubuntu`). **Multiple projects live here.
> Read this file before touching anything.** Ignore it and you will take down
> other people's sites. This has happened repeatedly. Do not be that agent.

## Non-negotiables

1. **Host Caddy (systemd `caddy`) is the ONLY public front door** — it owns
   ports 80/443 and ALL TLS. Its one config file is `/etc/caddy/Caddyfile`.
   - **Append only. NEVER rewrite the whole file.**
   - NEVER bind host ports 80/443. NEVER run certbot.
   - After editing: `sudo systemctl reload caddy`.
2. **Host nginx (systemd `nginx`) serves the static backends** on internal
   ports. NEVER stop, disable, or kill nginx. If a site dies, FIRST check:
   `sudo systemctl status nginx --no-pager | head -8` — if it's failed,
   `sudo nginx -t` (fix any dangling symlink in `/etc/nginx/sites-enabled/`),
   then `sudo systemctl start nginx`.
3. **Lock file before shared work.** Creating/modifying Caddy, nginx, or port
   mappings? Create `/tmp/vps-agent.lock` containing your name first. If the
   file already exists, **wait** until it's gone. Delete it when done. Never
   work on shared configs at the same time as another agent.
4. **Verify after every change:**
   `curl -s -o /dev/null -w "%{http_code}\n" https://<site>/` — expect 200 for
   every site you touched AND every site you didn't.

## Route map (current, host Caddyfile)

| Hostname | Backend |
| --- | --- |
| `scheduler.plebeian.build` | `127.0.0.1:8080` (docker `plebeian-scheduler`) |
| `app.plebeian.build` | static: `/home/ubuntu/scheduler-app/dist` |
| `relay.sahmstr.com` | `127.0.0.1:7777` (strfry) |
| `relay.plebeian.build` | `127.0.0.1:7778` (strfry) |
| `vault.plebeian.build` | nginx `127.0.0.1:8081` (`/var/www/vault/dist` + `/yahoo /cboe` proxies) |
| `sahmstr.com`, `www.sahmstr.com` | nginx `127.0.0.1:8083` (`/var/www/sahmstr.com/`) |
| `torri.plebeian.build` | **REMOVED 2026-08-26** (torii-quest game was decommissioned) |

Ports in use: 8080 (scheduler) · 8081 (vault nginx) · 8083 (sahmstr nginx) ·
7777/7778 (relays) · others (houseof — see `/etc/nginx/sites-enabled/`).

## Docker

- Relays run as containers (strfry): `plebeian-relay`, `sahmstr-relay`,
  `torii-quest-relay`. Don't stop/restart/remove other projects' containers.
- `plebeian-scheduler` (port 8080) is another project's — leave it.
- `torii-quest-web` was removed — do not `docker compose up` it back.

## Repos & deploy paths (one clone = one deploy path)

- **Vault:** `/var/www/vault` → `bash deploy.sh https://vault.plebeian.build`
  (pull → build → nginx reload). Don't hand-edit its nginx config or restart
  its systemd services (`vault-alerts`, `vault-analyzer`).
- **sahmstr:** build to `/var/www/sahmstr.com/` (served by nginx 8083).
- **torii-quest:** removed; re-clone from GitHub if ever needed.

## Secrets

- nsecs / API keys live in `/etc/vault-alerts.env` on the server. NEVER ask
  for them in chat, NEVER put them in a repo. The repo has `.env.example`
  templates only.

## After any config change, always confirm:

```bash
curl -s -o /dev/null -w "vault %{http_code}\n" https://vault.plebeian.build/
curl -s -o /dev/null -w "sahmstr %{http_code}\n" https://sahmstr.com/
curl -s -o /dev/null -w "scheduler %{http_code}\n" https://scheduler.plebeian.build/
curl -s -o /dev/null -w "app %{http_code}\n" https://app.plebeian.build/
```

All four = `200`. If not, stop and fix before moving on.
