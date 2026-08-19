import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { useQuotes } from '@/hooks/useYahoo';
import { SECTOR_ETFS, SECTOR_NAMES, SECTOR_SYMBOLS } from '@/lib/marketUniverse';
import { colorForChange, formatCompact, formatPercent, formatPrice } from '@/lib/format';
import { cn } from '@/lib/utils';

import { Panel } from './Panel';
import { Sparkline } from './Sparkline';

interface Row {
  symbol: string;
  name: string;
  price: number | null;
  pct: number | null;
  volume: number | null;
  closes: number[];
}

/** Discover popular symbols by sector, with live quotes. */
export function SectorDiscover() {
  const [sector, setSector] = useState('XLK');
  const symbols = SECTOR_SYMBOLS[sector] ?? [];
  const quotes = useQuotes(symbols);

  const rows: Row[] = symbols.map((symbol, i) => {
    const q = quotes[i];
    const meta = q.data?.meta;
    const prev = meta?.chartPreviousClose ?? meta?.previousClose;
    const price = meta?.regularMarketPrice ?? null;
    const change = price !== null && typeof prev === 'number' ? price - prev : null;
    const pct = change !== null && prev ? (change / prev) * 100 : null;
    return {
      symbol,
      name: meta?.longName ?? meta?.shortName ?? '',
      price,
      pct,
      volume: meta?.regularMarketVolume ?? null,
      closes: (q.data?.candles ?? []).map((c) => c.c),
    };
  });

  return (
    <Panel
      title="DISCOVER BY SECTOR"
      id="discover"
      right={<Compass className="size-3.5 text-signal" />}
    >
      <div className="flex flex-wrap gap-1.5 border-b border-border px-3 py-2">
        {SECTOR_ETFS.map((etf) => (
          <button
            key={etf}
            onClick={() => setSector(etf)}
            title={`${SECTOR_NAMES[etf] ?? etf} (${etf})`}
            className={cn(
              'rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold transition-colors',
              sector === etf ? 'border-signal bg-signal/15 text-signal' : 'border-border text-muted-foreground hover:text-foreground',
            )}
          >
            {SECTOR_NAMES[etf] ?? etf}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between border-b border-border bg-muted/20 px-3 py-1.5">
        <span className="font-mono text-[11px] font-bold tracking-widest text-foreground">
          {SECTOR_NAMES[sector] ?? sector}
        </span>
        <Link to={`/stock/${sector}`} className="font-mono text-[10px] text-signal hover:underline">
          ETF {sector} →
        </Link>
      </div>

      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="font-mono text-[10px] tracking-wider text-muted-foreground">SYMBOL</TableHead>
            <TableHead className="hidden font-mono text-[10px] tracking-wider text-muted-foreground md:table-cell">NAME</TableHead>
            <TableHead className="text-right font-mono text-[10px] tracking-wider text-muted-foreground">LAST</TableHead>
            <TableHead className="text-right font-mono text-[10px] tracking-wider text-muted-foreground">CHG%</TableHead>
            <TableHead className="text-right font-mono text-[10px] tracking-wider text-muted-foreground">VOL</TableHead>
            <TableHead className="hidden font-mono text-[10px] tracking-wider text-muted-foreground sm:table-cell">1D</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 || quotes.every((q) => q.isPending && !q.data) ? (
            [0, 1, 2, 3].map((i) => (
              <TableRow key={i} className="hover:bg-transparent">
                <TableCell colSpan={6}>
                  <Skeleton className="h-7 w-full" />
                </TableCell>
              </TableRow>
            ))
          ) : (
            rows.map((r) => (
              <TableRow key={r.symbol} className="group">
                <TableCell className="max-w-[150px]">
                  <Link to={`/stock/${r.symbol}`} className="flex flex-col">
                    <span className="font-mono text-sm font-bold group-hover:text-signal">{r.symbol}</span>
                    <span className="truncate text-[11px] text-muted-foreground md:hidden">{r.name}</span>
                  </Link>
                </TableCell>
                <TableCell className="hidden max-w-[220px] truncate text-xs text-muted-foreground md:table-cell">{r.name}</TableCell>
                <TableCell className="text-right font-mono text-sm tabular-nums">{formatPrice(r.price)}</TableCell>
                <TableCell className={cn('text-right font-mono text-xs font-semibold tabular-nums', colorForChange(r.pct ?? 0))}>
                  {formatPercent(r.pct)}
                </TableCell>
                <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                  {formatCompact(r.volume)}
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <Sparkline data={r.closes} positive={(r.pct ?? 0) >= 0} width={72} height={20} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <div className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
        Popular liquid names per sector — not a complete list · delayed quotes
      </div>
    </Panel>
  );
}
