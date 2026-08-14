import { useMemo, useState } from 'react';
import { BriefcaseBusiness, Loader2, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { LoginArea } from '@/components/auth/LoginArea';

import { usePositions, type Position } from '@/hooks/usePositions';
import { useCboeChains, useQuotes } from '@/hooks/useYahoo';
import { useTrades } from '@/hooks/useTrades';
import { useToast } from '@/hooks/useToast';

import { colorForChange, formatExpiration, formatPrice, formatSigned } from '@/lib/format';
import { cn } from '@/lib/utils';

import { Panel } from './Panel';
import { AddPositionDialog } from './AddPositionDialog';

interface Row {
  key: string;
  label: string;
  sub: string;
  qty: number;
  avgCost: number;
  last: number | null;
  prevClose: number | null;
  value: number | null;
  cost: number;
  dayPnl: number | null;
  pnl: number | null;
  position: Position;
}

const ALLOC_COLORS = ['#f59e0b', '#38bdf8', '#a78bfa', '#f472b6', '#34d399', '#f87171', '#818cf8', '#fbbf24'];

/** Portfolio with live mark-to-market, analytics and journal integration. */
export function PortfolioPanel() {
  const { positions, save, user } = usePositions();
  const { stats: journal } = useTrades();
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const equities = positions.filter((p) => !p.contract);
  const options = positions.filter((p) => p.contract);
  const equitySymbols = [...new Set(equities.map((p) => p.symbol))];
  const optionUnderlyings = [...new Set(options.map((p) => p.symbol))];

  const equityQuotes = useQuotes(equitySymbols);
  const chains = useCboeChains(optionUnderlyings);

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];

    for (const p of equities) {
      const idx = equitySymbols.indexOf(p.symbol);
      const meta = equityQuotes[idx]?.data?.meta;
      const last = meta?.regularMarketPrice ?? null;
      const prev = meta ? (meta.chartPreviousClose ?? meta.previousClose ?? null) : null;
      const value = last !== null ? last * p.quantity : null;
      const cost = p.avgCost * p.quantity;
      out.push({
        key: `eq-${p.symbol}-${p.quantity}-${p.avgCost}`,
        label: p.symbol,
        sub: p.note ?? '',
        qty: p.quantity,
        avgCost: p.avgCost,
        last,
        prevClose: prev,
        value,
        cost,
        dayPnl: last !== null && prev !== null ? (last - prev) * p.quantity : null,
        pnl: value !== null ? value - cost : null,
        position: p,
      });
    }

    for (const p of options) {
      const idx = optionUnderlyings.indexOf(p.symbol);
      const chain = chains[idx]?.data;
      const contract = chain?.options.find((o) => o.option === p.contract);
      const last = contract?.last_trade_price ?? null;
      const prev = contract?.prev_day_close ?? null;
      const mult = 100;
      const value = last !== null ? last * p.quantity * mult : null;
      const cost = p.avgCost * p.quantity * mult;
      out.push({
        key: `opt-${p.contract}`,
        label: `${p.symbol} ${p.expiry ? formatExpiration(p.expiry) : ''} ${p.optionType ?? ''} ${p.strike ? formatPrice(p.strike) : ''}`,
        sub: `${p.contract}${p.note ? ` · ${p.note}` : ''}`,
        qty: p.quantity,
        avgCost: p.avgCost,
        last,
        prevClose: prev,
        value,
        cost,
        dayPnl: last !== null && prev !== null ? (last - prev) * p.quantity * mult : null,
        pnl: value !== null ? value - cost : null,
        position: p,
      });
    }

    return out;
  }, [equities, options, equitySymbols, optionUnderlyings, equityQuotes, chains]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        acc.cost += r.cost;
        if (r.value !== null) acc.value += r.value;
        if (r.dayPnl !== null) acc.dayPnl += r.dayPnl;
        if (r.pnl !== null) acc.pnl += r.pnl;
        return acc;
      },
      { cost: 0, value: 0, dayPnl: 0, pnl: 0 },
    );
  }, [rows]);

  const unrealized = totals.value - totals.cost;
  const unrealizedPct = totals.cost > 0 ? (unrealized / totals.cost) * 100 : null;
  const netPnl = journal.netRealizedPnl + unrealized;

  // Allocation
  const alloc = useMemo(() => {
    const valued = rows.filter((r) => r.value !== null && r.value > 0);
    const totalValue = valued.reduce((s, r) => s + (r.value ?? 0), 0);
    if (totalValue <= 0) return null;
    const sorted = [...valued].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    const top = sorted.slice(0, 6);
    const rest = sorted.slice(6);
    const restValue = rest.reduce((s, r) => s + (r.value ?? 0), 0);
    const segs = top.map((r, i) => ({
      label: r.label.split(' ')[0],
      value: r.value ?? 0,
      pct: ((r.value ?? 0) / totalValue) * 100,
      color: ALLOC_COLORS[i % ALLOC_COLORS.length],
    }));
    if (restValue > 0) {
      segs.push({ label: 'Other', value: restValue, pct: (restValue / totalValue) * 100, color: ALLOC_COLORS[6] });
    }
    return segs;
  }, [rows]);

  const best = useMemo(() => {
    const valued = rows.filter((r) => r.pnl !== null);
    if (valued.length === 0) return null;
    const byPnl = [...valued].sort((a, b) => (b.pnl ?? 0) - (a.pnl ?? 0));
    return { winner: byPnl[0], loser: byPnl[byPnl.length - 1] };
  }, [rows]);

  const remove = async (key: string) => {
    setRemoving(key);
    const index = positions.findIndex((p) => rows.find((r) => r.key === key)?.position === p);
    try {
      const next = positions.filter((_, i) => i !== index);
      await save(next);
      toast({ title: 'Position removed' });
    } catch {
      toast({ title: 'Failed to remove position', variant: 'destructive' });
    } finally {
      setRemoving(null);
    }
  };

  return (
    <Panel
      title={user ? 'PORTFOLIO // POSITIONS & P/L' : 'PORTFOLIO'}
      id="portfolio"
      right={
        user ? (
          <Button size="sm" variant="outline" className="h-7 gap-1 px-2 font-mono text-[11px]" onClick={() => setAddOpen(true)}>
            <Plus className="size-3.5" /> ADD
          </Button>
        ) : (
          <BriefcaseBusiness className="size-3.5 text-muted-foreground" />
        )
      }
    >
      {!user ? (
        <div className="flex flex-col items-start gap-3 px-4 py-8">
          <p className="text-sm text-muted-foreground">
            Track the stocks and options you own — shares, contracts, cost basis and live P/L — synced to
            your Nostr identity.
          </p>
          <LoginArea className="w-full sm:w-auto" />
        </div>
      ) : rows.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <p className="mb-3 text-sm text-muted-foreground">No positions tracked yet.</p>
          <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="mr-1 size-4" /> Track your first position
          </Button>
        </div>
      ) : (
        <>
          {/* Analytics strip */}
          <div className="border-b border-border bg-muted/20 px-3 py-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div>
                <div className="font-mono text-[10px] font-bold tracking-widest text-muted-foreground">DAY P/L</div>
                <div className={cn('font-mono text-base font-bold tabular-nums', colorForChange(totals.dayPnl))}>
                  {formatSigned(totals.dayPnl)}
                </div>
              </div>
              <div>
                <div className="font-mono text-[10px] font-bold tracking-widest text-muted-foreground">UNREALIZED</div>
                <div className={cn('font-mono text-base font-bold tabular-nums', colorForChange(unrealized))}>
                  {formatSigned(unrealized)}
                  {unrealizedPct !== null ? <span className="ml-1 text-[11px] opacity-70">({unrealizedPct.toFixed(1)}%)</span> : null}
                </div>
              </div>
              <div>
                <div className="font-mono text-[10px] font-bold tracking-widest text-muted-foreground">REALIZED (JOURNAL)</div>
                <div className={cn('font-mono text-base font-bold tabular-nums', colorForChange(journal.netRealizedPnl))}>
                  {formatSigned(journal.netRealizedPnl)}
                </div>
              </div>
              <div>
                <div className="font-mono text-[10px] font-bold tracking-widest text-muted-foreground">NET P/L</div>
                <div className={cn('font-mono text-base font-bold tabular-nums', colorForChange(netPnl))}>
                  {formatSigned(netPnl)}
                </div>
              </div>
            </div>

            {alloc && alloc.length > 1 ? (
              <div className="mt-3">
                <div className="flex h-2 w-full overflow-hidden rounded-full">
                  {alloc.map((s) => (
                    <div key={s.label} style={{ width: `${s.pct}%`, background: s.color }} title={`${s.label} ${s.pct.toFixed(1)}%`} />
                  ))}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                  {alloc.map((s) => (
                    <span key={s.label} className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                      <span className="inline-block size-2 rounded-sm" style={{ background: s.color }} />
                      {s.label} {s.pct.toFixed(0)}%
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {best && best.winner !== best.loser ? (
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                <span className="flex items-center gap-1.5">
                  <span className="font-mono text-[10px] font-bold text-muted-foreground">BEST</span>
                  <span className="font-mono font-semibold">{best.winner.label.split(' ')[0]}</span>
                  <span className={cn('font-mono tabular-nums', colorForChange(best.winner.pnl))}>{formatSigned(best.winner.pnl)}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="font-mono text-[10px] font-bold text-muted-foreground">WORST</span>
                  <span className="font-mono font-semibold">{best.loser.label.split(' ')[0]}</span>
                  <span className={cn('font-mono tabular-nums', colorForChange(best.loser.pnl))}>{formatSigned(best.loser.pnl)}</span>
                </span>
              </div>
            ) : null}
          </div>

          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-mono text-[10px] tracking-wider text-muted-foreground">SYMBOL / CONTRACT</TableHead>
                <TableHead className="text-right font-mono text-[10px] tracking-wider text-muted-foreground">QTY</TableHead>
                <TableHead className="hidden text-right font-mono text-[10px] tracking-wider text-muted-foreground xl:table-cell">AVG COST</TableHead>
                <TableHead className="text-right font-mono text-[10px] tracking-wider text-muted-foreground">LAST</TableHead>
                <TableHead className="text-right font-mono text-[10px] tracking-wider text-muted-foreground">VALUE</TableHead>
                <TableHead className="hidden text-right font-mono text-[10px] tracking-wider text-muted-foreground xl:table-cell">DAY P/L</TableHead>
                <TableHead className="text-right font-mono text-[10px] tracking-wider text-muted-foreground">P/L</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const pnlPct = r.cost > 0 && r.pnl !== null ? (r.pnl / r.cost) * 100 : null;
                return (
                  <TableRow key={r.key} className="group">
                    <TableCell className="max-w-[240px]">
                      <span className="flex flex-col">
                        <span className="font-mono text-sm font-bold">{r.label}</span>
                        <span className="truncate text-[11px] text-muted-foreground">{r.sub || '—'}</span>
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums">{r.qty}</TableCell>
                    <TableCell className="hidden text-right font-mono text-xs tabular-nums text-muted-foreground xl:table-cell">{formatPrice(r.avgCost)}</TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums">{formatPrice(r.last)}</TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums">{formatPrice(r.value)}</TableCell>
                    <TableCell className={cn('hidden text-right font-mono text-sm tabular-nums xl:table-cell', colorForChange(r.dayPnl))}>
                      {formatSigned(r.dayPnl)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={cn('font-mono text-sm font-semibold tabular-nums', colorForChange(r.pnl))}>
                        {formatSigned(r.pnl)}
                        {pnlPct !== null ? <span className="ml-1 text-[11px] opacity-70">({pnlPct.toFixed(1)}%)</span> : null}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 text-muted-foreground opacity-0 transition-opacity hover:text-loss group-hover:opacity-100"
                        aria-label={`Remove position ${r.label}`}
                        onClick={() => remove(r.key)}
                        disabled={removing === r.key}
                      >
                        {removing === r.key ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={4} className="font-mono text-xs font-bold tracking-wider text-foreground">
                  TOTAL
                </TableCell>
                <TableCell className="text-right font-mono text-sm font-bold tabular-nums">{formatPrice(totals.value)}</TableCell>
                <TableCell className={cn('hidden text-right font-mono text-sm font-bold tabular-nums xl:table-cell', colorForChange(totals.dayPnl))}>
                  {formatSigned(totals.dayPnl)}
                </TableCell>
                <TableCell className="text-right">
                  <span className={cn('font-mono text-sm font-bold tabular-nums', colorForChange(unrealized))}>
                    {formatSigned(unrealized)}
                    {unrealizedPct !== null ? <span className="ml-1 text-[11px] opacity-70">({unrealizedPct.toFixed(1)}%)</span> : null}
                  </span>
                </TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </>
      )}

      <div className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
        {user
          ? 'Marked to market from delayed quotes · option contracts × 100 · realized P/L from your journal · stored on Nostr kind 30078'
          : 'Log in to track positions on Nostr'}
      </div>

      <AddPositionDialog open={addOpen} onOpenChange={setAddOpen} />
    </Panel>
  );
}
