import { useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';

import { fetchChart } from '@/lib/yahoo';
import { fxSymbol } from '@/lib/fx';

/**
 * Live FX rate: units of `quote` per 1 `base`, via Yahoo FX pairs
 * (e.g. USDCAD=X). Route conversions through USD for cross pairs.
 */
export function useFxRate(base: string, quote: string) {
  const pair = base === quote ? '' : fxSymbol(base, quote);

  return useQuery<number | null>({
    queryKey: ['yahoo', 'fx', pair],
    enabled: Boolean(pair),
    queryFn: async ({ signal }) => {
      const data = await fetchChart(pair, '1d', '5m', signal);
      const price = data.meta?.regularMarketPrice;
      return typeof price === 'number' && price > 0 ? price : null;
    },
    staleTime: 60_000,
    retry: 1,
  });
}

/** Convert an amount from `from` to `to`, routing through USD. */
export function convertFx(
  amount: number,
  from: string,
  to: string,
  usdFrom: number | null, // rate USDFROM=X (units FROM per 1 USD)
  usdTo: number | null, // rate USDTO=X (units TO per 1 USD)
): number | null {
  if (!Number.isFinite(amount) || amount < 0) return null;
  if (from === to) return amount;

  let usd: number | null;
  if (from === 'USD') {
    usd = amount;
  } else if (usdFrom) {
    usd = amount / usdFrom;
  } else {
    return null;
  }

  if (to === 'USD') return usd ?? null;
  if (!usdTo) return null;
  return usd * usdTo;
}

/**
 * Batched USD rates (units of each currency per 1 USD) for portfolio
 * normalization. Shares the same query keys as `useFxRate`, so no dupes.
 */
export function useUsdRates(currencies: string[]) {
  const unique = useMemo(
    () => [...new Set(currencies.filter((c) => c && c !== 'USD'))],
    [currencies],
  );

  const queries = useQueries({
    queries: unique.map((cur) => ({
      queryKey: ['yahoo', 'fx', fxSymbol('USD', cur)],
      queryFn: async ({ signal }) => {
        const data = await fetchChart(fxSymbol('USD', cur), '1d', '5m', signal);
        const price = data.meta?.regularMarketPrice;
        return typeof price === 'number' && price > 0 ? price : null;
      },
      staleTime: 60_000,
      retry: 1,
      enabled: true,
    })),
  });

  const rates = useMemo(() => {
    const map = new Map<string, number>();
    unique.forEach((cur, i) => {
      const v = queries[i].data;
      if (typeof v === 'number' && v > 0) map.set(cur, v);
    });
    return map;
  }, [queries, unique]);

  return { rates, loading: queries.some((q) => q.isPending) };
}

/** Convert a native-currency value to USD using a rates map (null if no rate). */
export function toUsd(value: number, currency: string, rates: Map<string, number>): number | null {
  if (currency === 'USD') return value;
  const rate = rates.get(currency);
  return rate ? value / rate : null;
}
