import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { LoginArea } from '@/components/auth/LoginArea';

import { useQuotes } from '@/hooks/useYahoo';
import { useWatchlist } from '@/hooks/useWatchlist';
import { usePositions } from '@/hooks/usePositions';
import { useToast } from '@/hooks/useToast';
import { useMomentum, momentumLabel, momentumScore } from '@/hooks/useMomentum';

import { STARTER_WATCHLIST } from '@/lib/yahoo';
import { formatCompact, formatPrice } from '@/lib/format';
import { cn } from '@/lib/utils';

import { Panel } from './Panel';
import { PriceChange } from './PriceChange';
import { Sparkline } from './Sparkline';
import { AddSymbolDialog } from './AddSymbolDialog';

type SortMode = 'symbol' | 'momentum';

interface Row {
  symbol: string;
  name: string;
  currency: string;
  price: number | null;
  change: number | null;
  pct: number | null;
  volume: number | null;
  closes: number[];
  pos?: { qty: number; isOption: boolean };
  pending: boolean;
  score: number | null;
  label: { text: string; className: string } | null;
}

/** The user's watchlist with live quotes + momentum. Backed by Nostr kind 30078. */
export function WatchlistPanel() {
  const { watchlist, isLoading, save, user } = useWatchlist();
  const { positions } = usePositions();
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('symbol');

  const display = user ? watchlist : watchlist.length > 0 ? watchlist : STARTER_WATCHLIST;
  const quotes = useQuotes(display);
  const { infos } = useMomentum(display);

  const positionMap = useMemo(() => {
    const map = new Map<string, { qty: number; isOption: boolean }>();
    for (const p of positions) {
      const cur = map.get(p.symbol);
      map.set(p.symbol, {
        qty: (cur?.qty ?? 0) + (p.contract ? 0 : p.quantity),
        isOption: Boolean(cur?.isOption) || Boolean(p.contract),
      });
    }
    return map;
  }, [positions]);

  const rows: Row[] = useMemo(() => {
    const infoBySymbol = new Map(infos.map((i) => [i.symbol, i]));
    return display.map((symbol, i) => {
      const q = quotes[i];
      const meta = q.data?.meta;
      const prev = meta?.chartPreviousClose ?? meta?.previousClose;
      const price = meta?.regularMarketPrice ?? null;
      const change = price !== null && typeof prev === 'number' ? price - prev : null;
      const pct = change !== null && prev ? (change / prev) * 100 : null;
      const score = momentumScore(infoBySymbol.get(symbol), pct);
      return {
        symbol,
        name: meta?.longName ?? meta?.shortName ?? '',
        currency: meta?.currency ?? 'USD',
        price,
        change,
        pct,
        volume: meta?.regularMarketVolume ?? null,
        closes: (q.data?.candles ?? []).map((c) => c.c),
        pos: positionMap.get(symbol),
        pending: q.isPending && !q.data,
        score,
        label: momentumLabel(score),
      };
    });
  }, [display, quotes, infos, positionMap]);

  const sorted = useMemo(() => {
    const arr = [...rows];
    if (sortMode === 'momentum') {
      arr.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    } else {
      arr.sort((a, b) => a.symbol.localeCompare(b.symbol));
    }
    return arr;
  }, [rows, sortMode]);

  const remove = async (symbol: string) => {
    setRemoving(symbol);
    try {
      await save(watchlist.filter((s) => s !== symbol));
      toast({ title: 'Removed from watchlist', description: symbol });
    } catch {
      toast({ title: 'Failed to remove', variant: 'destructive' });
    } finally {
      setRemoving(null);
    }
  };

  return (
    <Panel
      title={user ? 'WATCHLIST // YOUR STOCKS' : 'WATCHLIST // PREVIEW'}
      id="watchlist"
      right={
        <div className="flex items-center gap-1.5">
          <div className="flex rounded-md border border-border p-0.5">
            {(['symbol', 'momentum'] as SortMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setSortMode(m)}
                className={cn(
                  'rounded px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wider transition-colors',
                  sortMode === m ? 'bg-signal/15 text-signal' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {m === 'symbol' ? 'A-Z' : 'MOM'}
              </button>
            ))}
          </div>
          {user ? (
            <Button size="sm" variant="outline" className="h-7 gap-1 px-2 font-mono text-[11px]" onClick={() => setAddOpen(true)}>
              <Plus className="size-3.5" /> ADD
            </Button>
          ) : null}
        </div>
      }
    >
      {!user && (
        <div className="flex flex-col items-start gap-2 border-b border-border bg-muted/20 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Showing a preview list. Log in with Nostr to track your own portfolio across any device.
          </p>
          <LoginArea className="w-full sm:w-auto" />
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="font-mono text-[10px] tracking-wider text-muted-foreground">SYMBOL</TableHead>
            <TableHead className="text-right font-mono text-[10px] tracking-wider text-muted-foreground">LAST</TableHead>
            <TableHead className="text-right font-mono text-[10px] tracking-wider text-muted-foreground">CHG</TableHead>
            <TableHead className="text-right font-mono text-[10px] tracking-wider text-muted-foreground">VOL</TableHead>
            <TableHead className="hidden text-right font-mono text-[10px] tracking-wider text-muted-foreground md:table-cell">MOM</TableHead>
            <TableHead className="hidden font-mono text-[10px] tracking-wider text-muted-foreground md:table-cell">1D</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((r) => {
            if (r.pending) {
              return (
                <TableRow key={`${r.symbol}-loading`} className="hover:bg-transparent">
                  <TableCell colSpan={7}>
                    <div className="flex items-center gap-3 py-1">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  </TableCell>
                </TableRow>
              );
            }
            return (
              <TableRow key={r.symbol} className="group">
                <TableCell className="max-w-[180px]">
                  <Link to={`/stock/${r.symbol}`} className="flex flex-col">
                    <span className="flex items-center gap-1.5 font-mono text-sm font-bold group-hover:text-signal">
                      {r.symbol}
                      {r.currency !== 'USD' ? (
                        <span className="rounded-sm bg-muted px-1 font-mono text-[9px] font-bold text-muted-foreground">{r.currency}</span>
                      ) : null}
                      {r.pos?.isOption ? (
                        <span className="rounded-sm bg-signal/15 px-1 font-mono text-[9px] font-bold text-signal" title="Has option positions">OPT</span>
                      ) : r.pos ? (
                        <span className="rounded-sm bg-muted px-1 font-mono text-[9px] font-bold text-muted-foreground" title={`Position: ${r.pos.qty} shares`}>{r.pos.qty} SH</span>
                      ) : null}
                    </span>
                    <span className="truncate text-[11px] text-muted-foreground">{r.name}</span>
                  </Link>
                </TableCell>
                <TableCell className="text-right font-mono text-sm font-semibold tabular-nums">
                  {formatPrice(r.price)}
                </TableCell>
                <TableCell className="text-right">
                  <PriceChange change={r.change} percent={r.pct} compact />
                </TableCell>
                <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                  {formatCompact(r.volume)}
                </TableCell>
                <TableCell className="hidden text-right md:table-cell">
                  {r.label ? (
                    <span className={cn('font-mono text-[10px] font-bold tracking-wider', r.label.className)} title={`Momentum ${r.score}/100`}>
                      {r.label.text}
                      <span className="ml-1 text-muted-foreground">{r.score}</span>
                    </span>
                  ) : (
                    <span className="font-mono text-[10px] text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <Sparkline data={r.closes} positive={(r.pct ?? 0) >= 0} width={72} height={20} />
                </TableCell>
                <TableCell className="text-right">
                  {user ? (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7 text-muted-foreground opacity-0 transition-opacity hover:text-loss group-hover:opacity-100"
                      aria-label={`Remove ${r.symbol}`}
                      onClick={() => remove(r.symbol)}
                      disabled={removing === r.symbol}
                    >
                      {removing === r.symbol ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            );
          })}

          {!isLoading && display.length === 0 && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={7}>
                <div className="px-4 py-10 text-center">
                  <p className="mb-3 text-sm text-muted-foreground">
                    No symbols yet. Add tickers you own or follow to build your terminal.
                  </p>
                  {user ? (
                    <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
                      <Plus className="mr-1 size-4" /> Add your first symbol
                    </Button>
                  ) : (
                    <LoginArea className="w-full justify-center" />
                  )}
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <div className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
        Momentum = SMA20/50 trend + RSI + day strength (0–100) · sort A-Z or MOM · delayed quotes ·{' '}
        {user ? 'saved to Nostr kind 30078 — follows your npub' : 'log in to persist this list on Nostr'}
      </div>

      <AddSymbolDialog open={addOpen} onOpenChange={setAddOpen} />
    </Panel>
  );
}
