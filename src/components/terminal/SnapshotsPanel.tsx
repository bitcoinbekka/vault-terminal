import { Database } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useSnapshots } from '@/hooks/useSnapshots';
import { colorForChange, formatCompact, formatDateTime, formatPercent, formatPrice } from '@/lib/format';

/** Hourly snapshot history for a symbol, stored on Nostr by the VPS pusher. */
export function SnapshotsPanel({ symbol }: { symbol: string }) {
  const { user } = useCurrentUser();
  const { data: snaps, isPending } = useSnapshots(symbol);

  if (!user) return null;

  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="flex items-center justify-between border-b border-border bg-muted/30 px-3 py-2">
        <h2 className="font-mono text-[11px] font-bold tracking-[0.15em]">
          HOURLY SNAPSHOTS // NOSTR HISTORY
        </h2>
        <Database className="size-3.5 text-muted-foreground" />
      </header>

      {isPending && !snaps ? (
        <div className="space-y-2 p-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-7 w-full" />
          ))}
        </div>
      ) : snaps && snaps.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="font-mono text-[10px] tracking-wider text-muted-foreground">TIME (ET)</TableHead>
              <TableHead className="text-right font-mono text-[10px] tracking-wider text-muted-foreground">PRICE</TableHead>
              <TableHead className="text-right font-mono text-[10px] tracking-wider text-muted-foreground">CHG%</TableHead>
              <TableHead className="hidden text-right font-mono text-[10px] tracking-wider text-muted-foreground sm:table-cell">VOL</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {snaps.map((s) => (
              <TableRow key={s.d} className="hover:bg-transparent">
                <TableCell className="font-mono text-xs text-muted-foreground">{formatDateTime(s.ts)}</TableCell>
                <TableCell className="text-right font-mono text-sm tabular-nums">{formatPrice(s.price)}</TableCell>
                <TableCell className={`text-right font-mono text-xs font-semibold tabular-nums ${colorForChange(s.changePct ?? 0)}`}>
                  {formatPercent(s.changePct)}
                </TableCell>
                <TableCell className="hidden text-right font-mono text-xs tabular-nums text-muted-foreground sm:table-cell">
                  {formatCompact(s.volume)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">
          No snapshots recorded yet. Run{' '}
          <span className="font-mono text-xs">node server/market-snapshot.mjs</span> on your VPS (cron:
          hourly) to start building your private Nostr price history here.
        </p>
      )}

      <div className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
        Encrypted to your npub · written by server/market-snapshot.mjs · one event per hour
      </div>
    </section>
  );
}
