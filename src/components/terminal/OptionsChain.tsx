import { useEffect, useMemo, useState } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

import { useToast } from '@/hooks/useToast';
import {
  groupOptionsByExpiry,
  type OptionRow,
  type OptionsData,
} from '@/lib/yahoo';
import {
  colorForChange,
  decimalsForPrice,
  formatCompact,
  formatExpiration,
  formatInteger,
  formatPercent,
  formatPrice,
} from '@/lib/format';
import { cn } from '@/lib/utils';

interface OptionsChainProps {
  symbol: string;
  underlyingPrice: number | null;
  options?: OptionsData;
  isLoading: boolean;
  isError: boolean;
}

function OptionTable({
  rows,
  side,
  underlyingPrice,
  symbol,
}: {
  rows: OptionRow[];
  side: 'CALLS' | 'PUTS';
  underlyingPrice: number | null;
  symbol: string;
}) {
  const { toast } = useToast();

  const copy = async (contract: string) => {
    try {
      await navigator.clipboard.writeText(contract);
      toast({ title: 'Contract copied', description: contract });
    } catch {
      toast({ title: 'Could not copy', variant: 'destructive' });
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between border-b border-border bg-muted/20 px-3 py-1.5">
        <h4 className={cn('font-mono text-[11px] font-bold tracking-widest', side === 'CALLS' ? 'text-gain' : 'text-loss')}>
          {side}
        </h4>
        <span className="font-mono text-[10px] text-muted-foreground">{rows.length} strikes</span>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-right font-mono text-[10px] tracking-wider text-muted-foreground">STRIKE</TableHead>
            <TableHead className="text-right font-mono text-[10px] tracking-wider text-muted-foreground">LAST</TableHead>
            <TableHead className="text-right font-mono text-[10px] tracking-wider text-muted-foreground">CHG%</TableHead>
            <TableHead className="hidden text-right font-mono text-[10px] tracking-wider text-muted-foreground md:table-cell">BID</TableHead>
            <TableHead className="hidden text-right font-mono text-[10px] tracking-wider text-muted-foreground md:table-cell">ASK</TableHead>
            <TableHead className="text-right font-mono text-[10px] tracking-wider text-muted-foreground">VOL</TableHead>
            <TableHead className="text-right font-mono text-[10px] tracking-wider text-muted-foreground">OI</TableHead>
            <TableHead className="text-right font-mono text-[10px] tracking-wider text-muted-foreground">IV</TableHead>
            <TableHead className="hidden text-right font-mono text-[10px] tracking-wider text-muted-foreground xl:table-cell">Δ</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const minDist =
              underlyingPrice !== null
                ? Math.min(...rows.map((r) => Math.abs(r.parsed.strike - underlyingPrice)))
                : Infinity;
            const isATM =
              underlyingPrice !== null &&
              Math.abs(row.parsed.strike - underlyingPrice) <= minDist + 0.001;
            const strikeDecimals = decimalsForPrice(row.parsed.strike);
            return (
              <TableRow
                key={row.option}
                className="group cursor-pointer"
                onClick={() => copy(row.option)}
                title="Click to copy contract symbol"
              >
                <TableCell
                  className={cn(
                    'text-right font-mono text-sm font-bold tabular-nums',
                    isATM ? 'text-signal' : 'text-foreground/80',
                  )}
                >
                  {row.parsed.strike.toFixed(strikeDecimals)}
                </TableCell>
                <TableCell className="text-right font-mono text-sm tabular-nums">
                  {formatPrice(row.last_trade_price)}
                </TableCell>
                <TableCell className={cn('text-right font-mono text-xs tabular-nums', colorForChange(row.percent_change))}>
                  {formatPercent(row.percent_change)}
                </TableCell>
                <TableCell className="hidden text-right font-mono text-xs tabular-nums text-muted-foreground md:table-cell">
                  {formatPrice(row.bid)}
                </TableCell>
                <TableCell className="hidden text-right font-mono text-xs tabular-nums text-muted-foreground md:table-cell">
                  {formatPrice(row.ask)}
                </TableCell>
                <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                  {formatCompact(row.volume)}
                </TableCell>
                <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                  {formatInteger(row.open_interest)}
                </TableCell>
                <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                  {row.iv > 0 ? `${(row.iv * 100).toFixed(1)}%` : '—'}
                </TableCell>
                <TableCell className="hidden text-right font-mono text-xs tabular-nums text-muted-foreground xl:table-cell">
                  {row.delta ? row.delta.toFixed(2) : '—'}
                </TableCell>
              </TableRow>
            );
          })}
          {rows.length === 0 && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={9} className="py-6 text-center text-sm text-muted-foreground">
                No {side.toLowerCase()} listed for this expiry.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <div className="px-3 py-1.5 font-mono text-[10px] text-muted-foreground">
        {symbol} · tap a row to copy the OCC contract
      </div>
    </div>
  );
}

/** Full options chain: expiry picker + side-by-side calls/puts (CBOE delayed). */
export function OptionsChain({ symbol, underlyingPrice, options, isLoading, isError }: OptionsChainProps) {
  const grouped = useMemo(() => groupOptionsByExpiry(options?.options ?? []), [options]);
  const expiries = useMemo(() => [...grouped.keys()].sort((a, b) => a - b), [grouped]);
  const [expiry, setExpiry] = useState<number | null>(null);

  useEffect(() => {
    if (expiry === null || !expiries.includes(expiry)) {
      setExpiry(expiries[0] ?? null);
    }
  }, [expiries, expiry]);

  const bucket = expiry !== null ? grouped.get(expiry) : undefined;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {isLoading && expiries.length === 0
            ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-6 w-16 rounded-full" />)
            : expiries.map((e) => (
                <button
                  key={e}
                  onClick={() => setExpiry(e)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 font-mono text-[11px] font-semibold transition-colors',
                    expiry === e
                      ? 'border-signal bg-signal/15 text-signal'
                      : 'border-border text-muted-foreground hover:text-foreground',
                  )}
                >
                  {formatExpiration(e)}
                </button>
              ))}
        </div>
        <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground">
          CBOE DELAYED
        </Badge>
      </div>

      {isLoading && expiries.length === 0 ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : isError && expiries.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Could not load the options chain for {symbol}. This symbol may not have listed options.
        </p>
      ) : bucket ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <OptionTable rows={bucket.calls} side="CALLS" underlyingPrice={underlyingPrice} symbol={symbol} />
          <OptionTable rows={bucket.puts} side="PUTS" underlyingPrice={underlyingPrice} symbol={symbol} />
        </div>
      ) : (
        <p className="py-6 text-center text-sm text-muted-foreground">No options listed.</p>
      )}
    </div>
  );
}
