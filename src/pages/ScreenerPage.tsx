import { useMemo, useState } from 'react';
import { useSeoMeta } from '@unhead/react';
import { Link } from 'react-router-dom';
import { Filter, SlidersHorizontal } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
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
import { MOVER_UNIVERSE, SECTOR_NAMES, UNIVERSE_LIMIT } from '@/lib/marketUniverse';
import { colorForChange, formatCompact, formatPercent, formatPrice } from '@/lib/format';

import { Panel } from '@/components/terminal/Panel';

interface Row {
  symbol: string;
  name: string;
  price: number | null;
  pct: number | null;
  volume: number | null;
  fromHighPct: number | null;
}

type SortKey = 'pct' | 'volume' | 'fromHigh';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'pct', label: '% CHANGE' },
  { key: 'volume', label: 'VOLUME' },
  { key: 'fromHigh', label: '52W PROXIMITY' },
];

function FilterField({ id, label, value, onChange, placeholder }: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="font-mono text-[10px] tracking-wider text-muted-foreground">{label}</Label>
      <Input
        id={id}
        type="number"
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-8 font-mono text-xs"
      />
    </div>
  );
}

const EQS = () => {
  useSeoMeta({
    title: 'EQS <GO> Equity Screener — Vault Terminal',
    description: 'Screen the terminal\'s liquid universe by change, volume and 52-week proximity.',
  });

  const { watchlist } = useWatchlist();
  const [minChg, setMinChg] = useState('');
  const [maxChg, setMaxChg] = useState('');
  const [minVol, setMinVol] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [highWithin, setHighWithin] = useState(''); // % from 52w high
  const [sort, setSort] = useState<SortKey>('pct');

  const universe = useMemo(() => {
    const merged = [...MOVER_UNIVERSE, ...watchlist];
    return [...new Set(merged)].slice(0, UNIVERSE_LIMIT);
  }, [watchlist]);

  const quotes = useQuotes(universe);

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    quotes.forEach((q, i) => {
      const symbol = universe[i];
      if (!symbol || !q.data?.meta) return;
      const meta = q.data.meta;
      const price = meta.regularMarketPrice;
      const prev = meta.chartPreviousClose ?? meta.previousClose;
      const pct = typeof prev === 'number' && prev > 0 ? ((price - prev) / prev) * 100 : null;
      const fromHighPct =
        typeof meta.fiftyTwoWeekHigh === 'number' && meta.fiftyTwoWeekHigh > 0
          ? (price / meta.fiftyTwoWeekHigh - 1) * 100
          : null;
      out.push({
        symbol,
        name: meta.longName ?? meta.shortName ?? SECTOR_NAMES[symbol] ?? '',
        price,
        pct,
        volume: meta.regularMarketVolume ?? null,
        fromHighPct,
      });
    });
    return out;
  }, [quotes, universe]);

  const filtered = useMemo(() => {
    const num = (s: string) => (s === '' ? null : Number(s));
    const mnChg = num(minChg);
    const mxChg = num(maxChg);
    const mnVol = num(minVol);
    const mnPx = num(minPrice);
    const hi = num(highWithin);

    return rows.filter((r) => {
      if (r.pct === null) return false;
      if (mnChg !== null && r.pct < mnChg) return false;
      if (mxChg !== null && r.pct > mxChg) return false;
      if (mnVol !== null && (r.volume ?? 0) < mnVol) return false;
      if (mnPx !== null && (r.price ?? 0) < mnPx) return false;
      if (hi !== null && (r.fromHighPct === null || r.fromHighPct > hi)) return false;
      return true;
    });
  }, [rows, minChg, maxChg, minVol, minPrice, highWithin]);

  const sorted = useMemo(() => {
    const dir = sort === 'pct' ? -1 : sort === 'volume' ? -1 : 1;
    return [...filtered].sort((a, b) => {
      const va = a[sort];
      const vb = b[sort];
      if (va === null || vb === null) return 0;
      return dir * (va - vb);
    });
  }, [filtered, sort]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-mono text-xl font-bold tracking-widest">
            EQS <span className="text-signal">&lt;GO&gt;</span> · EQUITY SCREENING
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Screening {universe.length} liquid symbols (mega-caps + sector ETFs + your watchlist) · delayed
            quotes · fundamentals like P/E need a paid feed
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {SORTS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSort(s.key)}
              className={`rounded border px-2 py-1 font-mono text-[10px] font-semibold tracking-wider transition-colors ${
                sort === s.key ? 'border-signal bg-signal/15 text-signal' : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <Panel
        title="FILTERS"
        right={<Filter className="size-3.5 text-muted-foreground" />}
      >
        <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 lg:grid-cols-5">
          <FilterField id="f-min-chg" label="MIN % CHANGE" value={minChg} onChange={setMinChg} placeholder="-5" />
          <FilterField id="f-max-chg" label="MAX % CHANGE" value={maxChg} onChange={setMaxChg} placeholder="5" />
          <FilterField id="f-min-vol" label="MIN VOLUME" value={minVol} onChange={setMinVol} placeholder="5000000" />
          <FilterField id="f-min-px" label="MIN PRICE ($)" value={minPrice} onChange={setMinPrice} placeholder="10" />
          <FilterField id="f-high" label="WITHIN X% OF 52W HIGH" value={highWithin} onChange={setHighWithin} placeholder="5" />
        </div>
        <div className="flex items-center justify-between border-t border-border px-3 py-2">
          <span className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
            <SlidersHorizontal className="size-3.5" />
            {filtered.length} / {rows.length} match
          </span>
          {(minChg || maxChg || minVol || minPrice || highWithin) ? (
            <button
              onClick={() => {
                setMinChg('');
                setMaxChg('');
                setMinVol('');
                setMinPrice('');
                setHighWithin('');
              }}
              className="font-mono text-[11px] text-muted-foreground hover:text-foreground"
            >
              CLEAR
            </button>
          ) : null}
        </div>
      </Panel>

      <Panel title={`RESULTS // ${sorted.length}`}>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="font-mono text-[10px] tracking-wider text-muted-foreground">SYMBOL</TableHead>
              <TableHead className="hidden font-mono text-[10px] tracking-wider text-muted-foreground md:table-cell">NAME</TableHead>
              <TableHead className="text-right font-mono text-[10px] tracking-wider text-muted-foreground">LAST</TableHead>
              <TableHead className="text-right font-mono text-[10px] tracking-wider text-muted-foreground">CHG%</TableHead>
              <TableHead className="text-right font-mono text-[10px] tracking-wider text-muted-foreground">VOL</TableHead>
              <TableHead className="text-right font-mono text-[10px] tracking-wider text-muted-foreground">FROM 52W HIGH</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6}>
                  <div className="space-y-2 py-2">
                    {[0, 1, 2].map((i) => (
                      <Skeleton key={i} className="h-7 w-full" />
                    ))}
                  </div>
                </TableCell>
              </TableRow>
            ) : sorted.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  No symbols match the current filters — loosen them.
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((r) => (
                <TableRow key={r.symbol} className="group">
                  <TableCell className="max-w-[150px]">
                    <Link to={`/stock/${r.symbol}`} className="flex flex-col">
                      <span className="font-mono text-sm font-bold group-hover:text-signal">{r.symbol}</span>
                      <span className="truncate text-[11px] text-muted-foreground md:hidden">{r.name}</span>
                    </Link>
                  </TableCell>
                  <TableCell className="hidden max-w-[220px] truncate text-xs text-muted-foreground md:table-cell">{r.name}</TableCell>
                  <TableCell className="text-right font-mono text-sm tabular-nums">{formatPrice(r.price)}</TableCell>
                  <TableCell className={`text-right font-mono text-xs font-semibold tabular-nums ${colorForChange(r.pct ?? 0)}`}>
                    {formatPercent(r.pct)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                    {formatCompact(r.volume)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                    {formatPercent(r.fromHighPct)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Panel>
    </div>
  );
};

export default EQS;
