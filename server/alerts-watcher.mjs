#!/usr/bin/env node
/**
 * Vault Terminal — 24/7 alert watcher (server-side companion).
 *
 * Runs on your VPS independently of the browser app. Reads the price alerts
 * you saved from the terminal (they live on Nostr as kind 30078,
 * d = "vault:alerts"), polls Yahoo Finance for current prices every N seconds,
 * and when a condition triggers it:
 *
 *   1. Sends you an encrypted Nostr DM (NIP-17 gift wrap) — appears in any
 *      Nostr client, even while the terminal app is closed.
 *   2. POSTs to an optional webhook (VAULT_ALERT_WEBHOOK — point it at
 *      ntfy.sh, Pushover, Discord, etc.).
 *   3. Marks the alert as fired on Nostr (so it won't re-trigger), matching
 *      the behavior of the in-app AlertBell (which can re-arm it).
 *
 * Requirements: Node.js 18+ (global fetch) and `npm ci` in this repo so that
 * nostr-tools is available.
 *
 * Quick start:
 *   export VAULT_NSEC=nsec1...            # the account whose alerts to watch
 *   node server/alerts-watcher.mjs --once # test a single pass
 *   node server/alerts-watcher.mjs        # run forever (Ctrl+C to stop)
 *
 * For 24/7 operation use the bundled systemd unit:
 *   server/vault-alerts.service
 *
 * Env vars (see server/.env.example):
 *   VAULT_NSEC          (required) alert owner's secret key
 *   VAULT_RELAYS        (optional) comma-separated relay list
 *   VAULT_INTERVAL      (optional) seconds between checks, default 60
 *   VAULT_ALERT_WEBHOOK (optional) URL that receives a JSON POST on trigger
 *   VAULT_DM_TO         (optional) npub to receive DMs (default: the alert owner)
 *   VAULT_NO_DM         (optional) set to "1" to disable Nostr DMs
 *
 * Flags:
 *   --once     run a single check, then exit
 *   --dry-run  evaluate and log only; publish nothing, notify nobody
 *   --no-dm    skip Nostr DM notifications (webhook still fires)
 */

import { finalizeEvent, getPublicKey, nip19 } from 'nostr-tools';
import { SimplePool } from 'nostr-tools/pool';
import { getConversationKey, encrypt as nip44Encrypt, decrypt as nip44Decrypt } from 'nostr-tools/nip44';
import { wrapEvent } from 'nostr-tools/nip59';

const ALERTS_D = 'vault:alerts';
const ALERTS_KIND = 30078;

const DEFAULT_RELAYS = [
  'wss://relay.ditto.pub',
  'wss://relay.primal.net',
  'wss://nos.lol',
  'wss://relay.damus.io',
  'wss://relay.nostr.net',
  'wss://nostr.mom',
  'wss://relay.snort.social',
  'wss://premium.primal.net',
];

const RE_NOTIFY_MS = 10 * 60 * 1000; // don't re-notify the same alert within 10 min

const env = (name) => (process.env[name] ?? '').trim();

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

function decodeSecretKey(nsec) {
  const { type, data } = nip19.decode(nsec);
  if (type !== 'nsec') throw new Error('VAULT_NSEC must be an nsec secret key');
  if (data instanceof Uint8Array) return data;
  return Uint8Array.from(Buffer.from(data, 'hex'));
}

function parseAlerts(content) {
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed?.alerts)) {
      return parsed.alerts.filter(
        (a) => a && typeof a.symbol === 'string' && typeof a.value === 'number',
      );
    }
  } catch {
    // ignore malformed content
  }
  return [];
}

function describe(alert) {
  switch (alert.direction) {
    case 'above':
      return `${alert.symbol} > $${Number(alert.value).toFixed(2)}`;
    case 'below':
      return `${alert.symbol} < $${Number(alert.value).toFixed(2)}`;
    case 'pctUp':
      return `${alert.symbol} up ${alert.value}%`;
    case 'pctDown':
      return `${alert.symbol} down ${alert.value}%`;
    default:
      return `${alert.symbol} (${alert.direction}) ${alert.value}`;
  }
}

async function fetchPrice(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=5m`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${symbol}`);
  const data = await res.json();
  const meta = data?.chart?.result?.[0]?.meta;
  if (!meta || typeof meta.regularMarketPrice !== 'number') {
    throw new Error(`No price data for ${symbol}`);
  }
  return {
    price: meta.regularMarketPrice,
    prev: meta.chartPreviousClose ?? meta.previousClose ?? null,
    name: meta.longName ?? meta.shortName ?? symbol,
  };
}

function evaluate(alert, price, prev) {
  switch (alert.direction) {
    case 'above':
      return price > Number(alert.value);
    case 'below':
      return price < Number(alert.value);
    case 'pctUp':
      return typeof prev === 'number' && prev > 0 && ((price - prev) / prev) * 100 >= Number(alert.value);
    case 'pctDown':
      return typeof prev === 'number' && prev > 0 && ((price - prev) / prev) * 100 <= -Number(alert.value);
    default:
      return false;
  }
}

async function sendDm(pool, relays, senderSk, recipientPk, title, body) {
  const conversationKey = getConversationKey(senderSk, recipientPk);
  const message = `⚡ VAULT ALERT — ${title}\n\n${body}`;
  const inner = {
    kind: 14,
    content: nip44Encrypt(message, conversationKey),
    tags: [['p', recipientPk]],
    created_at: Math.floor(Date.now() / 1000),
  };
  const wrap = wrapEvent(inner, senderSk, recipientPk);
  await pool.publish(relays, wrap);
}

async function fireWebhook(url, payload) {
  if (!url) return;
  await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });
}

