#!/usr/bin/env node
/**
 * Vault Terminal — hourly market snapshot pusher (server-side companion).
 *
 * Records the owner's watchlist prices onto Nostr once per run (or every N
 * seconds in --loop mode), building a personal, decentralized price history
 * that lives on the network — not on any app server.
 *
 * For each watchlist symbol it publishes a kind 30078 event:
 *
 *   d = "vault:snapshot:<SYMBOL>:<unix-hour>"
 *   t = [<SYMBOL>]                      (relay-queryable per symbol)
 *   content = NIP-44 ciphertext to the owner (private history)
 *
 * Every hour gets its own addressable event, so relays retain the full hourly
 * series. The app's stock page reads these via the `t` tag to show "Hourly
 * snapshots · Nostr history".
 *
 * Requirements: Node.js 18+, `npm ci`, and VAULT_NSEC (same account the app is
 * logged in with — used to read the encrypted watchlist and encrypt snapshots).
 *
 * Quick start:
 *   node server/market-snapshot.mjs            # snapshot once (cron-friendly)
 *   node server/market-snapshot.mjs --loop     # every VAULT_SNAPSHOT_INTERVAL
 *
 * Cron example (hourly):
 *   0 * * * * cd /var/www/vault && /usr/bin/node server/market-snapshot.mjs >> /var/log/vault-snapshot.log 2>&1
 */

import { createHash } from 'node:crypto';
import { finalizeEvent, getPublicKey, nip19 } from 'nostr-tools';
import { SimplePool } from 'nostr-tools/pool';
import { getConversationKey, encrypt as nip44Encrypt, decrypt as nip44Decrypt } from 'nostr-tools/nip44';

const WATCHLIST_D = 'vault:watchlist';
const WATCHLIST_KIND = 30078;
const SNAPSHOT_KIND = 30078;
const SNAPSHOT_PREFIX = 'vault:snapshot:';

/** Opaque symbol key for tags — the symbol never appears in plaintext. */
const symKey = (symbol) => createHash('sha256').update(symbol.toUpperCase()).digest('hex').slice(0, 16);

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

function parseWatchlist(content) {
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed?.symbols)) return parsed.symbols.map((s) => s.toUpperCase()).filter(Boolean);
  } catch {
    // ignore
  }
  return [];
}

async function readWatchlist(pool, relays, sk, pk) {
  const event = await pool.get(relays, {
    kinds: [WATCHLIST_KIND],
    authors: [pk],
    '#d': [WATCHLIST_D],
    limit: 1,
  });
  if (!event) return [];
  const encrypted = event.tags.some(([name]) => name === 'enc');
  if (encrypted) {
    try {
      const plain = nip44Decrypt(event.content, getConversationKey(sk, pk));
      return parseWatchlist(plain);
    } catch {
      log('Could not decrypt watchlist — is VAULT_NSEC the same account?');
      return [];
    }
  }
  return parseWatchlist(event.content);
}

async function fetchQuote(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=5m`;
  const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${symbol}`);
  const data = await res.json();
  const meta = data?.chart?.result?.[0]?.meta;
  if (!meta || typeof meta.regularMarketPrice !== 'number') throw new Error(`No price for ${symbol}`);
  const prev = meta.chartPreviousClose ?? meta.previousClose ?? null;
  return {
    symbol: symbol.toUpperCase(),
    name: meta.longName ?? meta.shortName ?? symbol.toUpperCase(),
    price: meta.regularMarketPrice,
    prevClose: prev,
    changePct: prev ? ((meta.regularMarketPrice - prev) / prev) * 100 : null,
    volume: meta.regularMarketVolume ?? null,
  };
}

async function runSnapshots({ symbolsOverride }) {
  const nsec = env('VAULT_NSEC');
  if (!nsec) {
    log('ERROR: VAULT_NSEC is not set. See server/.env.example');
    return { ok: false };
  }

  const sk = decodeSecretKey(nsec);
  const pk = getPublicKey(sk);
  const relays = (env('VAULT_RELAYS') ? env('VAULT_RELAYS').split(',').map((r) => r.trim()) : DEFAULT_RELAYS).filter(Boolean);
  const pool = new SimplePool();
  const conversationKey = getConversationKey(sk, pk);

  try {
    let symbols = symbolsOverride;
    if (!symbols || symbols.length === 0) {
      symbols = await readWatchlist(pool, relays, sk, pk);
    }
    if (symbols.length === 0) {
      log('No symbols to snapshot (empty watchlist or none found).');
      return { ok: true };
    }

    const hour = Math.floor(Date.now() / 1000 / 3600) * 3600;
    const ts = Math.floor(Date.now() / 1000);
    const results = [];

    for (const symbol of symbols) {
      try {
        const q = await fetchQuote(symbol);
        const content = nip44Encrypt(
          JSON.stringify({
            version: 1,
            symbol: q.symbol,
            name: q.name,
            price: q.price,
            prevClose: q.prevClose,
            changePct: q.changePct,
            volume: q.volume,
            ts,
          }),
          conversationKey,
        );
        const signed = finalizeEvent(
          {
            kind: SNAPSHOT_KIND,
            content,
            tags: [
              ['d', `${SNAPSHOT_PREFIX}${symKey(q.symbol)}:${hour}`],
              ['t', symKey(q.symbol)],
              ['enc', 'nip44'],
            ],
            created_at: ts,
          },
          sk,
        );
        await pool.publish(relays, signed);
        results.push(`${q.symbol} $${q.price.toFixed(2)}`);
      } catch (error) {
        log(`SKIP ${symbol}: ${error.message}`);
      }
    }

    log(`Snapshot hour ${new Date(hour * 1000).toISOString()} → ${results.length}/${symbols.length} saved: ${results.join(', ') || 'none'}`);
    return { ok: true, saved: results.length };
  } finally {
    pool.close(relays);
  }
}

const args = process.argv.slice(2);
const loop = args.includes('--loop');

const override = env('VAULT_SNAPSHOT_SYMBOLS')
  ? env('VAULT_SNAPSHOT_SYMBOLS').split(',').map((s) => s.trim()).filter(Boolean)
  : null;

const intervalSec = Math.max(300, Number(env('VAULT_SNAPSHOT_INTERVAL')) || 3600);

async function tick() {
  try {
    const result = await runSnapshots({ symbolsOverride: override });
    if (!loop || result.ok === false) {
      process.exit(result.ok === false ? 1 : 0);
    }
  } catch (error) {
    log(`ERROR: ${error.message}`);
    if (!loop) process.exit(1);
  }
}

log(`Vault snapshot pusher starting (loop: ${loop ? `${intervalSec}s` : 'single run'}${override ? `, symbols: ${override.join(',')}` : ', symbols: watchlist'})`);
tick();

if (loop) {
  const id = setInterval(tick, intervalSec * 1000);
  const shutdown = () => {
    log('Shutting down.');
    clearInterval(id);
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
