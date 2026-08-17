import { useMemo, useState } from 'react';
import { BriefcaseBusiness, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';

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
import { toUsd, useUsdRates } from '@/hooks/useFx';

import { colorForChange, formatExpiration, formatPrice, formatSigned } from '@/lib/format';
import { cn } from '@/lib/utils';

import { Panel } from './Panel';
import { AddPositionDialog } from './AddPositionDialog';
import { PayoffCard } from './OptionPayoff';
import { Mask } from './Mask';
import { ConfirmDialog } from './ConfirmDialog';
import { usePrivacyMode } from '@/hooks/usePrivacyMode';

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
  currency: string;
  usdValue: number | null;
  usdCost: number | null;
  usdDayPnl: number | null;
  usdPnl: number | null;
  position: Position;
}

const ALLOC_COLORS = ['#f59e0b', '#38bdf8', '#a78bfa', '#f472b6', '#34d399', '#f87171', '#818cf8', '#fbbf24'];

type SortMode = 'symbol' | 'value' | 'pnl';

const SORT_MODES: { mode: SortMode; label: string }[] = [
  { mode: 'symbol', label: 'A-Z' },
  { mode: 'value', label: 'VAL' },
  { mode: 'pnl', label: 'P/L' },
];

/** Portfolio with live mark-to-market, analytics and journal integration. */
export function PortfolioPanel() {
  const { positions, save, user } = usePositions();
  const { stats: journal } = useTrades();
  const { toast } = useToast();
  const { privacy } = usePrivacyMode();
  const [addOpen, setAddOpen] = useState(false);
  const [editPos, setEditPos] = useState<Position | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [confirmRemoveKey, setConfirmRemoveKey] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('symbol');

  const equities = positions.filter((p) => !p.contract);
  const options = positions.filter((p) => p.contract);
  const equitySymbols = [...new Set(equities.map((p) => p.symbol))];
  const optionUnderlyings = [...new Set(options.map((p) => p.symbol))];

  const equityQuotes = useQuotes(equitySymbols);
  const chains = useCboeChains(optionUnderlyings);
  // Underlying prices, for the option payoff markers (deduped with watchlist/tape).
  const underlyingQuotes = useQuotes(optionUnderlyings);

  // Currencies present in the portfolio (from quote metadata), for USD totals.
  const currencies = useMemo(() => {
    const set = new Set<string>();
    equityQuotes.forEach((q) => {
      const c = q.data?.meta?.currency;
      if (c && c !== 'USD') set.add(c);
    });
    underlyingQuotes.forEach((q) => {
      const c = q.data?.meta?.currency;
      if (c && c !== 'USD') set.add(c);
    });
    return [...set];
  }, [equityQuotes, underlyingQuotes]);
  const { rates } = useUsdRates(currencies);

  const currencyFor = (symbol: string): string => {
    const idx = equitySymbols.indexOf(symbol);
    return equityQuotes[idx]?.data?.meta?.currency ?? 'USD';
  };
  const optionCurrencyFor = (symbol: string): string => {
    const idx = optionUnderlyings.indexOf(symbol);
    return underlyingQuotes[idx]?.data?.meta?.currency ?? 'USD';
  };

  const underlyingPriceFor = (symbol: string): number | null => {
    const idx = optionUnderlyings.indexOf(symbol);
    return underlyingQuotes[idx]?.data?.meta?.regularMarketPrice ?? null;
  };

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];

    for (const p of equities) {
      const idx = equitySymbols.indexOf(p.symbol);
      const meta = equityQuotes[idx]?.data?.meta;
      const last = meta?.regularMarketPrice ?? null;
      const prev = meta ? (meta.chartPreviousClose ?? meta.previousClose ?? null) : null;
      const value = last !== null ? last * p.quantity : null;
      const cost = p.avgCost * p.quantity;
      const dayPnl = last !== null && prev !== null ? (last - prev) * p.quantity : null;
      const pnl = value !== null ? value - cost : null;
      const currency = meta?.currency ?? 'USD';
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
        dayPnl,
        pnl,
        currency,
        usdValue: value !== null ? toUsd(value, currency, rates) : null,
        usdCost: toUsd(cost, currency, rates),
        usdDayPnl: dayPnl !== null ? toUsd(dayPnl, currency, rates) : null,
        usdPnl: pnl !== null ? toUsd(pnl, currency, rates) : null,
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
      const dayPnl = last !== null && prev !== null ? (last - prev) * p.quantity * mult : null;
      const pnl = value !== null ? value - cost : null;
      const currency = optionCurrencyFor(p.symbol);
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
        dayPnl,
        pnl,
        currency,
        usdValue: value !== null ? toUsd(value, currency, rates) : null,
        usdCost: toUsd(cost, currency, rates),
        usdDayPnl: dayPnl !== null ? toUsd(dayPnl, currency, rates) : null,
        usdPnl: pnl !== null ? toUsd(pnl, currency, rates) : null,
        position: p,
      });
    }

    return out;
  }, [equities, options, equitySymbols, optionUnderlyings, equityQuotes, underlyingQuotes, chains, rates]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        if (r.usdCost !== null) acc.cost += r.usdCost;
        if (r.usdValue !== null) acc.value += r.usdValue;
        if (r.usdDayPnl !== null) acc.dayPnl += r.usdDayPnl;
        if (r.usdPnl !== null) acc.pnl += r.usdPnl;
        return acc;
      },
      { cost: 0, value: 0, dayPnl: 0, pnl: 0 },
    );
  }, [rows]);

  const unrealized = totals.value - totals.cost;
  const unrealizedPct = totals.cost > 0 ? (unrealized / totals.cost) * 100 : null;
  const netPnl = journal.netRealizedPnl + unrealized;

  const sortedRows = useMemo(() => {
    const arr = [...rows];
    if (sortMode === 'value') {
      arr.sort((a, b) => (b.usdValue ?? -Infinity) - (a.usdValue ?? -Infinity));
    } else if (sortMode === 'pnl') {
      arr.sort((a, b) => (b.usdPnl ?? -Infinity) - (a.usdPnl ?? -Infinity));
    } else {
      arr.sort((a, b) => a.label.localeCompare(b.label));
    }
    return arr;
  }, [rows, sortMode]);

  // Allocation (USD-normalized)
  const alloc = useMemo(() => {
    const valued = rows.filter((r) => r.usdValue !== null && r.usdValue > 0);
    const totalValue = valued.reduce((s, r) => s + (r.usdValue ?? 0), 0);
    if (totalValue <= 0) return null;
    const sorted = [...valued].sort((a, b) => (b.usdValue ?? 0) - (a.usdValue ?? 0));
    const top = sorted.slice(0, 6);
    const rest = sorted.slice(6);
    const restValue = rest.reduce((s, r) => s + (r.usdValue ?? 0), 0);
    const segs = top.map((r, i) => ({
      label: r.label.split(' ')[0],
      value: r.usdValue ?? 0,
      pct: ((r.usdValue ?? 0) / totalValue) * 100,
      color: ALLOC_COLORS[i % ALLOC_COLORS.length],
    }));
    if (restValue > 0) {
      segs.push({ label: 'Other', value: restValue, pct: (restValue / totalValue) * 100, color: ALLOC_COLORS[6] });
    }
    return segs;
  }, [rows]);

  const best = useMemo(() => {
    const valued = rows.filter((r) => r.usdPnl !== null);
    if (valued.length === 0) return null;
    const byPnl = [...valued].sort((a, b) => (b.usdPnl ?? 0) - (a.usdPnl ?? 0));
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
          <div className="flex items-center gap-1.5">
            <div className="flex rounded-md border border-border p-0.5">
              {SORT_MODES.map((s) => (
                <button
                  key={s.mode}
                  onClick={() => setSortMode(s.mode)}
                  className={cn(
                    'rounded px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wider transition-colors',
                    sortMode === s.mode ? 'bg-signal/15 text-signal' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <Button size="sm" variant="outline" className="h-7 gap-1 px-2 font-mono text-[11px]" onClick={() => setAddOpen(true)}>
              <Plus className="size-3.5" /> ADD
            </Button>
          </div>
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
                <div className="font-mono text-[10px] font-bold tracking-widest text-muted-foreground">DAY P/L (USD)</div>
                <div className={cn('font-mono text-base font-bold tabular-nums', colorForChange(totals.dayPnl))}>
                  <Mask>{formatSigned(totals.dayPnl)}</Mask>
                </div>
              </div>
              <div>
                <div className="font-mono text-[10px] font-bold tracking-widest text-muted-foreground">UNREALIZED (USD)</div>
                <div className={cn('font-mono text-base font-bold tabular-nums', colorForChange(unrealized))}>
                  <Mask>
                    {formatSigned(unrealized)}
                    {unrealizedPct !== null ? <span className="ml-1 text-[11px] opacity-70">({unrealizedPct.toFixed(1)}%)</span> : null}
                  </Mask>
                </div>
              </div>
              <div>
                <div className="font-mono text-[10px] font-bold tracking-widest text-muted-foreground">REALIZED (JOURNAL)</div>
                <div className={cn('font-mono text-base font-bold tabular-nums', colorForChange(journal.netRealizedPnl))}>
                  <Mask>{formatSigned(journal.netRealizedPnl)}</Mask>
                </div>
              </div>
              <div>
                <div className="font-mono text-[10px] font-bold tracking-widest text-muted-foreground">NET P/L (USD)</div>
                <div className={cn('font-mono text-base font-bold tabular-nums', colorForChange(netPnl))}>
                  <Mask>{formatSigned(netPnl)}</Mask>
                </div>
              </div>
            </div>

            {alloc && alloc.length > 1 ? (
              <div className="mt-3">
                <div className="flex h-2 w-full overflow-hidden rounded-full">
                  {alloc.map((s) => (
                    <div
                      key={s.label}
                      style={{ width: `${s.pct}%`, background: s.color }}
                      title={privacy ? undefined : `${s.label} ${s.pct.toFixed(1)}%`}
                    />
                  ))}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                  {alloc.map((s) => (
                    <span key={s.label} className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                      <span className="inline-block size-2 rounded-sm" style={{ background: s.color }} />
                      {s.label} <Mask>{s.pct.toFixed(0)}%</Mask>
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
                  <span className={cn('font-mono tabular-nums', colorForChange(best.winner.usdPnl))}><Mask>{formatSigned(best.winner.usdPnl)}</Mask></span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="font-mono text-[10px] font-bold text-muted-foreground">WORST</span>
                  <span className="font-mono font-semibold">{best.loser.label.split(' ')[0]}</span>
                  <span className={cn('font-mono tabular-nums', colorForChange(best.loser.usdPnl))}><Mask>{formatSigned(best.loser.usdPnl)}</Mask></span>
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
              {sortedRows.map((r) => {
                const pnlPct = r.cost > 0 && r.pnl !== null ? (r.pnl / r.cost) * 100 : null;
                return (
                  <TableRow key={r.key} className="group">
                    <TableCell className="max-w-[240px]">
                      <span className="flex flex-col">
                        <span className="font-mono text-sm font-bold">{r.label}</span>
                        <span className="truncate text-[11px] text-muted-foreground">{r.sub || '—'}</span>
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums"><Mask>{r.qty}</Mask></TableCell>
                    <TableCell className="hidden text-right font-mono text-xs tabular-nums text-muted-foreground xl:table-cell"><Mask>{formatPrice(r.avgCost)}</Mask></TableCell>
                    <TableCell className="text-right">
                      <span className="font-mono text-sm tabular-nums">
                        {formatPrice(r.last)}
                        {r.currency !== 'USD' ? (
                          <span className="ml-1 rounded-sm bg-muted px-1 font-mono text-[9px] font-bold text-muted-foreground">{r.currency}</span>
                        ) : null}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="flex flex-col items-end">
                        <span className="font-mono text-sm tabular-nums">
                          <Mask>
                            {formatPrice(r.value)}
                            {r.currency !== 'USD' ? (
                              <span className="ml-1 rounded-sm bg-muted px-1 font-mono text-[9px] font-bold text-muted-foreground">{r.currency}</span>
                            ) : null}
                          </Mask>
                        </span>
                        {r.currency !== 'USD' && r.usdValue !== null ? (
                          <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                            <Mask>≈ ${r.usdValue.toFixed(0)} USD</Mask>
                          </span>
                        ) : null}
                      </span>
                    </TableCell>
                    <TableCell className={cn('hidden text-right font-mono text-sm tabular-nums xl:table-cell', colorForChange(r.dayPnl))}>
                      <Mask>{formatSigned(r.dayPnl)}</Mask>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="flex flex-col items-end">
                        <span className={cn('font-mono text-sm font-semibold tabular-nums', colorForChange(r.pnl))}>
                          <Mask>
                            {formatSigned(r.pnl)}
                            {pnlPct !== null ? <span className="ml-1 text-[11px] opacity-70">({pnlPct.toFixed(1)}%)</span> : null}
                          </Mask>
                        </span>
                        {r.currency !== 'USD' && r.usdPnl !== null ? (
                          <span className={cn('font-mono text-[10px] tabular-nums', colorForChange(r.usdPnl))}>
                            <Mask>≈ {formatSigned(r.usdPnl)} USD</Mask>
                          </span>
                        ) : null}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-9 text-muted-foreground hover:text-signal md:size-7 md:opacity-0 md:group-hover:opacity-100"
                          aria-label={`Edit position ${r.label}`}
                          onClick={() => setEditPos(r.position)}
                        >
                          <Pencil className="size-4 md:size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-9 text-muted-foreground hover:text-loss md:size-7 md:opacity-0 md:group-hover:opacity-100"
                          aria-label={`Remove position ${r.label}`}
                          onClick={() => setConfirmRemoveKey(r.key)}
                          disabled={removing === r.key}
                        >
                          {removing === r.key ? <Loader2 className="size-4 animate-spin md:size-3.5" /> : <Trash2 className="size-4 md:size-3.5" />}
                        </Button>
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={4} className="font-mono text-xs font-bold tracking-wider text-foreground">
                  TOTAL (USD)
                </TableCell>
                <TableCell className="text-right font-mono text-sm font-bold tabular-nums"><Mask>{formatPrice(totals.value)}</Mask></TableCell>
                <TableCell className={cn('hidden text-right font-mono text-sm font-bold tabular-nums xl:table-cell', colorForChange(totals.dayPnl))}>
                  <Mask>{formatSigned(totals.dayPnl)}</Mask>
                </TableCell>
                <TableCell className="text-right">
                  <span className={cn('font-mono text-sm font-bold tabular-nums', colorForChange(unrealized))}>
                    <Mask>
                      {formatSigned(unrealized)}
                      {unrealizedPct !== null ? <span className="ml-1 text-[11px] opacity-70">({unrealizedPct.toFixed(1)}%)</span> : null}
                    </Mask>
                  </span>
                </TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </>
      )}

      {user && options.length > 0 ? (
        <div className="space-y-2 border-t border-border px-3 py-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] font-bold tracking-widest text-muted-foreground">
              OPTION PAYOFF // BREAKEVENS
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">per contract · at expiry</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {options.map((p) => (
              <PayoffCard key={p.contract} position={p} currentPrice={underlyingPriceFor(p.symbol)} />
            ))}
          </div>
        </div>
      ) : null}

      <div className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
        {user
          ? 'Marked to market from delayed quotes · totals normalized to USD via live FX (non-USD rows show ≈ USD) · option contracts × 100 · realized P/L from your journal (treated as USD) · stored on Nostr kind 30078'
          : 'Log in to track positions on Nostr'}
      </div>

      <AddPositionDialog open={addOpen} onOpenChange={setAddOpen} />
      <AddPositionDialog
        open={Boolean(editPos)}
        editPosition={editPos}
        onOpenChange={(o) => {
          if (!o) setEditPos(null);
        }}
      />
      <ConfirmDialog
        open={Boolean(confirmRemoveKey)}
        onOpenChange={(o) => {
          if (!o) setConfirmRemoveKey(null);
        }}
        title="Remove position?"
        description="Delete this position from your portfolio? It syncs to Nostr immediately."
        confirmLabel="Remove"
        loading={Boolean(confirmRemoveKey && removing === confirmRemoveKey)}
        onConfirm={() => {
          if (confirmRemoveKey) void remove(confirmRemoveKey);
          setConfirmRemoveKey(null);
        }}
      />
    </Panel>
  );
}
