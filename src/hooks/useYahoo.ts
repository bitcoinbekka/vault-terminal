import { useQueries, useQuery } from '@tanstack/react-query';
import {
  CHART_RANGES,
  DEFAULT_RANGE,
  fetchChart,
  fetchOptionsChain,
  fetchQuote,
  fetchSearch,
  fetchTrending,
  isValidSymbol,
  normalizeSymbol,
  type OptionsData,
  type QuoteData,
  type SearchResult,
} from '@/lib/yahoo';

/** Chart + quote data for a symbol over a range preset (1D, 5D, 1M, ...). */
export function useYahooChart(symbol: string, rangeKey = DEFAULT_RANGE, enabled = true) {
  const range = CHART_RANGES[rangeKey] ?? CHART_RANGES[DEFAULT_RANGE];
  const normalized = normalizeSymbol(symbol);

  return useQuery<QuoteData>({
    queryKey: ['yahoo', 'chart', normalized, rangeKey],
    queryFn: ({ signal }) => fetchChart(normalized, range.range, range.interval, signal),
    enabled: enabled && isValidSymbol(normalized),
    staleTime: 60_000,
    retry: 1,
  });
}

/** Symbol search + related news (Yahoo finance search endpoint). */
export function useYahooSearch(query: string, enabled = true) {
  const trimmed = query.trim();

  return useQuery<SearchResult>({
    queryKey: ['yahoo', 'search', trimmed.toLowerCase()],
    queryFn: ({ signal }) =>
      fetchSearch(trimmed, { quotesCount: 5, newsCount: 8 }, signal),
    enabled: enabled && trimmed.length > 0,
    staleTime: 60_000,
    retry: 1,
  });
}

/** Trending symbols for a region (US by default). */
export function useYahooTrending() {
  return useQuery<string[]>({
    queryKey: ['yahoo', 'trending'],
    queryFn: ({ signal }) => fetchTrending('US', signal),
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

/** Full CBOE delayed options chain for a symbol. */
export function useYahooOptions(symbol: string, enabled = true) {
  const normalized = normalizeSymbol(symbol);

  return useQuery<OptionsData>({
    queryKey: ['cboe', 'options', normalized],
    queryFn: ({ signal }) => fetchOptionsChain(normalized, signal),
    enabled: enabled && isValidSymbol(normalized),
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

/** Parallel intraday quotes for a list of symbols (watchlist, trending, tape). */
export function useQuotes(symbols: string[]) {
  const unique = [...new Set(symbols.map(normalizeSymbol))];

  return useQueries({
    queries: unique.map((symbol) => ({
      queryKey: ['yahoo', 'chart', symbol, DEFAULT_RANGE],
      queryFn: ({ signal }) => fetchQuote(symbol, signal),
      staleTime: 60_000,
      retry: 1,
      enabled: isValidSymbol(symbol),
    })),
  });
}

/** Parallel CBOE options chains for a list of underlyings. */
export function useCboeChains(symbols: string[]) {
  const unique = [...new Set(symbols.map(normalizeSymbol))];

  return useQueries({
    queries: unique.map((symbol) => ({
      queryKey: ['cboe', 'options', symbol],
      queryFn: ({ signal }) => fetchOptionsChain(symbol, signal),
      staleTime: 5 * 60_000,
      retry: 1,
      enabled: isValidSymbol(symbol),
    })),
  });
}

export type { OptionsData, QuoteData, SearchResult };
