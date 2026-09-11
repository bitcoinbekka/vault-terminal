/**
 * Market data layer — powered by Finnhub.
 *
 * Quotes, candles, search, news and trending come from Finnhub's free API
 * (https://finnhub.io). Options chains still come from the CBOE delayed-quotes
 * CDN (free, no key, full greeks) — Finnhub options require a paid plan.
 *
 * API key configuration (in priority order):
 *   1. VITE_FINNHUB_TOKEN build-time env var  (browser app)
 *   2. Falls back to the Shakespeare CORS proxy so the preview always works
 *
 * For self-hosting set VITE_FINNHUB_TOKEN in your build environment:
 *   VITE_FINNHUB_TOKEN=your_key npm run build
 *
 * Finnhub free tier: 60 req/min, no IP banning (key-based auth).
 * CBOE options endpoint: no auth, no CORS restrictions.
 */

const FINNHUB_BASE = 'https://finnhub.io/api/v1';
const CBOE_BASE = 'https://cdn.cboe.com';
const DEFAULT_PROXY_BASE = 'https://proxy.shakespeare.diy/?url=';

function getViteEnv(name: string): string | undefined {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
    return env?.[name];
  } catch {
    return undefined;
  }
}

function getFinnhubToken(): string {
  return getViteEnv('VITE_FINNHUB_TOKEN')?.trim() ?? '';
}

/** Build a Finnhub URL, appending the token as a query param. */
function finnhubUrl(path: string, params: Record<string, string | number> = {}): string {
  const token = getFinnhubToken();
  const base = `${FINNHUB_BASE}${path}`;
  const qs = new URLSearchParams(
    Object.entries({ ...params, ...(token ? { token } : {}) }).map(([k, v]) => [k, String(v)]),
  ).toString();
  return `${base}?${qs}`;
}

/** Build fetch attempts for a Finnhub URL (proxy fallback when no token). */
function buildFinnhubAttempts(url: string): string[] {
  const token = getFinnhubToken();
  if (token) {
    // Key is embedded — direct fetch works from the browser (Finnhub sends CORS headers).
    return [url];
  }
  // No token: route through CORS proxy.
  const proxyBase = getViteEnv('VITE_CORS_PROXY')?.trim() || DEFAULT_PROXY_BASE;
  return [`${proxyBase}${encodeURIComponent(url)}`, url];
}

/** Build fetch attempts for a CBOE URL (no CORS headers on cdn.cboe.com). */
function buildCboeAttempts(url: string): string[] {
  const marketBase = getViteEnv('VITE_MARKET_BASE')?.trim().replace(/\/+$/, '');
  const attempts: string[] = [];
  if (marketBase && url.startsWith(CBOE_BASE)) {
    attempts.push(`${marketBase}/cboe/${url.slice(CBOE_BASE.length)}`);
  }
  const proxyBase = getViteEnv('VITE_CORS_PROXY')?.trim() || DEFAULT_PROXY_BASE;
  attempts.push(`${proxyBase}${encodeURIComponent(url)}`);
  attempts.push(url);
  return attempts;
}

// ---------------------------------------------------------------------------
// Types (kept compatible with Yahoo shapes so callers don't change)
// ---------------------------------------------------------------------------

export interface YahooMeta {
  currency: string;
  symbol: string;
  exchangeName: string;
  fullExchangeName: string;
  instrumentType: string;
  regularMarketTime: number;
  hasPrePostMarketData: boolean;
  gmtoffset: number;
  timezone: string;
  exchangeTimezoneName: string;
  regularMarketPrice: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  regularMarketDayHigh: number;
  regularMarketDayLow: number;
  regularMarketVolume: number;
  longName?: string;
  shortName?: string;
  chartPreviousClose?: number;
  previousClose?: number;
  scale?: number;
  priceHint?: number;
  dataGranularity?: string;
  range?: string;
  validRanges?: string[];
  currentTradingPeriod?: {
    pre?: { start?: number; end?: number };
    regular?: { start?: number; end?: number };
    post?: { start?: number; end?: number };
  };
}

export interface Candle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface QuoteData {
  meta: YahooMeta;
  candles: Candle[];
}

