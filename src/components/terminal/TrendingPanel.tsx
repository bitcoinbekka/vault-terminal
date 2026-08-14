import { Link } from 'react-router-dom';
import { Flame } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { useQuotes, useYahooTrending } from '@/hooks/useYahoo';
import { colorForChange, formatPercent, formatPrice } from '@/lib/format';
import { Panel } from './Panel';

/** Top trending symbols on Yahoo (US). */
export function TrendingPanel() {
  const { data: trending, isPending } = useYahooTrending();
  const top = trending?.slice(0, 8) ?? [];
  const quotes = useQuotes(top);

  return (
    <Panel
      title="TRENDING // MARKETS"
      id="trending"
      right={<Flame className="size-3.5 text-signal" />}
    >
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="font-mono text-[10px] tracking-wider text-muted-foreground">#</TableHead>
            <TableHead className="font-mono text-[10px] tracking-wider text-muted-foreground">SYMBOL</TableHead>
            <TableHead className="text-right font-mono text-[10px] tracking-wider text-muted-foreground">LAST</TableHead>
            <TableHead className="text-right font-mono text-[10px] tracking-wider text-muted-foreground">CHG%</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isPending && top.length === 0
            ? [0, 1, 2, 3, 4].map((i) => (
                <TableRow key={i} className="hover:bg-transparent">
                  <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-14" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                </TableRow>
              ))
            : top.map((symbol, i) => {
                const q = quotes[i];
                const meta = q.data?.meta;
                const prev = meta?.chartPreviousClose ?? meta?.previousClose;
                const price = meta?.regularMarketPrice;
                const change = price !== undefined && typeof prev === 'number' ? price - prev : null;
                const pct = change !== null && prev ? (change / prev) * 100 : null;
                return (
                  <TableRow key={symbol} className="group">
                    <TableCell className="font-mono text-xs text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="max-w-[140px]">
                      <Link to={`/stock/${symbol}`} className="flex flex-col">
                        <span className="font-mono text-sm font-bold group-hover:text-signal">{symbol}</span>
                        <span className="truncate text-[11px] text-muted-foreground">{meta?.longName ?? meta?.shortName}</span>
                      </Link>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums">{formatPrice(price)}</TableCell>
                    <TableCell className="text-right">
                      <span className={`font-mono text-xs font-semibold tabular-nums ${colorForChange(change ?? 0)}`}>
                        {formatPercent(pct)}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
        </TableBody>
      </Table>
      <div className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
        Most-active / trending · Yahoo Finance
      </div>
    </Panel>
  );
}
