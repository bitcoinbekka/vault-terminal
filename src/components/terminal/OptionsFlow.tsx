import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Radar, ScanSearch } from 'lucide-react';
import type { UseQueryResult } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { useCboeChains } from '@/hooks/useYahoo';
import { useWatchlist } from '@/hooks/useWatchlist';
import { parseOCC, STARTER_WATCHLIST, type OptionsData } from '@/lib/yahoo';
import { colorForChange, formatExpiration, formatInteger, formatPercent, formatPrice } from '@/lib/format';

import { Panel } from './Panel';

interface FlowRow {
  symbol: string;
  expiry: number;
  strike: number;
  type: 'C' | 'P';
  last: number;
  changePct: number;
  volume: number;
  oi: number;
  ratio: number;
  iv: number;
}

const MIN_VOLUME = 10;
const MIN_RATIO = 2;

function computeUnusual(chains: UseQueryResult<OptionsData, Error>[], symbols: string[]): FlowRow[] {
  const rows: FlowRow[] = [];
  chains.forEach((chain, i) => {
    const symbol = symbols[i];
    if (!symbol || !chain.data) return;
    for (const opt of chain.data.options) {
      if (opt.volume < MIN_VOLUME || opt.open_interest < 1) continue;
      const ratio = opt.volume / opt.open_interest;
      if (ratio < MIN_RATIO) continue;
      const parsed = parseOCC(opt.option);
      if (!parsed) continue;
      rows.push({
        symbol,
        expiry: parsed.date,
        strike: parsed.strike,
        type: parsed.type,
        last: opt.last_trade_price,
        changePct: opt.percent_change,
        volume: opt.volume,
        oi: opt.open_interest,
        ratio,
        iv: opt.iv,
      });
    }
  });
  return rows.sort((a, b) => b.ratio - a.ratio).slice(0, 15);
}

/** Unusual options activity across the user's watchlist (volume vs open interest). */
export function OptionsFlow() {
  const { watchlist, user } = useWatchlist();
  const symbols = user ? watchlist : STARTER_WATCHLIST;
  const [scan, setScan] = useState(false);

  const chains = useCboeChains(symbols, scan);
  const scanning = scan && chains.some((c) => c.isPending);
  const results = useMemo(() => computeUnusual(chains, symbols), [chains, symbols]);

  return (
    <Panel
      title="OPTIONS FLOW // UNUSUAL ACTIVITY"
      id="options-flow"
      right={
        user ? (
          <Button size="sm" variant="outline" className="h-7 gap-1 px-2 font-mono text-[11px]" onClick={() => setScan(true)}>
            <ScanSearch className="size-3.5" /> {scan ? 'RE-SCAN' : 'SCAN'}
          </Button>
        ) : (
          <Radar className="size-3.5 text-muted-foreground" />
        )
      }
    >
      {!user ? (
        <div className="px-4 py-6 text-center text-sm text-muted-foreground">
          Log in with Nostr to scan <span className="font-semibold text-foreground">your</span> watchlist for
          unusual options activity.
        </div>
      ) : symbols.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-muted-foreground">
          Add symbols to your watchlist first, then scan for unusual options flow.
        </div>
      ) : !scan ? (
        <div className="px-4 py-8 text-center">
          <Radar className="mx-auto mb-3 size-6 text-muted-foreground" />
          <p className="mx-auto mb-3 max-w-xs text-sm text-muted-foreground">
            Volume vs open interest &ge; {MIN_RATIO}× across {symbols.length} watchlist chains. A high ratio can
            mean institutions are printing size.
          </p>
          <Button size="sm" onClick={() => setScan(true)} className="gap-1 font-mono text-xs">
            <ScanSearch className="size-4" /> SCAN WATCHLIST
          </Button>
        </div>
      ) : scanning ? (
        <div className="space-y-2 p-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
          <p className="pt-1 text-center font-mono text-[11px] text-muted-foreground">
            Scanning {symbols.length} chains (delayed)…
          </p>
        </div>
      ) : results.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          No unusual activity in your watchlist right now. Try re-scanning later or add more symbols.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="font-mono text-[10px] tracking-wider text-muted-foreground">SYMBOL</TableHead>
              <TableHead className="font-mono text-[10px] tracking-wider text-muted-foreground">EXPIRY</TableHead>
              <TableHead className="text-right font-mono text-[10px] tracking-wider text-muted-foreground">STRIKE</TableHead>
              <TableHead className="text-right font-mono text-[10px] tracking-wider text-muted-foreground">VOL/OI</TableHead>
              <TableHead className="text-right font-mono text-[10px] tracking-wider text-muted-foreground">VOL</TableHead>
              <TableHead className="text-right font-mono text-[10px] tracking-wider text-muted-foreground">OI</TableHead>
              <TableHead className="hidden text-right font-mono text-[10px] tracking-wider text-muted-foreground sm:table-cell">IV</TableHead>
              <TableHead className="hidden text-right font-mono text-[10px] tracking-wider text-muted-foreground lg:table-cell">LAST</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((r) => (
              <TableRow key={`${r.symbol}-${r.expiry}-${r.strike}-${r.type}`} className="group cursor-pointer">
                <TableCell>
                  <Link to={`/stock/${r.symbol}`} className="font-mono text-sm font-bold group-hover:text-signal">
                    {r.symbol}{' '}
                    <span className={r.type === 'C' ? 'text-gain' : 'text-loss'}>{r.type}</span>
                  </Link>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{formatExpiration(r.expiry)}</TableCell>
                <TableCell className="text-right font-mono text-sm tabular-nums">{formatPrice(r.strike)}</TableCell>
                <TableCell className="text-right">
                  <span className="font-mono text-sm font-bold tabular-nums text-signal">{r.ratio.toFixed(1)}×</span>
                </TableCell>
                <TableCell className="text-right font-mono text-xs tabular-nums">{formatInteger(r.volume)}</TableCell>
                <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">{formatInteger(r.oi)}</TableCell>
                <TableCell className="hidden text-right sm:table-cell">
                  {r.iv > 0 ? (
                    <span className="flex items-center justify-end gap-1">
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">{(r.iv * 100).toFixed(0)}%</span>
                      {r.iv >= 0.6 ? (
                        <Badge variant="outline" className="font-mono text-[9px] font-bold text-loss">RICH</Badge>
                      ) : r.iv <= 0.25 ? (
                        <Badge variant="outline" className="font-mono text-[9px] font-bold text-gain">CHEAP</Badge>
                      ) : null}
                    </span>
                  ) : (
                    '—'
                  )}
                </TableCell>
                <TableCell className="hidden text-right lg:table-cell">
                  <span className={`font-mono text-xs tabular-nums ${colorForChange(r.changePct)}`}>
                    {formatPrice(r.last)} {formatPercent(r.changePct)}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <div className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
        {user
          ? `${symbols.length} chains · vol/OI ≥ ${MIN_RATIO}×, vol ≥ ${MIN_VOLUME} · RICH IV ≥ 60%, CHEAP ≤ 25% · CBOE delayed`
          : 'Scan requires login'}
      </div>
    </Panel>
  );
}
