#!/usr/bin/env node
/**
 * Vault Terminal — AI filing analyzer (server-side companion, Phase 2).
 *
 * A Nostr-driven worker: it watches for encrypted analysis-request events the
 * app publishes (kind 30078, d = "vault:analysis:request:<SYMBOL>"), pulls a
 * financial digest from SEC EDGAR, sends it to an OpenAI-compatible LLM, and
 * publishes an encrypted report back to Nostr (d = "vault:analysis:<SYMBOL>").
 *
 * The report is the "contextvm" — it lives on Nostr, encrypted to the owner,
 * and follows the npub like everything else.
 *
 * Model-agnostic: works with DeepSeek, OpenAI, or local Ollama via one env var:
 *   ANALYZER_BASE_URL=https://api.deepseek.com/v1   (OpenAI-compatible base)
 *   ANALYZER_API_KEY=sk-...                          (omit for local Ollama)
 *   ANALYZER_MODEL=deepseek-chat                     (e.g. llama3.1 for Ollama)
 *
 * Requirements: Node 18+, `npm ci`, VAULT_NSEC (reads requests, encrypts
 * reports), and an LLM endpoint configured.
 *
 * Usage:
 *   node server/analyzer.mjs --once       # process pending requests, then exit
 *   node server/analyzer.mjs              # loop (default, checks every N sec)
 *   node server/analyzer.mjs --dry-run    # log only, publish nothing
 *
 * 24/7 via systemd (add a second unit) or cron every minute:
 *   * * * * * cd /var/www/vault && set -a && . /etc/vault-alerts.env && set +a && /usr/bin/node server/analyzer.mjs --once >> /var/log/vault-analyzer.log 2>&1
 */

import { createHash } from 'node:crypto';
import { finalizeEvent, getPublicKey, nip19 } from 'nostr-tools';
import { SimplePool } from 'nostr-tools/pool';
import { getConversationKey, encrypt as nip44Encrypt, decrypt as nip44Decrypt } from 'nostr-tools/nip44';

const KIND = 30078;
const REQUEST_PREFIX = 'vault:analysis:request:';
const RESULT_PREFIX = 'vault:analysis:';
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

