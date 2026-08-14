import { Gauge } from 'lucide-react';

import { useQuotes } from '@/hooks/useYahoo';
import { colorForChange, formatPercent, formatPrice } from '@/lib/format';
import { cn } from '@/lib/utils';

import { Panel } from './Panel';
import { Sparkline } from './Sparkline';

const MACRO_ASSETS = [
  { symbol: '^VIX', label: 'VIX' },
  { symbol: '^TNX', label: '10Y YIELD' },
  { symbol: 'GC=F', label: 'GOLD' },
  { symbol: 'SI=F', label: 'SILVER' },
  { symbol: 'BTC-USD', label: 'BITCOIN' },
  { symbol: 'ETH-USD', label: 'ETHEREUM' },
];

function vixBand(vix: number | null): { label: string; className: string } {
  if (vix === null) return { label: '—', className: 'text-muted-foreground' };
  if (vix < 15) return { label: 'COMPLACENT', className: 'text-gain' };
  if (vix <= 25) return { label: 'NEUTRAL', className: 'text-signal' };
  return { label: 'FEAR', className: 'text-loss' };
}

/** Macro regime read: volatility, yields and risk assets. */
export function MarketRegime() {
  const quotes = useQuotes(MACRO_ASSETS.map((a) => a.symbol));

  const vixIdx = MACRO_ASSETS.findIndex((a) => a.symbol === '^VIX');
  const vix = quotes[vixIdx]?.data?.meta?.regularMarketPrice ?? null;
  const band = vixBand(vix);

  return (
    <Panel
      title="MACRO REGIME // RISK PULSE"
      id="regime"
      right={
        <span className="flex items-center gap-1.5 font-mono text-[10px] font-bold tracking-wider">
          <Gauge className={cn('size-3.5', band.className)} />
          <span className={band.className}>{band.label}</span>
          {vix !== null ? <span className="text-muted-foreground">· VIX {formatPrice(vix)}</span> : null}
        </span>
      }
    >
      <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 lg:grid-cols-6">
        {MACRO_ASSETS.map((asset, i) => {
          const q = quotes[i];
          const meta = q.data?.meta;
          const candles = q.data?.candles ?? [];
          const prev = meta?.chartPreviousClose ?? meta?.previousClose;
          const change = meta && typeof prev === 'number' ? meta.regularMarketPrice - prev : null;
          const pct = change !== null && prev ? (change / prev) * 100 : null;

          return (
            <div
              key={asset.symbol}
              className="rounded-lg border border-border bg-muted/20 px-2.5 py-2"
              title={asset.symbol}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="truncate font-mono text-[10px] font-bold tracking-wider text-muted-foreground">
                  {asset.label}
                </span>
              </div>
              <div className="mt-0.5 flex items-baseline justify-between gap-1">
                <span className="font-mono text-sm font-bold tabular-nums">{formatPrice(meta?.regularMarketPrice)}</span>
                <span className={cn('font-mono text-[10px] font-semibold tabular-nums', colorForChange(change ?? pct ?? 0))}>
                  {formatPercent(pct)}
                </span>
              </div>
              <Sparkline data={candles.map((c) => c.c)} positive={(pct ?? 0) >= 0} width={120} height={20} className="mt-1 w-full" />
            </div>
          );
        })}
      </div>
      <div className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
        VIX &lt; 15 complacent · 15–25 neutral · &gt; 25 fear — context before you size up
      </div>
    </Panel>
  );
}
