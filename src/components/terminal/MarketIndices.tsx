import { Link } from 'react-router-dom';

import { useQuotes } from '@/hooks/useYahoo';
import { INDEXES } from '@/lib/yahoo';
import { colorForChange, formatPercent, formatPrice } from '@/lib/format';
import { Sparkline } from './Sparkline';
import { Skeleton } from '@/components/ui/skeleton';

/** Row of major index cards with sparklines. */
export function MarketIndices() {
  const quotes = useQuotes(INDEXES.map((i) => i.symbol));

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {INDEXES.map((idx, i) => {
        const q = quotes[i];
        const meta = q.data?.meta;
        const candles = q.data?.candles ?? [];
        const prev = meta?.chartPreviousClose ?? meta?.previousClose;
        const change =
          meta && typeof prev === 'number' ? meta.regularMarketPrice - prev : null;
        const pct = change !== null && prev ? (change / prev) * 100 : null;

        return (
          <Link
            key={idx.symbol}
            to={`/stock/${idx.symbol}`}
            className="group rounded-lg border border-border bg-card p-3 transition-colors hover:border-signal/60"
          >
            {q.isPending && !q.data ? (
              <div className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-6 w-full" />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-[11px] font-bold tracking-wider text-muted-foreground group-hover:text-foreground">
                    {idx.name}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground/60">{idx.symbol}</span>
                </div>
                <div className="mt-1 flex items-baseline justify-between gap-2">
                  <span className="font-mono text-lg font-bold tabular-nums">
                    {formatPrice(meta?.regularMarketPrice)}
                  </span>
                  <span className={`font-mono text-[11px] font-semibold tabular-nums ${colorForChange(change ?? pct ?? 0)}`}>
                    {formatPercent(pct)}
                  </span>
                </div>
                <Sparkline
                  data={candles.map((c) => c.c)}
                  positive={(pct ?? 0) >= 0}
                  className="mt-1.5 w-full"
                  width={180}
                  height={26}
                />
              </>
            )}
          </Link>
        );
      })}
    </div>
  );
}
