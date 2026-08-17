import { useQuery } from '@tanstack/react-query';

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