async function runCheck({ dryRun, noDm, recentlyNotified }) {
  const nsec = env('VAULT_NSEC');
  if (!nsec) {
    log('ERROR: VAULT_NSEC is not set. See server/.env.example');
    return { ok: false };
  }

  const senderSk = decodeSecretKey(nsec);
  const ownerPk = getPublicKey(senderSk);

  let recipientPk = ownerPk;
  const dmTo = env('VAULT_DM_TO');
  if (dmTo) {
    const decoded = nip19.decode(dmTo);
    if (decoded.type === 'npub') recipientPk = decoded.data;
    else if (decoded.type === 'nprofile') recipientPk = decoded.data.pubkey;
  }

  const relays = (env('VAULT_RELAYS') ? env('VAULT_RELAYS').split(',').map((r) => r.trim()) : DEFAULT_RELAYS).filter(Boolean);
  const pool = new SimplePool();

  try {
    const event = await pool.get(relays, {
      kinds: [ALERTS_KIND],
      authors: [ownerPk],
      '#d': [ALERTS_D],
      limit: 1,
    });

    if (!event) {
      log(`No alerts found for ${nip19.npubEncode(ownerPk)} on ${relays.length} relays.`);
      return { ok: true };
    }

    // Content is NIP-44 encrypted to the owner (enc tag) — the watcher holds
    // the nsec so it can decrypt, and re-encrypts when publishing fired state.
    const encrypted = event.tags.some(([name]) => name === 'enc');
    const conversationKey = getConversationKey(senderSk, ownerPk);

    let alerts;
    if (encrypted) {
      try {
        const plain = nip44Decrypt(event.content, conversationKey);
        alerts = parseAlerts(plain);
      } catch (error) {
        log(`Could not decrypt alerts: ${error.message}`);
        return { ok: true };
      }
    } else {
      alerts = parseAlerts(event.content);
    }

    const active = alerts.filter((a) => !a.firedAt);
    log(`Loaded ${alerts.length} alerts (${active.length} armed) for ${nip19.npubEncode(ownerPk).slice(0, 12)}…`);

    if (active.length === 0) return { ok: true };

    const fired = [];
    for (const alert of active) {
      try {
        const { price, prev, name } = await fetchPrice(alert.symbol);
        if (evaluate(alert, price, prev)) {
          fired.push({ ...alert, price, name });
        }
      } catch (error) {
        log(`SKIP ${alert.symbol}: ${error.message}`);
      }
    }

    if (fired.length === 0) {
      log('No alerts triggered this pass.');
      return { ok: true };
    }

    const now = Math.floor(Date.now() / 1000);
    for (const f of fired) {
      const last = recentlyNotified.get(f.id) ?? 0;
      if (Date.now() - last < RE_NOTIFY_MS) {
        log(`SKIP notify (already notified) ${describe(f)}`);
        continue;
      }
      recentlyNotified.set(f.id, Date.now());

      const title = describe(f);
      const body = `${f.name}: now $${f.price.toFixed(2)}`;
      log(`TRIGGERED: ${title} — ${body}${dryRun ? ' [DRY RUN]' : ''}`);
      if (dryRun) continue;

      if (!noDm && env('VAULT_NO_DM') !== '1') {
        try {
          await sendDm(pool, relays, senderSk, recipientPk, title, body);
          log(`  → DM sent to ${nip19.npubEncode(recipientPk).slice(0, 12)}…`);
        } catch (error) {
          log(`  → DM failed: ${error.message}`);
        }
      }

      const webhook = env('VAULT_ALERT_WEBHOOK');
      if (webhook) {
        try {
          await fireWebhook(webhook, { alert: f, title, body });
          log(`  → webhook POSTed`);
        } catch (error) {
          log(`  → webhook failed: ${error.message}`);
        }
      }
    }

    if (!dryRun) {
      // Mark fired alerts on Nostr so the app's bell shows them as FIRED.
      const firedIds = new Set(fired.map((f) => f.id));
      const next = alerts.map((a) => (firedIds.has(a.id) ? { ...a, firedAt: now } : a));
      const payload = JSON.stringify({ version: 1, alerts: next });
      const signed = finalizeEvent(
        {
          kind: ALERTS_KIND,
          content: encrypted ? nip44Encrypt(payload, conversationKey) : payload,
          tags: [['d', ALERTS_D], ...(encrypted ? [['enc', 'nip44']] : [])],
          created_at: now,
        },
        senderSk,
      );
      try {
        await pool.publish(relays, signed);
        log(`  → ${fired.length} alert(s) marked as fired on Nostr`);
      } catch (error) {
        log(`  → could not publish fired state: ${error.message}`);
      }
    }

    return { ok: true, fired: fired.length };
  } finally {
    pool.close(relays);
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const once = args.includes('--once');
const dryRun = args.includes('--dry-run');
const noDm = args.includes('--no-dm');

const intervalSec = Math.max(15, Number(env('VAULT_INTERVAL')) || 60);
const recentlyNotified = new Map(); // alertId -> timestamp

async function tick() {
  try {
    const result = await runCheck({ dryRun, noDm, recentlyNotified });
    if (once || result.ok === false) {
      process.exit(result.ok === false ? 1 : 0);
    }
  } catch (error) {
    log(`ERROR in check: ${error.message}`);
    if (once) process.exit(1);
  }
}

log(`Vault alert watcher starting — interval ${intervalSec}s${dryRun ? ' (DRY RUN)' : ''}${noDm ? ' (DM disabled)' : ''}`);
tick();

if (!once) {
  const id = setInterval(tick, intervalSec * 1000);
  const shutdown = () => {
    log('Shutting down.');
    clearInterval(id);
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
