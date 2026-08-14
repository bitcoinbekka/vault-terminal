/**
 * Market data layer.
 *
 * Quotes, candles, search, and trending come from Yahoo Finance; options chains
 * come from the CBOE delayed-quotes CDN (free, no API key, full greeks).
 *
 * Neither host sends CORS headers, so browsers can't read them directly. The
 * fetch layer therefore tries, in order:
 *
 *   1. A same-origin reverse proxy (set VITE_MARKET_BASE at build time). If the
 *      app and proxy share an origin, no CORS headers are needed at all — the
 *      recommended setup for self-hosting. Paths: /yahoo/* and /cboe/*.
 *   2. A CORS proxy using the `?url=` convention (VITE_CORS_PROXY at build
 *      time, or the Shakespeare default).
 *   3. A direct fetch (works only where CORS is relaxed).
 *
 * Example build for a self-hosted VPS:
 *   VITE_MARKET_BASE=https://vault.example.com npm run build
 */

const YAHOO_BASE = 'https://query1.finance.yahoo.com';
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

function buildAttempts(url: string): string[] {
  const attempts: string[] = [];

  const marketBase = getViteEnv('VITE_MARKET_BASE')?.trim().replace(/\/+$/, '');
  if (marketBase) {
    if (url.startsWith(YAHOO_BASE)) {
      attempts.push(`${marketBase}/yahoo/${url.slice(YAHOO_BASE.length)}`);
    } else if (url.startsWith(CBOE_BASE)) {
      attempts.push(`${marketBase}/cboe/${url.slice(CBOE_BASE.length)}`);
    }
  }

  const proxyBase = getViteEnv('VITE_CORS_PROXY')?.trim() || DEFAULT_PROXY_BASE;
  attempts.push(`${proxyBase}${encodeURIComponent(url)}`);

  attempts.push(url);
  return attempts;
}

// ---------------------------------------------------------------------------
// Types
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

/** CBOE delayed options contract. Contract symbols use OCC format, e.g. AAPL260814C00120000 */
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

async function fetchText(url: string, signal?: AbortSignal): Promise<string> {
  const attempts = buildAttempts(url);
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
      // The proxy can return an HTML error page with a 200 in some edge cases.
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
  const text = await fetchText(url, signal);
  return JSON.parse(text) as T;
}

function assertResult<T>(data: T, message: string): T {
  if (data === null || data === undefined) {
    throw new Error(message);
  }
  return data;
}

// ---------------------------------------------------------------------------
// Yahoo Finance endpoints
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

export async function fetchChart(
  symbol: string,
  range = '1d',
  interval = '5m',
  signal?: AbortSignal,
): Promise<QuoteData> {
  const path = `/v8/finance/chart/${encodeURIComponent(symbol)}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}`;
  const raw = await fetchJson<{
    chart?: {
      result?: Array<{
        meta: YahooMeta;
        timestamp?: number[];
        indicators?: { quote?: Array<{ open?: number[]; high?: number[]; low?: number[]; close?: number[]; volume?: number[] }> };
      }>;
      error?: { code?: string; description?: string } | null;
    } | null;
  }>(`${YAHOO_BASE}${path}`, signal);

  const chart = assertResult(raw.chart, `No chart data for ${symbol}`);
  if (chart.error) {
    throw new Error(chart.error.description ?? chart.error.code ?? `Chart error for ${symbol}`);
  }
  const result = assertResult(chart.result?.[0], `No chart result for ${symbol}`);
  const quote = result.indicators?.quote?.[0];
  const timestamps = result.timestamp ?? [];

  const candles: Candle[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const c = quote?.close?.[i];
    const o = quote?.open?.[i];
    const h = quote?.high?.[i];
    const l = quote?.low?.[i];
    const v = quote?.volume?.[i];
    if (c === undefined || c === null) continue;
    candles.push({
      t: timestamps[i],
      o: o ?? c,
      h: h ?? c,
      l: l ?? c,
      c,
      v: v ?? 0,
    });
  }

  return { meta: result.meta, candles };
}

/** Intraday snapshot used for watchlists / ticker tape. */
export function fetchQuote(symbol: string, signal?: AbortSignal): Promise<QuoteData> {
  return fetchChart(symbol, '1d', '5m', signal);
}

export async function fetchSearch(
  query: string,
  opts: { quotesCount?: number; newsCount?: number } = {},
  signal?: AbortSignal,
): Promise<SearchResult> {
  const quotesCount = opts.quotesCount ?? 8;
  const newsCount = opts.newsCount ?? 8;
  const path = `/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=${quotesCount}&newsCount=${newsCount}&enableFuzzyQuery=false`;
  const raw = await fetchJson<{
    quotes?: SearchQuote[];
    news?: NewsItem[];
  }>(`${YAHOO_BASE}${path}`, signal);

  return {
    quotes: raw.quotes ?? [],
    news: raw.news ?? [],
  };
}

export async function fetchTrending(region = 'US', signal?: AbortSignal): Promise<string[]> {
  const path = `/v1/finance/trending/${encodeURIComponent(region)}`;
  const raw = await fetchJson<{
    finance?: { result?: Array<{ quotes?: Array<{ symbol?: string }> }> };
  }>(`${YAHOO_BASE}${path}`, signal);

  const result = raw.finance?.result?.[0];
  const symbols = (result?.quotes ?? [])
    .map((q) => q.symbol)
    .filter((s): s is string => Boolean(s));
  return symbols;
}

// ---------------------------------------------------------------------------
// CBOE options
// ---------------------------------------------------------------------------

export async function fetchOptionsChain(symbol: string, signal?: AbortSignal): Promise<OptionsData> {
  const path = `/api/global/delayed_quotes/options/${encodeURIComponent(symbol)}.json`;
  const raw = await fetchJson<{
    data?: { options?: CboeOption[] };
  }>(`${CBOE_BASE}${path}`, signal);

  const options = assertResult(raw.data?.options, `No options data for ${symbol}`);
  return { timestamp: '', options };
}

// ---------------------------------------------------------------------------
// Market constants & helpers
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

/** Symbols shown to logged-out visitors so the terminal isn't empty. */
export const STARTER_WATCHLIST = ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'META', 'GOOGL', 'TSLA', 'COIN'];

export function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

export function isValidSymbol(symbol: string): boolean {
  return /^[A-Z0-9^.\-]{1,12}$/.test(normalizeSymbol(symbol));
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
  // Sort by strike within each bucket
  for (const bucket of map.values()) {
    bucket.calls.sort((a, b) => a.parsed.strike - b.parsed.strike);
    bucket.puts.sort((a, b) => a.parsed.strike - b.parsed.strike);
  }
  return map;
}
