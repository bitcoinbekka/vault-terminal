import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { fetchSearch, isValidSymbol, normalizeSymbol, type NewsItem } from '@/lib/yahoo';

/**
 * Best-effort supply-chain / connected-companies discovery, sourced from
 * Yahoo news coverage (e.g. "TSMC is Nvidia's chipmaker"). Honest limits:
 * relationships come from headlines, not an authoritative database.
 */

export interface SupplyChainData {
  news: NewsItem[];
  /** Tickers that appear alongside the symbol in supply-chain news. */
  related: { symbol: string; mentions: number }[];
}

const QUERIES = (symbol: string): string[] => [
  `${symbol} supplier`,
  `${symbol} supply chain`,
  `${symbol} customer`,
];

export function useSupplyChain(symbol: string) {
  const normalized = normalizeSymbol(symbol);

  return useQuery<SupplyChainData>({
    queryKey: ['yahoo', 'supplychain', normalized],
    enabled: isValidSymbol(normalized),
    queryFn: async ({ signal }) => {
      const results = await Promise.all(
        QUERIES(normalized).map((q) => fetchSearch(q, { quotesCount: 0, newsCount: 6 }, signal)),
      );

      const byId = new Map<string, NewsItem>();
      const mentionCount = new Map<string, number>();
      const self = normalized.replace('=F', '').replace('^', '').toUpperCase();

      for (const result of results) {
        for (const item of result.news) {
          byId.set(item.uuid, item);
          for (const ticker of item.relatedTickers ?? []) {
            const t = ticker.toUpperCase();
            if (t === self) continue;
            if (t.includes('=') || t.includes('^')) continue;
            mentionCount.set(t, (mentionCount.get(t) ?? 0) + 1);
          }
        }
      }

      const news = [...byId.values()].sort((a, b) => b.providerPublishTime - a.providerPublishTime).slice(0, 10);
      const related = [...mentionCount.entries()]
        .map(([symbol, mentions]) => ({ symbol, mentions }))
        .sort((a, b) => b.mentions - a.mentions || a.symbol.localeCompare(b.symbol))
        .slice(0, 10);

      return { news, related };
    },
    staleTime: 10 * 60_000,
    retry: 1,
  });
}

/** Memoized list of related ticker symbols (for name lookup via useQuotes). */
export function useRelatedSymbols(symbol: string): string[] {
  const { data } = useSupplyChain(symbol);
  return useMemo(() => (data?.related ?? []).map((r) => r.symbol), [data]);
}
