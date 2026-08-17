import { useMemo, useState } from 'react';
import { useSeoMeta } from '@unhead/react';
import { ArrowLeftRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { convertFx, useFxRate } from '@/hooks/useFx';
import { COMMON_PAIRS, CURRENCIES, formatFxAmount } from '@/lib/fx';

const FX = () => {
  useSeoMeta({
    title: 'FX <GO> Currency Converter — Vault Terminal',
    description: 'Live currency converter for cross-border stocks, powered by Yahoo FX pairs.',
  });

  const [amount, setAmount] = useState('1000');
  const [from, setFrom] = useState('USD');
  const [to, setTo] = useState('CAD');

  // Rates routed through USD so cross pairs work.
  const usdFrom = useFxRate('USD', from);
  const usdTo = useFxRate('USD', to);

  const rate = useMemo(() => {
    if (from === 'USD') return usdTo.data ?? null;
    if (to === 'USD') return usdFrom.data ?? null;
    return usdFrom.data && usdTo.data ? usdTo.data / usdFrom.data : null;
  }, [from, to, usdFrom.data, usdTo.data]);

  const result = useMemo(() => {
    const n = Number(amount);
    return convertFx(n, from, to, usdFrom.data, usdTo.data);
  }, [amount, from, to, usdFrom.data, usdTo.data]);

  const loading = (from !== 'USD' && usdFrom.isPending) || (to !== 'USD' && usdTo.isPending);
  const error = (from !== 'USD' && usdFrom.isError) || (to !== 'USD' && usdTo.isError);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-mono text-xl font-bold tracking-widest">
          FX <span className="text-signal">&lt;GO&gt;</span> · CURRENCY CONVERTER
        </h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Live rates via Yahoo FX · handy when your holdings trade in CAD, EUR, JPY…
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Converter */}
        <section className="rounded-lg border border-border bg-card p-4">
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="fx-amount" className="font-mono text-[10px] tracking-wider text-muted-foreground">AMOUNT</Label>
              <Input
                id="fx-amount"
                type="number"
                min="0"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-10 font-mono"
              />
            </div>
            <div className="pb-1">
              <Button
                size="icon"
                variant="outline"
                className="size-9"
                aria-label="Swap currencies"
                onClick={() => {
                  setFrom(to);
                  setTo(from);
                }}
              >
                <ArrowLeftRight className="size-4" />
              </Button>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fx-from" className="font-mono text-[10px] tracking-wider text-muted-foreground">FROM</Label>
              <Select value={from} onValueChange={setFrom}>
                <SelectTrigger id="fx-from" className="h-10 w-full font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code} className="font-mono text-xs">
                      {c.code} · {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fx-to" className="font-mono text-[10px] tracking-wider text-muted-foreground">TO</Label>
              <Select value={to} onValueChange={setTo}>
                <SelectTrigger id="fx-to" className="h-10 w-full font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code} className="font-mono text-xs">
                      {c.code} · {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4 rounded-md border border-border bg-muted/20 p-3">
            <div className="font-mono text-[10px] font-bold tracking-widest text-muted-foreground">
              {from} → {to} RESULT
            </div>
            {loading ? (
              <Skeleton className="mt-1 h-9 w-40" />
            ) : error ? (
              <p className="mt-1 font-mono text-sm text-loss">Rate unavailable — feed offline?</p>
            ) : result !== null ? (
              <div className="mt-1 font-mono text-3xl font-bold tabular-nums text-foreground">
                {formatFxAmount(result, to)}
              </div>
            ) : (
              <div className="mt-1 font-mono text-sm text-muted-foreground">—</div>
            )}
            <div className="mt-1.5 font-mono text-[11px] text-muted-foreground">
              {rate !== null ? `1 ${from} = ${rate.toFixed(4)} ${to} · live` : ' '}
              {from !== 'USD' && to !== 'USD' ? ' · via USD' : ''}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {[['USD', 'CAD'], ['CAD', 'USD'], ['USD', 'EUR'], ['USD', 'JPY'], ['EUR', 'GBP'], ['USD', 'MXN']].map(([a, b]) => (
              <button
                key={`${a}${b}`}
                onClick={() => {
                  setFrom(a);
                  setTo(b);
                }}
                className="rounded border border-border px-2 py-1 font-mono text-[10px] font-semibold text-muted-foreground transition-colors hover:border-signal/60 hover:text-signal"
              >
                {a}/{b}
              </button>
            ))}
          </div>
        </section>

        {/* Common rates */}
        <section className="rounded-lg border border-border bg-card">
          <header className="border-b border-border bg-muted/30 px-3 py-2 font-mono text-[11px] font-bold tracking-[0.15em]">
            COMMON RATES · USD BASE
          </header>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-mono text-[10px] tracking-wider text-muted-foreground">PAIR</TableHead>
                <TableHead className="font-mono text-[10px] tracking-wider text-muted-foreground">RATE</TableHead>
                <TableHead className="text-right font-mono text-[10px] tracking-wider text-muted-foreground">1 UNIT IN USD</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {COMMON_PAIRS.map((code) => <RateRow key={code} code={code} />)}
            </TableBody>
          </Table>
          <div className="border-t border-border px-3 py-2 font-mono text-[10px] text-muted-foreground">
            Yahoo FX · delayed
          </div>
        </section>
      </div>
    </div>
  );
};

function RateRow({ code }: { code: string }) {
  const rate = useFxRate('USD', code);
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell className="font-mono text-sm font-bold">USD/{code}</TableCell>
      <TableCell className="font-mono text-sm tabular-nums">{rate.data !== null && rate.data !== undefined ? rate.data.toFixed(4) : '—'}</TableCell>
      <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
        {rate.data ? `$${(1 / rate.data).toFixed(4)}` : '—'}
      </TableCell>
    </TableRow>
  );
}

export default FX;
