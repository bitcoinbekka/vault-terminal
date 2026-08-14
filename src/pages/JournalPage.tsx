import { useState, type ReactNode } from 'react';
import { useSeoMeta } from '@unhead/react';
import { BookOpenText, Loader2, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { LoginArea } from '@/components/auth/LoginArea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { useTrades } from '@/hooks/useTrades';
import { useToast } from '@/hooks/useToast';
import { formatHoldTime } from '@/lib/journal';
import { colorForChange, formatDate, formatPrice, formatSigned } from '@/lib/format';
import { cn } from '@/lib/utils';

import { Panel } from '@/components/terminal/Panel';
import { AddTradeDialog } from '@/components/terminal/AddTradeDialog';

function Stat({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="font-mono text-[10px] font-bold tracking-widest text-muted-foreground">{label}</div>
      <div className={cn('mt-1 font-mono text-xl font-bold tabular-nums', className)}>{value}</div>
    </div>
  );
}

const JournalPage = () => {
  useSeoMeta({
    title: 'Trade Journal — Vault Terminal',
    description: 'Log your trades on Nostr and track realized P/L, win rate and hold time.',
  });

  const { trades, stats, save, user } = useTrades();
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const sorted = [...trades].sort((a, b) => b.date - a.date);

  const remove = async (id: string) => {
    setRemoving(id);
    try {
      await save(trades.filter((t) => t.id !== id));
      toast({ title: 'Trade removed' });
    } catch {
      toast({ title: 'Failed to remove trade', variant: 'destructive' });
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-mono text-xl font-bold tracking-widest">TRADE JOURNAL</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            FIFO cost basis · realized P/L, win rate & hold time computed from your logged trades — stored
            on Nostr kind 30078.
          </p>
        </div>
        {user ? (
          <Button size="sm" className="gap-1 font-mono text-xs" onClick={() => setAddOpen(true)}>
            <Plus className="size-4" /> LOG TRADE
          </Button>
        ) : null}
      </div>

      {!user ? (
        <Panel title="JOURNAL" right={<BookOpenText className="size-3.5 text-muted-foreground" />}>
          <div className="flex flex-col items-start gap-3 px-4 py-10">
            <p className="text-sm text-muted-foreground">
              Log every buy and sell to see your real edge: realized P/L, win rate, average hold time and
              open lots. All synced to your Nostr identity.
            </p>
            <LoginArea className="w-full sm:w-auto" />
          </div>
        </Panel>
      ) : trades.length === 0 ? (
        <Panel title="JOURNAL">
          <div className="px-4 py-10 text-center">
            <p className="mb-3 text-sm text-muted-foreground">No trades logged yet.</p>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="mr-1 size-4" /> Log your first trade
            </Button>
          </div>
        </Panel>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat
              label="NET REALIZED P/L"
              value={formatSigned(stats.netRealizedPnl)}
              className={colorForChange(stats.netRealizedPnl)}
            />
            <Stat label="WIN RATE" value={stats.winRate !== null ? `${stats.winRate.toFixed(0)}%` : '—'} />
            <Stat label="AVG HOLD" value={stats.avgHoldDays !== null ? formatHoldTime(stats.avgHoldDays) : '—'} />
            <Stat label="CLOSED TRADES" value={stats.closedCount} />
            <Stat label="OPEN LOTS" value={stats.openLots.size} />
            <Stat label="FEES PAID" value={formatSigned(-stats.fees)} />
          </div>

          {stats.openLots.size > 0 ? (
            <Panel title={`OPEN LOTS // ${stats.openLots.size} SYMBOLS`}>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-mono text-[10px] tracking-wider text-muted-foreground">SYMBOL</TableHead>
                    <TableHead className="text-right font-mono text-[10px] tracking-wider text-muted-foreground">SHARES HELD</TableHead>
                    <TableHead className="text-right font-mono text-[10px] tracking-wider text-muted-foreground">REALIZED P/L</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...stats.openLots.entries()].map(([symbol, qty]) => (
                    <TableRow key={symbol} className="hover:bg-transparent">
                      <TableCell className="font-mono text-sm font-bold">{symbol}</TableCell>
                      <TableCell className="text-right font-mono text-sm tabular-nums">{qty}</TableCell>
                      <TableCell className={cn('text-right font-mono text-sm tabular-nums', colorForChange(stats.realizedPerSymbol.get(symbol) ?? 0))}>
                        {formatSigned(stats.realizedPerSymbol.get(symbol) ?? 0)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Panel>
          ) : null}

          <Panel title={`TRADES // ${trades.length}`}>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-mono text-[10px] tracking-wider text-muted-foreground">DATE</TableHead>
                  <TableHead className="font-mono text-[10px] tracking-wider text-muted-foreground">SYMBOL</TableHead>
                  <TableHead className="text-right font-mono text-[10px] tracking-wider text-muted-foreground">SIDE</TableHead>
                  <TableHead className="text-right font-mono text-[10px] tracking-wider text-muted-foreground">QTY</TableHead>
                  <TableHead className="text-right font-mono text-[10px] tracking-wider text-muted-foreground">PRICE</TableHead>
                  <TableHead className="text-right font-mono text-[10px] tracking-wider text-muted-foreground">FEES</TableHead>
                  <TableHead className="hidden font-mono text-[10px] tracking-wider text-muted-foreground lg:table-cell">NOTE</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((t) => (
                  <TableRow key={t.id} className="group">
                    <TableCell className="font-mono text-xs text-muted-foreground">{formatDate(t.date)}</TableCell>
                    <TableCell className="font-mono text-sm font-bold">{t.symbol}</TableCell>
                    <TableCell className="text-right">
                      <span className={cn('font-mono text-xs font-bold', t.side === 'buy' ? 'text-gain' : 'text-loss')}>
                        {t.side.toUpperCase()}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums">{t.quantity}</TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums">{formatPrice(t.price)}</TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                      {t.fees ? formatPrice(t.fees) : '—'}
                    </TableCell>
                    <TableCell className="hidden max-w-[260px] truncate text-xs text-muted-foreground lg:table-cell">
                      {t.note ?? '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 text-muted-foreground opacity-0 transition-opacity hover:text-loss group-hover:opacity-100"
                        aria-label="Delete trade"
                        onClick={() => remove(t.id)}
                        disabled={removing === t.id}
                      >
                        {removing === t.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
              FIFO cost basis · sells match oldest lots first · option contracts treated as 1× (journal tracks contracts, not ×100)
            </div>
          </Panel>
        </>
      )}

      <AddTradeDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
};

export default JournalPage;