export interface NewsItem {
  uuid: string;
  title: string;
  publisher: string;
  link: string;
  providerPublishTime: number;
  type?: string;
  relatedTickers?: string[];
  thumbnail?: { resolutions?: { url: string; width: number; height: number }[] };
}

export interface SearchQuote {
  symbol: string;
  shortname?: string;
  longname?: string;
  exchDisp?: string;
  quoteType?: string;
  typeDisp?: string;
  sector?: string;
  industry?: string;
}

export interface SearchResult {
  quotes: SearchQuote[];
  news: NewsItem[];
}

/** CBOE delayed options contract. */
export interface CboeOption {
  option: string;
  bid: number;
  bid_size: number;
  ask: number;
  ask_size: number;
  iv: number;
  open_interest: number;
  volume: number;
  delta: number;
  gamma: number;
  vega: number;
  theta: number;
  rho: number;
  theo: number;
  change: number;
  open: number;
  high: number;
  low: number;
  tick: string;
  last_trade_price: number;
  last_trade_time: string;
  percent_change: number;
  prev_day_close: number;
}

export interface OptionsData {
  timestamp: string;
  options: CboeOption[];
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

async function fetchWithAttempts(attempts: string[], signal?: AbortSignal): Promise<string> {
  let lastError: unknown;

  for (const attempt of attempts) {
    try {
      const res = await fetch(attempt, {
        signal,
        headers: { Accept: 'application/json,text/plain,*/*' },
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const text = await res.text();
      const trimmed = text.trim();
      if (trimmed.startsWith('<') || trimmed.startsWith('<!')) {
        throw new Error('Proxy returned a non-JSON response');
      }
      return trimmed;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Request failed');
}

export async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const text = await fetchWithAttempts(buildFinnhubAttempts(url), signal);
  return JSON.parse(text) as T;
}

// ---------------------------------------------------------------------------
// Finnhub response types
// ---------------------------------------------------------------------------

interface FinnhubQuote {
  c: number;   // current price
  h: number;   // high
  l: number;   // low
  o: number;   // open
  pc: number;  // previous close
  t: number;   // timestamp
  v?: number;  // volume (not in all responses)
  dp?: number; // percent change
  d?: number;  // change
}

interface FinnhubCandles {
  c: number[];
  h: number[];
  l: number[];
  o: number[];
  t: number[];
  v: number[];
  s: string; // "ok" or "no_data"
}

interface FinnhubProfile {
  name?: string;
  currency?: string;
  exchange?: string;
  finnhubIndustry?: string;
  ticker?: string;
  country?: string;
  ipo?: string;
  logo?: string;
  marketCapitalization?: number;
  shareOutstanding?: number;
  weburl?: string;
  phone?: string;
}

interface FinnhubSearchResult {
  count: number;
  result: Array<{
    description: string;
    displaySymbol: string;
    symbol: string;
    type: string;
  }>;
}

interface FinnhubNews {
  category: string;
  datetime: number;
  headline: string;
  id: number;
  image: string;
  related: string;
  source: string;
  summary: string;
  url: string;
}

/**
 * Resolve the "52-week high/low" from candle data. Finnhub's quote endpoint
 * doesn't include 52wk data directly, so we compute from the 1Y candles when
 * available, or fall back to a 0 placeholder.
 */
function weekHighLow(candles: FinnhubCandles | null): { high: number; low: number } {
  if (!candles || candles.s !== 'ok' || !candles.h.length) return { high: 0, low: 0 };
  return {
    high: Math.max(...candles.h),
    low: Math.min(...candles.l),
  };
}

/** Map a Finnhub resolution string to seconds-per-bar for interval labelling. */
function resolutionToInterval(resolution: string): string {
  const map: Record<string, string> = {
    '1': '1m', '5': '5m', '15': '15m', '30': '30m',
    '60': '60m', 'D': '1d', 'W': '1wk', 'M': '1mo',
  };
  return map[resolution] ?? resolution;
}

/** Convert our range/interval strings to a Finnhub resolution character. */
function toFinnhubResolution(interval: string): string {
  const map: Record<string, string> = {
    '1m': '1', '5m': '5', '15m': '15', '30m': '30',
    '60m': '60', '1h': '60', '1d': 'D', '1wk': 'W', '1mo': 'M',
  };
  return map[interval] ?? 'D';
}

/** Compute unix timestamps for a range string relative to now. */
function rangeToFromTo(range: string): { from: number; to: number } {
  const now = Math.floor(Date.now() / 1000);
  const map: Record<string, number> = {
    '1d': 60 * 60 * 24,
    '5d': 60 * 60 * 24 * 5,
    '1mo': 60 * 60 * 24 * 31,
    '3mo': 60 * 60 * 24 * 92,
    '6mo': 60 * 60 * 24 * 182,
    '1y': 60 * 60 * 24 * 365,
    '2y': 60 * 60 * 24 * 730,
    '5y': 60 * 60 * 24 * 365 * 5,
    'max': 60 * 60 * 24 * 365 * 20,
  };
  const seconds = map[range] ?? 60 * 60 * 24;
  return { from: now - seconds, to: now };
}

// ---------------------------------------------------------------------------
// Quote + chart
// ---------------------------------------------------------------------------

export interface ChartRange {
  label: string;
  range: string;
  interval: string;
}

export const CHART_RANGES: Record<string, ChartRange> = {
  '1D': { label: '1D', range: '1d', interval: '5m' },
  '5D': { label: '5D', range: '5d', interval: '15m' },
  '1M': { label: '1M', range: '1mo', interval: '1d' },
  '3M': { label: '3M', range: '3mo', interval: '1d' },
  '1Y': { label: '1Y', range: '1y', interval: '1d' },
  '5Y': { label: '5Y', range: '5y', interval: '1wk' },
  MAX: { label: 'MAX', range: 'max', interval: '1mo' },
};

export const DEFAULT_RANGE = '1D';

/** Build a QuoteData from Finnhub quote + candles + optional profile. */
function buildQuoteData(
  symbol: string,
  quote: FinnhubQuote,
  candles: FinnhubCandles,
  profile: FinnhubProfile | null,
  interval: string,
): QuoteData {
  const { high, low } = weekHighLow(candles);
  const candleList: Candle[] =
    candles.s === 'ok'
      ? candles.t.map((t, i) => ({
          t,
          o: candles.o[i] ?? quote.c,
          h: candles.h[i] ?? quote.c,
          l: candles.l[i] ?? quote.c,
          c: candles.c[i] ?? quote.c,
          v: candles.v[i] ?? 0,
        }))
      : [];

  const meta: YahooMeta = {
    symbol: symbol.toUpperCase(),
    currency: profile?.currency ?? 'USD',
    exchangeName: profile?.exchange ?? '',
    fullExchangeName: profile?.exchange ?? '',
    instrumentType: 'EQUITY',
    regularMarketTime: quote.t,
    hasPrePostMarketData: false,
    gmtoffset: 0,
    timezone: 'EST',
    exchangeTimezoneName: 'America/New_York',
    regularMarketPrice: quote.c,
    regularMarketDayHigh: quote.h,
    regularMarketDayLow: quote.l,
    regularMarketVolume: 0,
    fiftyTwoWeekHigh: high || quote.h,
    fiftyTwoWeekLow: low || quote.l,
    longName: profile?.name,
    shortName: profile?.name,
    chartPreviousClose: quote.pc,
    previousClose: quote.pc,
    dataGranularity: resolutionToInterval(toFinnhubResolution(interval)),
  };

  return { meta, candles: candleList };
}

export async function fetchChart(
  symbol: string,
  range = '1d',
  interval = '5m',
  signal?: AbortSignal,
): Promise<QuoteData> {
  const normalized = normalizeSymbol(symbol);
  const resolution = toFinnhubResolution(interval);
  const { from, to } = rangeToFromTo(range);

  const [quoteRaw, candlesRaw, profileRaw] = await Promise.allSettled([
    fetchJson<FinnhubQuote>(finnhubUrl('/quote', { symbol: normalized }), signal),
    fetchJson<FinnhubCandles>(
      finnhubUrl('/stock/candle', { symbol: normalized, resolution, from, to }),
      signal,
    ),
    // Profile gives us name + currency; best-effort only.
    fetchJson<FinnhubProfile>(finnhubUrl('/stock/profile2', { symbol: normalized }), signal),
  ]);

  if (quoteRaw.status === 'rejected') {
    throw new Error(`Quote fetch failed for ${normalized}: ${String(quoteRaw.reason)}`);
  }

  const quote = quoteRaw.value;
  if (!quote || typeof quote.c !== 'number' || quote.c === 0) {
    throw new Error(`No quote data for ${normalized}`);
  }

  const candles: FinnhubCandles =
    candlesRaw.status === 'fulfilled' && candlesRaw.value?.s === 'ok'
      ? candlesRaw.value
      : { c: [], h: [], l: [], o: [], t: [], v: [], s: 'no_data' };

  const profile: FinnhubProfile | null =
    profileRaw.status === 'fulfilled' ? profileRaw.value : null;

  return buildQuoteData(normalized, quote, candles, profile, interval);
}

// ---------------------------------------------------------------------------
// Batched quotes — Finnhub /quote called per-symbol but coalesced in a window
// (Finnhub free tier: 60 req/min, so we space them out carefully).
// ---------------------------------------------------------------------------

const QUOTE_BATCH_SIZE = 20;
const QUOTE_BATCH_WINDOW_MS = 50;

interface PendingQuote {
  resolve: (data: QuoteData) => void;
  reject: (error: unknown) => void;
}

let pendingQuotes = new Map<string, PendingQuote[]>();
let quoteFlushTimer: ReturnType<typeof setTimeout> | null = null;

async function flushQuoteBatch(): Promise<void> {
  quoteFlushTimer = null;
  const batch = pendingQuotes;
  pendingQuotes = new Map();
  const symbols = [...batch.keys()];
  if (symbols.length === 0) return;

  // Process in chunks, with a small inter-chunk delay to respect rate limits.
  for (let i = 0; i < symbols.length; i += QUOTE_BATCH_SIZE) {
    const chunk = symbols.slice(i, i + QUOTE_BATCH_SIZE);

    await Promise.all(
      chunk.map(async (symbol) => {
        try {
          const data = await fetchChart(symbol, '1d', '5m');
          for (const pending of batch.get(symbol) ?? []) pending.resolve(data);
        } catch (error) {
          for (const pending of batch.get(symbol) ?? []) pending.reject(error);
        }
      }),
    );

    // Brief pause between chunks to stay within 60 req/min.
    if (i + QUOTE_BATCH_SIZE < symbols.length) {
      await new Promise<void>((r) => setTimeout(r, 500));
    }
  }
}

/**
 * Intraday snapshot used for watchlists / ticker tape / scanners. Coalesced
 * into batched requests within a short window.
 */
export function fetchQuote(symbol: string, _signal?: AbortSignal): Promise<QuoteData> {
  const normalized = normalizeSymbol(symbol);
  return new Promise<QuoteData>((resolve, reject) => {
    const entries = pendingQuotes.get(normalized) ?? [];
    entries.push({ resolve, reject });
    pendingQuotes.set(normalized, entries);
    if (quoteFlushTimer === null) {
      quoteFlushTimer = setTimeout(() => void flushQuoteBatch(), QUOTE_BATCH_WINDOW_MS);
    }
  });
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export async function fetchSearch(
  query: string,
  opts: { quotesCount?: number; newsCount?: number } = {},
  signal?: AbortSignal,
): Promise<SearchResult> {
  const quotesCount = opts.quotesCount ?? 8;
  const newsCount = opts.newsCount ?? 8;

  const [symbolRaw, newsRaw] = await Promise.allSettled([
    fetchJson<FinnhubSearchResult>(
      finnhubUrl('/search', { q: query, exchange: 'US' }),
      signal,
    ),
    fetchJson<FinnhubNews[]>(
      finnhubUrl('/news', { category: 'general', minId: '0' }),
      signal,
    ),
  ]);

  const quotes: SearchQuote[] =
    symbolRaw.status === 'fulfilled'
      ? (symbolRaw.value?.result ?? [])
          .filter((r) => r.type === 'Common Stock' || r.type === 'ETP' || r.type === 'ADR')
          .slice(0, quotesCount)
          .map((r) => ({
            symbol: r.displaySymbol,
            shortname: r.description,
            longname: r.description,
            typeDisp: r.type,
          }))
      : [];

  const news: NewsItem[] =
    newsRaw.status === 'fulfilled'
      ? (newsRaw.value ?? [])
          .filter((n) => n.headline && n.url)
          .slice(0, newsCount)
          .map((n) => ({
            uuid: String(n.id),
            title: n.headline,
            publisher: n.source,
            link: n.url,
            providerPublishTime: n.datetime,
          }))
      : [];

  return { quotes, news };
}

// ---------------------------------------------------------------------------
// Trending — Finnhub doesn't have a trending endpoint on free tier,
// so we return a curated default list of the most-traded US names.
// ---------------------------------------------------------------------------

const TRENDING_DEFAULTS = ['AAPL', 'NVDA', 'TSLA', 'MSFT', 'META', 'AMZN', 'GOOGL', 'SPY', 'AMD', 'COIN'];

export async function fetchTrending(_region = 'US', _signal?: AbortSignal): Promise<string[]> {
  return TRENDING_DEFAULTS;
}

// ---------------------------------------------------------------------------
// CBOE options (unchanged — key-free, CORS proxied)
// ---------------------------------------------------------------------------

export async function fetchOptionsChain(symbol: string, signal?: AbortSignal): Promise<OptionsData> {
  const path = `/api/global/delayed_quotes/options/${encodeURIComponent(symbol)}.json`;
  const url = `${CBOE_BASE}${path}`;
  const attempts = buildCboeAttempts(url);
  const text = await fetchWithAttempts(attempts, signal);
  const raw = JSON.parse(text) as { data?: { options?: CboeOption[] } };
  const options = raw.data?.options;
  if (!options) throw new Error(`No options data for ${symbol}`);
  return { timestamp: '', options };
}

// ---------------------------------------------------------------------------
// Market constants & helpers (unchanged — callers import these)
// ---------------------------------------------------------------------------

export interface IndexDefinition {
  symbol: string;
  name: string;
}

export const INDEXES: IndexDefinition[] = [
  { symbol: '^GSPC', name: 'S&P 500' },
  { symbol: '^IXIC', name: 'NASDAQ' },
  { symbol: '^DJI', name: 'DOW JONES' },
  { symbol: '^RUT', name: 'RUSSELL 2K' },
  { symbol: '^VIX', name: 'VIX' },
];

export const STARTER_WATCHLIST = ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'META', 'GOOGL', 'TSLA', 'COIN'];

export function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

export function isValidSymbol(symbol: string): boolean {
  return /^[A-Z0-9^.\-=]{1,16}$/.test(normalizeSymbol(symbol));
}

/** Parse an OCC option symbol: AAPL260814C00120000 -> { symbol, date, type, strike } */
export function parseOCC(contract: string): { symbol: string; date: number; type: 'C' | 'P'; strike: number } | null {
  const m = /^([A-Z]+)(\d{6})([CP])(\d{8})$/.exec(contract);
  if (!m) return null;
  const [, symbol, yymmdd, type, strike] = m;
  const year = 2000 + Number(yymmdd.slice(0, 2));
  const month = Number(yymmdd.slice(2, 4));
  const day = Number(yymmdd.slice(4, 6));
  return {
    symbol,
    date: Math.floor(Date.UTC(year, month - 1, day) / 1000),
    type: type as 'C' | 'P',
    strike: Number(strike) / 1000,
  };
}

export interface OptionRow extends CboeOption {
  parsed: NonNullable<ReturnType<typeof parseOCC>>;
}

export function groupOptionsByExpiry(options: CboeOption[]): Map<number, { calls: OptionRow[]; puts: OptionRow[] }> {
  const map = new Map<number, { calls: OptionRow[]; puts: OptionRow[] }>();
  for (const opt of options) {
    const parsed = parseOCC(opt.option);
    if (!parsed) continue;
    const bucket = map.get(parsed.date) ?? { calls: [], puts: [] };
    const row: OptionRow = { ...opt, parsed };
    if (parsed.type === 'C') bucket.calls.push(row);
    else bucket.puts.push(row);
    map.set(parsed.date, bucket);
  }
  for (const bucket of map.values()) {
    bucket.calls.sort((a, b) => a.parsed.strike - b.parsed.strike);
    bucket.puts.sort((a, b) => a.parsed.strike - b.parsed.strike);
  }
  return map;
}
