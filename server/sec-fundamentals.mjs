#!/usr/bin/env node
/**
 * Vault Terminal — SEC fundamentals fetcher (server-side companion).
 *
 * Pulls structured financial statements from SEC EDGAR (free, no API key)
 * for the owner's US-listed watchlist and publishes an encrypted summary to
 * Nostr (kind 30078, d = "vault:fundamentals:<SYMBOL>", t = <SYMBOL>). The
 * app's stock page renders revenue / net income / EPS / margin charts from it.
 *
 * Canadian and other non-US listings are skipped (SEDAR has no free API) —
 * those come via manual filing upload in Phase 2.
 *
 * Requirements: Node 18+, `npm ci`, VAULT_NSEC (reads the encrypted watchlist,
 * encrypts reports). SEC politely asks for a descriptive User-Agent.
 *
 * Usage:
 *   node server/sec-fundamentals.mjs              # run once (cron-friendly)
 *   node server/sec-fundamentals.mjs --loop       # every VAULT_SEC_INTERVAL
 *
 * Cron (daily is plenty — filings change slowly):
 *   0 6 * * * cd /var/www/vault && /usr/bin/node server/sec-fundamentals.mjs >> /var/log/vault-sec.log 2>&1
 */

import { createHash } from 'node:crypto';
import { finalizeEvent, getPublicKey, nip19 } from 'nostr-tools';
import { SimplePool } from 'nostr-tools/pool';
import { getConversationKey, encrypt as nip44Encrypt, decrypt as nip44Decrypt } from 'nostr-tools/nip44';

const WATCHLIST_D = 'vault:watchlist';
const KIND = 30078;
const FUND_PREFIX = 'vault:fundamentals:';
const SEC_UA = 'VaultTerminal/1.0 (contact: vault@example.com)';

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

