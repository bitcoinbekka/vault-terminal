import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

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
import { SECTOR_ETFS, SECTOR_NAMES } from '@/lib/marketUniverse';
import { colorForChange, formatPercent, formatPrice } from '@/lib/format';
import { cn } from '@/lib/utils';

import { Panel } from './Panel';
import { Sparkline } from './Sparkline';

interface SectorRow {
  symbol: string;
  name: string;
  last: number | null;
  pct: number | null;
  closes: number[];
}

/** Today's sector ETF leaderboard — rotate into strength. */
export function SectorRotation() {
  const quotes = useQuotes(SECTOR_ETFS);

  const rows: SectorRow[] = useMemo(() => {
    return SECTOR_ETFS.map((symbol, i) => {
      const q = quotes[i];
      const meta = q.data?.meta;
      const prev = meta?.chartPreviousClose ?? meta?.previousClose;
      const price = meta?.regularMarketPrice ?? null;
      const change = price !== null && typeof prev === 'number' ? price - prev : null;
      const pct = change !== null && prev ? (change / prev) * 100 : null;
      return {
        symbol,
        name: SECTOR_NAMES[symbol] ?? symbol,
        last: price,
        pct,
        closes: (q.data?.candles ?? []).map((c) => c.c),
      };
    });
  }, [quotes]);

  const ranked = useMemo(() => [...rows].sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0)), [rows]);
  const leader = ranked[0];

  return (
    <Panel
      title="SECTOR ROTATION // TODAY'S LEADERS"
      id="sectors"
      right={
        leader && leader.pct !== null ? (
          <span className="flex items-center gap-1 font-mono text-[10px] font-bold text-gain">
            <ArrowUpRight className="size-3.5" />
            {leader.symbol} {formatPercent(leader.pct)}
          </span>
        ) : undefined
      }
    >
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="font-mono text-[10px] tracking-wider text-muted-foreground">#</TableHead>
            <TableHead className="font-mono text-[10px] tracking-wider text-muted-foreground">ETF</TableHead>
            <TableHead className="hidden font-mono text-[10px] tracking-wider text-muted-foreground md:table-cell">SECTOR</TableHead>
            <TableHead className="text-right font-mono text-[10px] tracking-wider text-muted-foreground">LAST</TableHead>
            <TableHead className="text-right font-mono text-[10px] tracking-wider text-muted-foreground">CHG%</TableHead>
            <TableHead className="hidden font-mono text-[10px] tracking-wider text-muted-foreground sm:table-cell">1D</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0
            ? [0, 1, 2, 3, 4].map((i) => (
                <TableRow key={i} className="hover:bg-transparent">
                  <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-10" /></TableCell>
                  <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-14" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell className="hidden sm:table-cell"><Skeleton className="h-5 w-16" /></TableCell>
                </TableRow>
              ))
            : ranked.map((r, i) => {
                const isLeader = i < 3;
                const isLag = i >= ranked.length - 3;
                return (
                  <TableRow
                    key={r.symbol}
                    className={cn('group', isLeader && 'bg-gain/5', isLag && 'bg-loss/5')}
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="max-w-[120px]">
                      <Link to={`/stock/${r.symbol}`} className="font-mono text-sm font-bold group-hover:text-signal">
                        {r.symbol}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden max-w-[160px] truncate text-xs text-muted-foreground md:table-cell">
                      {r.name}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums">{formatPrice(r.last)}</TableCell>
                    <TableCell className={`text-right font-mono text-xs font-semibold tabular-nums ${colorForChange(r.pct ?? 0)}`}>
                      {formatPercent(r.pct)}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Sparkline data={r.closes} positive={(r.pct ?? 0) >= 0} width={72} height={20} />
                    </TableCell>
                  </TableRow>
                );
              })}
        </TableBody>
      </Table>
      <div className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
        Ranked by today's % change · top 3 tinted green, bottom 3 tinted red · delayed quotes
      </div>
    </Panel>
  );
}
