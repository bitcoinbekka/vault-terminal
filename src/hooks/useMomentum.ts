import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';

import { fetchChart, isValidSymbol, normalizeSymbol } from '@/lib/yahoo';
import { RSI, SMA } from '@/lib/indicators';

export interface MomentumInfo {
  symbol: string;
  /** Last daily close (≈ price). */
  price: number | null;
  sma20: number | null;
  sma50: number | null;
  rsi14: number | null;
  /** 0-80 from trend/RSI (the caller adds a 0-20 day-strength component). */
  baseScore: number | null;
  /** True when the daily series is too short to score. */
  ready: boolean;
}

/**
 * Trend/momentum data for a list of symbols, from 1Y daily candles
 * (deduped with the stock page's 1Y chart query).
 */
export function useMomentum(symbols: string[]) {
  const unique = useMemo(() => [...new Set(symbols.map(normalizeSymbol))], [symbols]);

  const charts = useQueries({
    queries: unique.map((symbol) => ({
      queryKey: ['yahoo', 'chart', symbol, '1Y'],
      queryFn: ({ signal }) => fetchChart(symbol, '1y', '1d', signal),
      staleTime: 10 * 60_000,
      retry: 1,
      enabled: isValidSymbol(symbol),
    })),
  });

  const infos = useMemo<MomentumInfo[]>(() => {
    return unique.map((symbol, i) => {
      const q = charts[i];
      const closes = (q.data?.candles ?? []).map((c) => c.c);
      if (closes.length < 40) {
        return { symbol, price: null, sma20: null, sma50: null, rsi14: null, baseScore: null, ready: false };
      }

      const price = closes[closes.length - 1];
      const last = (arr: (number | null)[]) => arr[arr.length - 1] ?? null;
      const sma20 = last(SMA(closes, 20));
      const sma50 = last(SMA(closes, 50));
      const rsi14 = last(RSI(closes, 14));

      let base = 0;
      if (sma20 !== null && price >= sma20) base += 30;
      if (sma50 !== null && price >= sma50) base += 30;
      if (rsi14 !== null) {
        if (rsi14 >= 50 && rsi14 < 70) base += 20;
        else if (rsi14 >= 70) base += 12; // strong but getting overbought
      }

      return { symbol, price, sma20, sma50, rsi14, baseScore: base, ready: true };
    });
  }, [charts, unique]);

  return { infos, ready: infos.some((i) => i.ready) };
}

/** Full 0-100 momentum score including the day-change component. */
export function momentumScore(info: MomentumInfo | undefined, dayPct: number | null): number | null {
  if (!info || !info.ready || info.baseScore === null) return null;
  let s = info.baseScore;
  if (dayPct !== null && dayPct > 0) s += 20;
  return Math.min(100, s);
}

export function momentumLabel(score: number | null): { text: string; className: string } | null {
  if (score === null) return null;
  if (score >= 60) return { text: 'STRONG', className: 'text-gain' };
  if (score >= 35) return { text: 'NEUTRAL', className: 'text-signal' };
  return { text: 'WEAK', className: 'text-loss' };
}
