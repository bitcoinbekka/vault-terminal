import { useState } from 'react';
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
  value: number | null;
  cost: number;
  position: Position;
}

/** Portfolio with live mark-to-market, stored on Nostr kind 30078. */
export function PortfolioPanel() {
  const { positions, save, user } = usePositions();
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const equities = positions.filter((p) => !p.contract);
  const options = positions.filter((p) => p.contract);
  const equitySymbols = [...new Set(equities.map((p) => p.symbol))];
  const optionUnderlyings = [...new Set(options.map((p) => p.symbol))];

  const equityQuotes = useQuotes(equitySymbols);
  const chains = useCboeChains(optionUnderlyings);

  const rows: Row[] = [];

  for (const p of equities) {
    const idx = equitySymbols.indexOf(p.symbol);
    const last = equityQuotes[idx]?.data?.meta?.regularMarketPrice ?? null;
    rows.push({
      key: `eq-${p.symbol}-${p.quantity}-${p.avgCost}`,
      label: p.symbol,
      sub: p.note ?? '',
      qty: p.quantity,
      avgCost: p.avgCost,
      last,
      value: last !== null ? last * p.quantity : null,
      cost: p.avgCost * p.quantity,
      position: p,
    });
  }

  for (const p of options) {
    const idx = optionUnderlyings.indexOf(p.symbol);
    const chain = chains[idx]?.data;
    const contract = chain?.options.find((o) => o.option === p.contract);
    const last = contract?.last_trade_price ?? null;
    const mult = 100;
    rows.push({
      key: `opt-${p.contract}`,
      label: `${p.symbol} ${p.expiry ? formatExpiration(p.expiry) : ''} ${p.optionType ?? ''} ${p.strike ? formatPrice(p.strike) : ''}`,
      sub: `${p.contract}${p.note ? ` · ${p.note}` : ''}`,
      qty: p.quantity,
      avgCost: p.avgCost,
      last,
      value: last !== null ? last * p.quantity * mult : null,
      cost: p.avgCost * p.quantity * mult,
      position: p,
    });
  }

  const totals = rows.reduce(
    (acc, r) => {
      acc.cost += r.cost;
      if (r.value !== null) {
        acc.value += r.value;
        acc.marked += 1;
      }
      return acc;
    },
    { cost: 0, value: 0, marked: 0 },
  );
  const totalPnl = totals.value - totals.cost;
  const totalPnlPct = totals.cost > 0 ? (totalPnl / totals.cost) * 100 : null;

  const remove = async (key: string) => {
    setRemoving(key);
    const index = positions.findIndex(
      (p) =>
        rows.find((r) => r.key === key)?.position === p,
    );
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
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="font-mono text-[10px] tracking-wider text-muted-foreground">SYMBOL / CONTRACT</TableHead>
              <TableHead className="text-right font-mono text-[10px] tracking-wider text-muted-foreground">QTY</TableHead>
              <TableHead className="text-right font-mono text-[10px] tracking-wider text-muted-foreground">AVG COST</TableHead>
              <TableHead className="text-right font-mono text-[10px] tracking-wider text-muted-foreground">LAST</TableHead>
              <TableHead className="text-right font-mono text-[10px] tracking-wider text-muted-foreground">VALUE</TableHead>
              <TableHead className="text-right font-mono text-[10px] tracking-wider text-muted-foreground">P/L</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const pnl = r.value !== null ? r.value - r.cost : null;
              const pnlPct = r.cost > 0 && pnl !== null ? (pnl / r.cost) * 100 : null;
              return (
                <TableRow key={r.key} className="group">
                  <TableCell className="max-w-[240px]">
                    <span className="flex flex-col">
                      <span className="font-mono text-sm font-bold">{r.label}</span>
                      <span className="truncate text-[11px] text-muted-foreground">{r.sub || '—'}</span>
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm tabular-nums">{r.qty}</TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">{formatPrice(r.avgCost)}</TableCell>
                  <TableCell className="text-right font-mono text-sm tabular-nums">{formatPrice(r.last)}</TableCell>
                  <TableCell className="text-right font-mono text-sm tabular-nums">{formatPrice(r.value)}</TableCell>
                  <TableCell className="text-right">
                    <span className={cn('font-mono text-sm font-semibold tabular-nums', colorForChange(pnl))}>
                      {formatSigned(pnl)}
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
          {totals.marked > 0 && (
            <TableFooter>
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={4} className="font-mono text-xs font-bold tracking-wider text-foreground">
                  TOTAL ({totals.marked}/{rows.length} MARKED)
                </TableCell>
                <TableCell className="text-right font-mono text-sm font-bold tabular-nums">{formatPrice(totals.value)}</TableCell>
                <TableCell className="text-right">
                  <span className={cn('font-mono text-sm font-bold tabular-nums', colorForChange(totalPnl))}>
                    {formatSigned(totalPnl)}
                    {totalPnlPct !== null ? <span className="ml-1 text-[11px] opacity-70">({totalPnlPct.toFixed(1)}%)</span> : null}
                  </span>
                </TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      )}

      <div className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
        {user
          ? 'Marked to market from delayed quotes · option contracts × 100 · stored on Nostr kind 30078'
          : 'Log in to track positions on Nostr'}
      </div>

      <AddPositionDialog open={addOpen} onOpenChange={setAddOpen} />
    </Panel>
  );
}