const CONCEPTS = {
  revenue: ['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'SalesRevenueNet'],
  netIncome: ['NetIncomeLoss'],
  eps: ['EarningsPerShareBasic'],
  grossProfit: ['GrossProfit'],
  operatingIncome: ['OperatingIncomeLoss'],
  totalAssets: ['Assets'],
  totalLiabilities: ['Liabilities'],
};

const env = (name) => (process.env[name] ?? '').trim();
const log = (...args) => console.log(new Date().toISOString(), ...args);

function decodeSecretKey(nsec) {
  const { type, data } = nip19.decode(nsec);
  if (type !== 'nsec') throw new Error('VAULT_NSEC must be an nsec secret key');
  if (data instanceof Uint8Array) return data;
  return Uint8Array.from(Buffer.from(data, 'hex'));
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': SEC_UA }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

/** Annual (10-K, FY) series for a concept, keyed by fiscal year. */
function annualSeries(facts, keys) {
  const g = facts?.['us-gaap'];
  if (!g) return new Map();
  for (const key of keys) {
    const concept = g[key];
    if (!concept?.units) continue;
    for (const entries of Object.values(concept.units)) {
      if (!Array.isArray(entries)) continue;
      const byYear = new Map();
      for (const e of entries) {
        if (e.form !== '10-K' || e.fp !== 'FY' || typeof e.fy !== 'number' || typeof e.val !== 'number') continue;
        const cur = byYear.get(e.fy);
        if (cur === undefined || (e.filed ?? '') > (cur.filed ?? '')) byYear.set(e.fy, { val: e.val, filed: e.filed ?? '' });
      }
      if (byYear.size > 0) return byYear;
    }
  }
  return new Map();
}

/** Compact financial digest for the model: last 6 fiscal years of key metrics. */
async function secDigest(symbol) {
  const tickers = await fetchJson('https://www.sec.gov/files/company_tickers.json');
  let cik = null;
  for (const entry of Object.values(tickers)) {
    if (entry?.ticker?.toUpperCase() === symbol.toUpperCase()) { cik = entry.cik_str; break; }
  }
  if (!cik) throw new Error(`No SEC CIK for ${symbol}`);
  const facts = await fetchJson(`https://data.sec.gov/api/xbrl/companyfacts/CIK${String(cik).padStart(10, '0')}.json`);

  const series = {};
  for (const [name, keys] of Object.entries(CONCEPTS)) series[name] = annualSeries(facts.facts, keys);

  const years = new Set([...series.revenue.keys(), ...series.netIncome.keys(), ...series.eps.keys()]);
  const digest = {
    symbol: symbol.toUpperCase(),
    name: facts.entityName ?? symbol.toUpperCase(),
    fiscalYears: [...years].sort((a, b) => a - b).slice(-6).map((fy) => {
      const get = (m) => series[m].get(fy)?.val ?? null;
      return { year: fy, revenue: get('revenue'), netIncome: get('netIncome'), eps: get('eps'), grossProfit: get('grossProfit'), operatingIncome: get('operatingIncome'), totalAssets: get('totalAssets'), totalLiabilities: get('totalLiabilities') };
    }),
  };
  return digest;
}

/** Call any OpenAI-compatible chat completions endpoint. */
async function runModel(symbol, digest) {
  const base = env('ANALYZER_BASE_URL') || 'https://api.deepseek.com/v1';
  const key = env('ANALYZER_API_KEY');
  const model = env('ANALYZER_MODEL') || 'deepseek-chat';
  if (!key) throw new Error('ANALYZER_API_KEY not set (or point ANALYZER_BASE_URL at local Ollama and add a dummy key)');

  const prompt =
    `You are a careful, skeptical equity analyst. Here is the SEC 10-K financial digest for ${symbol}:\n` +
    JSON.stringify(digest) + '\n\n' +
    'Respond with a JSON object only (no markdown), with exactly these keys:\n' +
    '- "summary": 2-3 plain-English sentences on the business and recent financial trajectory\n' +
    '- "strengths": array of 3-5 short bullet strings\n' +
    '- "risks": array of 3-5 short bullet strings\n' +
    '- "insights": array of 2-4 short bullet strings (what to watch next)\n' +
    '- "verdict": one of "BUY", "HOLD", "SELL" plus a one-line reason, e.g. "HOLD: strong margins but rich valuation"\n' +
    'Base everything strictly on the data provided. Do not invent figures.';

  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], temperature: 0.3 }),
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) throw new Error(`model HTTP ${res.status}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content ?? '';
  const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
  return JSON.parse(cleaned);
}

async function runOnce({ dryRun }) {
  const nsec = env('VAULT_NSEC');
  if (!nsec) { log('ERROR: VAULT_NSEC is not set.'); return { ok: false }; }

  const sk = decodeSecretKey(nsec);
  const pk = getPublicKey(sk);
  const relays = (env('VAULT_RELAYS') ? env('VAULT_RELAYS').split(',').map((r) => r.trim()) : DEFAULT_RELAYS).filter(Boolean);
  const pool = new SimplePool();
  const conversationKey = getConversationKey(sk, pk);
  const now = Math.floor(Date.now() / 1000);

  try {
    const requests = await pool.querySync(relays, { kinds: [KIND], authors: [pk], limit: 20 });
    let processed = 0;

    for (const req of requests) {
      const d = req.tags.find(([k]) => k === 'd')?.[1] ?? '';
      if (!d.startsWith(REQUEST_PREFIX)) continue;

      // The symbol lives inside the encrypted request (d-tags are hashed).
      let symbol = '';
      let requestedAt = 0;
      try {
        const parsed = JSON.parse(nip44Decrypt(req.content, conversationKey));
        symbol = String(parsed.symbol ?? '').toUpperCase();
        requestedAt = parsed.createdAt ?? 0;
      } catch {
        log(`SKIP ${d}: could not decrypt request`);
        continue;
      }
      if (!/^[A-Z0-9.\-]{1,12}$/.test(symbol)) {
        log(`SKIP ${d}: no valid symbol in request`);
        continue;
      }

      const key = symKey(symbol);
      const existing = await pool.get(relays, { kinds: [KIND], authors: [pk], '#d': [`${RESULT_PREFIX}${key}`], limit: 1 });
      if (existing && requestedAt > 0) {
        try {
          const prev = JSON.parse(nip44Decrypt(existing.content, conversationKey));
          if (prev.updatedAt >= requestedAt) { log(`SKIP ${symbol}: fresh report exists`); continue; }
        } catch { /* no readable result — process */ }
      }

      log(`ANALYZING ${symbol}…${dryRun ? ' [DRY RUN]' : ''}`);
      if (dryRun) { processed++; continue; }

      try {
        const digest = await secDigest(symbol);
        const report = await runModel(symbol, digest);
        const content = nip44Encrypt(JSON.stringify({
          version: 1,
          symbol,
          model: env('ANALYZER_MODEL') || 'default',
          verdict: report.verdict,
          summary: report.summary,
          strengths: report.strengths,
          risks: report.risks,
          insights: report.insights,
          updatedAt: now,
          requestedAt,
        }), conversationKey);
        const signed = finalizeEvent({
          kind: KIND,
          content,
          tags: [
            ['d', `${RESULT_PREFIX}${key}`],
            ['t', key],
            ['enc', 'nip44'],
          ],
          created_at: now,
        }, sk);
        await pool.publish(relays, signed);
        processed++;
        log(`OK ${symbol}: ${String(report.verdict ?? '').slice(0, 60)}`);
      } catch (error) {
        log(`FAIL ${symbol}: ${error.message}`);
      }
    }

    if (processed === 0) log('No pending analysis requests.');
    return { ok: true, processed };
  } finally {
    pool.close(relays);
  }
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const once = args.includes('--once');
const intervalSec = Math.max(15, Number(env('ANALYZER_INTERVAL')) || 60);

async function tick() {
  try {
    const result = await runOnce({ dryRun });
    if (once || result.ok === false) process.exit(result.ok === false ? 1 : 0);
  } catch (error) {
    log(`ERROR: ${error.message}`);
    if (once) process.exit(1);
  }
}

log(`Vault AI analyzer starting (${once ? 'single run' : `loop ${intervalSec}s`}${dryRun ? ' DRY RUN' : ''})`);
tick();
if (!once) {
  const id = setInterval(tick, intervalSec * 1000);
  const shutdown = () => { clearInterval(id); process.exit(0); };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
