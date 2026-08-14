import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { RefreshCw, WifiOff } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { useWatchlist } from '@/hooks/useWatchlist';
import { useQuotes } from '@/hooks/useYahoo';
import { INDEXES, STARTER_WATCHLIST } from '@/lib/yahoo';
import { colorForChange, formatPercent, formatPrice } from '@/lib/format';

interface TapeItem {
  symbol: string;
  price: number;
  changePct: number;
}

/** Scrolling marquee of indices + watchlist quotes. */
export function TickerTape() {
  const { watchlist } = useWatchlist();
  const queryClient = useQueryClient();

  const symbols = [
    ...INDEXES.map((i) => i.symbol),
    ...(watchlist.length > 0 ? watchlist : STARTER_WATCHLIST),
  ].slice(0, 24);

  const quotes = useQuotes(symbols);
  const anyError = quotes.some((q) => q.isError);
  const stillLoading = quotes.some((q) => q.isPending) && !anyError;

  const items: TapeItem[] = [];
  quotes.forEach((q, i) => {
    const symbol = symbols[i];
    const meta = q.data?.meta;
    if (!meta || typeof meta.regularMarketPrice !== 'number') return;
    const prev = meta.chartPreviousClose ?? meta.previousClose;
    const price = meta.regularMarketPrice;
    const changePct = prev && prev > 0 ? ((price - prev) / prev) * 100 : 0;
    items.push({ symbol, price, changePct });
  });

  if (items.length === 0) {
    if (anyError) {
      return (
        <div className="flex h-9 items-center justify-between gap-2 border-y border-border bg-card/80 px-3 font-mono text-xs text-muted-foreground sm:px-4">
          <span className="flex items-center gap-2">
            <WifiOff className="size-3.5 text-loss" />
            <span>Market feed unavailable — delayed quotes are proxied and the relay is momentarily offline.</span>
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-6 gap-1 px-2 font-mono text-[11px]"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['yahoo'] })}
          >
            <RefreshCw className="size-3" /> RETRY
          </Button>
        </div>
      );
    }
    if (stillLoading) {
      return (
        <div className="flex h-9 items-center overflow-hidden border-y border-border bg-card/80 px-4 font-mono text-xs text-muted-foreground">
          Connecting to market data feed…
        </div>
      );
    }
    return null;
  }

  return (
    <div className="relative overflow-hidden border-y border-border bg-card/80">
      <div className="tape-track flex w-max items-center gap-10 py-1.5 pr-10">
        {[...items, ...items].map((item, i) => (
          <Link
            to={`/stock/${item.symbol}`}
            key={`${item.symbol}-${i}`}
            className="group flex items-center gap-2 font-mono text-xs whitespace-nowrap"
          >
            <span className="font-bold tracking-wider text-foreground group-hover:text-signal">
              {item.symbol}
            </span>
            <span className="tabular-nums text-foreground/80">{formatPrice(item.price)}</span>
            <span className={`tabular-nums ${colorForChange(item.changePct)}`}>
              {formatPercent(item.changePct)}
            </span>
          </Link>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background to-transparent" />
    </div>
  );
}
