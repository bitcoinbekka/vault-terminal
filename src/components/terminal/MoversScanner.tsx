import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Radar } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

import { useQuotes } from '@/hooks/useYahoo';
import { useWatchlist } from '@/hooks/useWatchlist';
import { MOVER_UNIVERSE, UNIVERSE_LIMIT } from '@/lib/marketUniverse';
import { colorForChange, formatCompact, formatPercent, formatPrice } from '@/lib/format';

import { Panel } from './Panel';

interface MoverRow {
  symbol: string;
  name: string;
  price: number | null;
  change: number | null;
  pct: number | null;
  volume: number | null;
  fromHighPct: number | null;
  fromLowPct: number | null;
}

function MoverTable({ list, showHigh, showLow }: { list: MoverRow[]; showHigh?: boolean; showLow?: boolean }) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="font-mono text-[10px] tracking-wider text-muted-foreground">SYMBOL</TableHead>
          <TableHead className="hidden font-mono text-[10px] tracking-wider text-muted-foreground md:table-cell">NAME</TableHead>
          <TableHead className="text-right font-mono text-[10px] tracking-wider text-muted-foreground">LAST</TableHead>
          <TableHead className="text-right font-mono text-[10px] tracking-wider text-muted-foreground">CHG%</TableHead>
          <TableHead className="text-right font-mono text-[10px] tracking-wider text-muted-foreground">VOL</TableHead>
          {showHigh ? (
            <TableHead className="text-right font-mono text-[10px] tracking-wider text-muted-foreground">FROM 52W HIGH</TableHead>
          ) : null}
          {showLow ? (
            <TableHead className="text-right font-mono text-[10px] tracking-wider text-muted-foreground">FROM 52W LOW</TableHead>
          ) : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {list.map((r) => (
          <TableRow key={r.symbol} className="group">
            <TableCell className="max-w-[150px]">
              <Link to={`/stock/${r.symbol}`} className="flex flex-col">
                <span className="font-mono text-sm font-bold group-hover:text-signal">{r.symbol}</span>
                <span className="truncate text-[11px] text-muted-foreground md:hidden">{r.name}</span>
              </Link>
            </TableCell>
            <TableCell className="hidden max-w-[200px] truncate text-xs text-muted-foreground md:table-cell">{r.name}</TableCell>
            <TableCell className="text-right font-mono text-sm tabular-nums">{formatPrice(r.price)}</TableCell>
            <TableCell className={`text-right font-mono text-xs font-semibold tabular-nums ${colorForChange(r.change ?? 0)}`}>
              {formatPercent(r.pct)}
            </TableCell>
            <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
              {formatCompact(r.volume)}
            </TableCell>
            {showHigh ? (
              <TableCell className="text-right">
                {r.fromHighPct !== null && r.fromHighPct >= -0.5 ? (
                  <Badge variant="outline" className="font-mono text-[10px] text-gain">AT HIGH</Badge>
                ) : (
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {formatPercent(r.fromHighPct)}
                  </span>
                )}
              </TableCell>
            ) : null}
            {showLow ? (
              <TableCell className="text-right">
                {r.fromLowPct !== null && r.fromLowPct <= 0.5 ? (
                  <Badge variant="outline" className="font-mono text-[10px] text-loss">AT LOW</Badge>
                ) : (
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {formatPercent(r.fromLowPct)}
                  </span>
                )}
              </TableCell>
            ) : null}
          </TableRow>
        ))}
        {list.length === 0 && (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
              No movers right now — feed may be offline.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

/** Market-wide movers scanner across a liquid universe + your watchlist. */
export function MoversScanner() {
  const { watchlist } = useWatchlist();

  const universe = useMemo(() => {
    const merged = [...MOVER_UNIVERSE, ...watchlist];
    return [...new Set(merged)].slice(0, UNIVERSE_LIMIT);
  }, [watchlist]);

  const quotes = useQuotes(universe);

  const rows: MoverRow[] = useMemo(() => {
    const out: MoverRow[] = [];
    quotes.forEach((q, i) => {
      const symbol = universe[i];
      if (!symbol || !q.data?.meta) return;
      const meta = q.data.meta;
      const price = meta.regularMarketPrice;
      const prev = meta.chartPreviousClose ?? meta.previousClose;
      const change = typeof prev === 'number' ? price - prev : null;
      const pct = change !== null && prev ? (change / prev) * 100 : null;
      const fromHighPct =
        typeof meta.fiftyTwoWeekHigh === 'number' && meta.fiftyTwoWeekHigh > 0
          ? (price / meta.fiftyTwoWeekHigh - 1) * 100
          : null;
      const fromLowPct =
        typeof meta.fiftyTwoWeekLow === 'number' && meta.fiftyTwoWeekLow > 0
          ? (price / meta.fiftyTwoWeekLow - 1) * 100
          : null;
      out.push({
        symbol,
        name: meta.longName ?? meta.shortName ?? '',
        price,
        change,
        pct,
        volume: meta.regularMarketVolume ?? null,
        fromHighPct,
        fromLowPct,
      });
    });
    return out;
  }, [quotes, universe]);

  const loaded = rows.length;
  const gainers = rows.filter((r) => r.pct !== null && r.pct >= 0.05).sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0)).slice(0, 10);
  const losers = rows.filter((r) => r.pct !== null && r.pct <= -0.05).sort((a, b) => (a.pct ?? 0) - (b.pct ?? 0)).slice(0, 10);
  const active = rows.filter((r) => r.volume !== null).sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0)).slice(0, 10);
  const nearHigh = rows
    .filter((r) => r.fromHighPct !== null && r.fromHighPct <= 0)
    .sort((a, b) => (b.fromHighPct ?? 0) - (a.fromHighPct ?? 0))
    .slice(0, 10);
  const nearLow = rows
    .filter((r) => r.fromLowPct !== null && r.fromLowPct >= 0)
    .sort((a, b) => (a.fromLowPct ?? 0) - (b.fromLowPct ?? 0))
    .slice(0, 10);

  return (
    <Panel
      title="MARKET MOVERS"
      id="movers"
      right={<Radar className="size-3.5 text-signal" />}
    >
      <div className="border-b border-border px-3 py-1.5 text-[11px] text-muted-foreground">
        Scanning {universe.length} liquid symbols · mega-caps + sector ETFs + your watchlist
      </div>

      <Tabs defaultValue="gainers">
        <TabsList className="mx-3 mt-2 grid w-[calc(100%-1.5rem)] grid-cols-5">
          <TabsTrigger value="gainers" className="font-mono text-[10px] sm:text-[11px]">GAINERS</TabsTrigger>
          <TabsTrigger value="losers" className="font-mono text-[10px] sm:text-[11px]">LOSERS</TabsTrigger>
          <TabsTrigger value="active" className="font-mono text-[10px] sm:text-[11px]">ACTIVE</TabsTrigger>
          <TabsTrigger value="high" className="font-mono text-[10px] sm:text-[11px]">52W HIGH</TabsTrigger>
          <TabsTrigger value="low" className="font-mono text-[10px] sm:text-[11px]">52W LOW</TabsTrigger>
        </TabsList>

        {loaded === 0 ? (
          <div className="space-y-2 p-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : (
          <>
            <TabsContent value="gainers" className="pt-2">
              <MoverTable list={gainers} />
            </TabsContent>
            <TabsContent value="losers" className="pt-2">
              <MoverTable list={losers} />
            </TabsContent>
            <TabsContent value="active" className="pt-2">
              <MoverTable list={active} />
            </TabsContent>
            <TabsContent value="high" className="pt-2">
              <MoverTable list={nearHigh} showHigh />
            </TabsContent>
            <TabsContent value="low" className="pt-2">
              <MoverTable list={nearLow} showLow />
            </TabsContent>
          </>
        )}
      </Tabs>

      <div className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
        52W HIGH = nearest yearly highs · 52W LOW = nearest yearly lows (bounce candidates) · delayed quotes
      </div>
    </Panel>
  );
}
