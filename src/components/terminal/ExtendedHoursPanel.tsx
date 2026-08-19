import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Moon, Sunrise } from 'lucide-react';

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

import { useQuotes } from '@/hooks/useYahoo';
import { useWatchlist } from '@/hooks/useWatchlist';
import { MOVER_UNIVERSE, UNIVERSE_LIMIT } from '@/lib/marketUniverse';
import { computeSession, type SessionInfo } from '@/lib/session';
import { colorForChange, formatPercent, formatPrice } from '@/lib/format';
import { cn } from '@/lib/utils';

import { Panel } from './Panel';

interface Row {
  symbol: string;
  name: string;
  session: SessionInfo;
}

function SessionTable({ rows }: { rows: Row[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="font-mono text-[10px] tracking-wider text-muted-foreground">SYMBOL</TableHead>
          <TableHead className="hidden font-mono text-[10px] tracking-wider text-muted-foreground md:table-cell">NAME</TableHead>
          <TableHead className="text-right font-mono text-[10px] tracking-wider text-muted-foreground">PRICE</TableHead>
          <TableHead className="text-right font-mono text-[10px] tracking-wider text-muted-foreground">CHG%</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => {
          const price = r.session.prePrice ?? r.session.postPrice ?? r.session.lastPrice;
          const pct = r.session.preChangePct ?? r.session.postChangePct;
          return (
            <TableRow key={r.symbol} className="group">
              <TableCell className="max-w-[150px]">
                <Link to={`/stock/${r.symbol}`} className="flex flex-col">
                  <span className="font-mono text-sm font-bold group-hover:text-signal">{r.symbol}</span>
                  <span className="truncate text-[11px] text-muted-foreground md:hidden">{r.name}</span>
                </Link>
              </TableCell>
              <TableCell className="hidden max-w-[200px] truncate text-xs text-muted-foreground md:table-cell">{r.name}</TableCell>
              <TableCell className="text-right font-mono text-sm tabular-nums">{formatPrice(price)}</TableCell>
              <TableCell className={cn('text-right font-mono text-xs font-semibold tabular-nums', colorForChange(pct ?? 0))}>
                {formatPercent(pct)}
              </TableCell>
            </TableRow>
          );
        })}
        {rows.length === 0 && (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
              No extended-hours data right now — check during pre-market or after-hours.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

/** Pre-market & after-hours movers across the liquid universe + watchlist. */
export function ExtendedHoursPanel() {
  const { watchlist } = useWatchlist();

  const universe = useMemo(() => {
    const merged = [...MOVER_UNIVERSE, ...watchlist];
    return [...new Set(merged)].slice(0, UNIVERSE_LIMIT);
  }, [watchlist]);

  const quotes = useQuotes(universe);

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    quotes.forEach((q, i) => {
      const symbol = universe[i];
      const meta = q.data?.meta;
      if (!symbol || !meta) return;
      out.push({
        symbol,
        name: meta.longName ?? meta.shortName ?? '',
        session: computeSession(q.data?.candles ?? [], meta),
      });
    });
    return out;
  }, [quotes, universe]);

  const pre = rows
    .filter((r) => r.session.prePrice !== null && r.session.preChangePct !== null)
    .sort((a, b) => (b.session.preChangePct ?? 0) - (a.session.preChangePct ?? 0))
    .slice(0, 12);
  const post = rows
    .filter((r) => r.session.postPrice !== null && r.session.postChangePct !== null)
    .sort((a, b) => (b.session.postChangePct ?? 0) - (a.session.postChangePct ?? 0))
    .slice(0, 12);

  const anyPre = pre.some((r) => r.session.inPre);
  const anyPost = post.some((r) => r.session.inPost);
  const sessionLabel = anyPre ? 'PRE-MARKET OPEN' : anyPost ? 'AFTER-HOURS' : 'REGULAR / EXT';

  return (
    <Panel
      title="EXTENDED HOURS // OVERNIGHT MOVERS"
      id="extended"
      right={
        <span
          className={cn(
            'flex items-center gap-1.5 font-mono text-[10px] font-bold tracking-wider',
            anyPre ? 'text-signal' : anyPost ? 'text-muted-foreground' : 'text-muted-foreground',
          )}
        >
          {anyPre ? <Sunrise className="size-3.5" /> : <Moon className="size-3.5" />}
          {sessionLabel}
        </span>
      }
    >
      <div className="border-b border-border px-3 py-1.5 text-[11px] text-muted-foreground">
        Scanning {universe.length} liquid symbols · pre-market 4:00–9:30 ET · after-hours 16:00–20:00 ET
      </div>

      {rows.length === 0 ? (
        <div className="space-y-2 p-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : (
        <Tabs defaultValue="pre">
          <TabsList className="mx-3 mt-2 grid w-[calc(100%-1.5rem)] grid-cols-2">
            <TabsTrigger value="pre" className="font-mono text-[11px]">PRE-MARKET</TabsTrigger>
            <TabsTrigger value="post" className="font-mono text-[11px]">AFTER-HOURS</TabsTrigger>
          </TabsList>
          <TabsContent value="pre" className="pt-2">
            <SessionTable rows={pre} />
          </TabsContent>
          <TabsContent value="post" className="pt-2">
            <SessionTable rows={post} />
          </TabsContent>
        </Tabs>
      )}

      <div className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
        Overnight &amp; extended-session movers vs previous close · delayed quotes
      </div>
    </Panel>
  );
}