// us-gaap concepts, tried in order.
const CONCEPTS = {
  revenue: ['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'SalesRevenueNet'],
  netIncome: ['NetIncomeLoss'],
  eps: ['EarningsPerShareBasic'],
  grossProfit: ['GrossProfit'],
  operatingIncome: ['OperatingIncomeLoss'],
  totalAssets: ['Assets'],
  totalLiabilities: ['Liabilities'],
};

// Symbols that clearly aren't US equities (crypto, indices, FX, foreign).
function isUsEquity(symbol) {
  if (!/^[A-Z0-9]{1,10}(\.\w{1,4})?$/.test(symbol)) return false;
  if (symbol.includes('=') || symbol.includes('^') || symbol.includes('-')) return false;
  const suffix = symbol.includes('.') ? symbol.split('.').pop().toUpperCase() : '';
  const foreign = new Set(['TO', 'V', 'CN', 'L', 'PA', 'DE', 'HK', 'T', 'AX', 'MI', 'KQ', 'NZ', 'J']);
  return !foreign.has(suffix);
}

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
  const event = await pool.get(relays, { kinds: [KIND], authors: [pk], '#d': [WATCHLIST_D], limit: 1 });
  if (!event) return [];
  if (event.tags.some(([name]) => name === 'enc')) {
    try {
      return parseWatchlist(nip44Decrypt(event.content, getConversationKey(sk, pk)));
    } catch {
      log('Could not decrypt watchlist.');
      return [];
    }
  }
  return parseWatchlist(event.content);
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': SEC_UA }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

/** Extract annual (10-K, FY) values for a concept, keyed by fiscal year. */
function annualSeries(facts, conceptKeys) {
  const g = facts?.['us-gaap'];
  if (!g) return new Map();
  for (const key of conceptKeys) {
    const concept = g[key];
    if (!concept?.units) continue;
    for (const unitName of Object.keys(concept.units)) {
      const entries = concept.units[unitName];
      if (!Array.isArray(entries)) continue;
      const byYear = new Map();
      for (const e of entries) {
        if (e.form !== '10-K' || e.fp !== 'FY' || typeof e.fy !== 'number' || typeof e.val !== 'number') continue;
        const cur = byYear.get(e.fy);
        // Prefer the most recently filed value for a fiscal year.
        if (cur === undefined || (e.filed ?? '') > (cur.filed ?? '')) {
          byYear.set(e.fy, { val: e.val, filed: e.filed ?? '' });
        }
      }
      if (byYear.size > 0) return byYear;
    }
  }
  return new Map();
}

async function fetchFundamentals(symbol, cik) {
  const url = `https://data.sec.gov/api/xbrl/companyfacts/CIK${String(cik).padStart(10, '0')}.json`;
  const data = await fetchJson(url);

  const series = {};
  for (const [name, keys] of Object.entries(CONCEPTS)) {
    series[name] = annualSeries(data.facts, keys);
  }

  const years = [];
  const yearSet = new Set([...series.revenue.keys(), ...series.netIncome.keys(), ...series.eps.keys()]);
  for (const fy of [...yearSet].sort((a, b) => a - b).slice(-8)) {
    const get = (m) => series[m].get(fy)?.val ?? null;
    const revenue = get('revenue');
    const netIncome = get('netIncome');
    years.push({
      year: fy,
      revenue,
      netIncome,
      eps: get('eps'),
      grossProfit: get('grossProfit'),
      operatingIncome: get('operatingIncome'),
      totalAssets: get('totalAssets'),
      totalLiabilities: get('totalLiabilities'),
    });
  }

  return {
    version: 1,
    symbol,
    cik,
    name: data.entityName ?? symbol,
    updatedAt: Math.floor(Date.now() / 1000),
    years,
  };
}

async function runSec({ symbolsOverride, maxSymbols }) {
  const nsec = env('VAULT_NSEC');
  if (!nsec) {
    log('ERROR: VAULT_NSEC is not set.');
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
    symbols = [...new Set(symbols.map((s) => s.toUpperCase()).filter(isUsEquity))].slice(0, maxSymbols);

    if (symbols.length === 0) {
      log('No US-equity symbols to fetch fundamentals for.');
      return { ok: true };
    }
    log(`Fetching SEC fundamentals for ${symbols.length} US equities…`);

    const tickers = await fetchJson('https://www.sec.gov/files/company_tickers.json');
    const cikByTicker = new Map();
    for (const entry of Object.values(tickers)) {
      if (entry && entry.ticker) cikByTicker.set(entry.ticker.toUpperCase(), entry.cik_str);
    }

    const ts = Math.floor(Date.now() / 1000);
    let done = 0;
    for (const symbol of symbols) {
      const cik = cikByTicker.get(symbol);
      if (!cik) {
        log(`SKIP ${symbol}: no CIK found`);
        continue;
      }
      try {
        const report = await fetchFundamentals(symbol, cik);
        if (report.years.length === 0) {
          log(`SKIP ${symbol}: no annual data`);
          continue;
        }
        const content = nip44Encrypt(JSON.stringify(report), conversationKey);
        const signed = finalizeEvent(
          {
            kind: KIND,
            content,
            tags: [
              ['d', `${FUND_PREFIX}${symKey(symbol)}`],
              ['t', symKey(symbol)],
              ['enc', 'nip44'],
            ],
            created_at: ts,
          },
          sk,
        );
        await pool.publish(relays, signed);
        const latest = report.years[report.years.length - 1];
        done++;
        log(`OK ${symbol}: ${report.years.length} yrs, FY${latest.year} rev $${latest.revenue ? (latest.revenue / 1e9).toFixed(1) + 'B' : 'n/a'}`);
      } catch (error) {
        log(`SKIP ${symbol}: ${error.message}`);
      }
      await new Promise((r) => setTimeout(r, 350)); // be kind to SEC
    }

    log(`Done: ${done}/${symbols.length} reports published to Nostr.`);
    return { ok: true, done };
  } finally {
    pool.close(relays);
  }
}

const args = process.argv.slice(2);
const loop = args.includes('--loop');
const override = env('VAULT_SEC_SYMBOLS') ? env('VAULT_SEC_SYMBOLS').split(',').map((s) => s.trim()).filter(Boolean) : null;
const maxSymbols = Math.max(1, Number(env('VAULT_SEC_MAX')) || 25);
const intervalSec = Math.max(3600, Number(env('VAULT_SEC_INTERVAL')) || 86400);

async function tick() {
  try {
    const result = await runSec({ symbolsOverride: override, maxSymbols });
    if (!loop || result.ok === false) process.exit(result.ok === false ? 1 : 0);
  } catch (error) {
    log(`ERROR: ${error.message}`);
    if (!loop) process.exit(1);
  }
}

log(`Vault SEC fundamentals fetcher starting (loop: ${loop ? `${intervalSec}s` : 'single run'}, max ${maxSymbols} symbols)`);
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
