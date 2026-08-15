import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSeoMeta } from '@unhead/react';
import { Calculator } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { colorForChange, formatSigned } from '@/lib/format';

const SIZER = () => {
  useSeoMeta({
    title: 'SIZER <GO> Position Sizing — Vault Terminal',
    description: 'Risk-based position sizing calculator: account size, risk %, entry and stop.',
  });

  const [searchParams] = useSearchParams();
  const [account, setAccount] = useState('100000');
  const [riskPct, setRiskPct] = useState('1');
  const [entry, setEntry] = useState(searchParams.get('entry') ?? '');
  const [stop, setStop] = useState('');

  const result = useMemo(() => {
    const acc = Number(account);
    const rp = Number(riskPct);
    const en = Number(entry);
    const st = Number(stop);
    if (!acc || acc <= 0 || !en || en <= 0 || !st || st <= 0 || en === st) return null;

    const riskPerTrade = acc * (rp / 100);
    const riskPerShare = Math.abs(en - st);
    const shares = Math.floor(riskPerTrade / riskPerShare);
    const positionValue = shares * en;
    const pctOfAccount = (positionValue / acc) * 100;
    return { riskPerTrade, riskPerShare, shares, positionValue, pctOfAccount };
  }, [account, riskPct, entry, stop]);

  const symbol = (searchParams.get('symbol') ?? '').toUpperCase();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-mono text-xl font-bold tracking-widest">
          SIZER <span className="text-signal">&lt;GO&gt;</span> · POSITION SIZING
        </h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Risk a fixed % of your account per trade — position size follows the stop, not your hopes.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-card p-4">
          <header className="mb-3 flex items-center gap-2">
            <Calculator className="size-4 text-signal" />
            <h2 className="font-mono text-xs font-bold tracking-widest">INPUTS</h2>
          </header>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sz-account" className="font-mono text-[10px] tracking-wider text-muted-foreground">ACCOUNT SIZE ($)</Label>
              <Input id="sz-account" type="number" min="0" step="any" value={account} onChange={(e) => setAccount(e.target.value)} className="h-9 font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sz-risk" className="font-mono text-[10px] tracking-wider text-muted-foreground">RISK PER TRADE (%)</Label>
              <Input id="sz-risk" type="number" min="0" step="any" value={riskPct} onChange={(e) => setRiskPct(e.target.value)} className="h-9 font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sz-entry" className="font-mono text-[10px] tracking-wider text-muted-foreground">ENTRY ($){symbol ? ` · ${symbol}` : ''}</Label>
              <Input id="sz-entry" type="number" min="0" step="any" value={entry} onChange={(e) => setEntry(e.target.value)} placeholder="300.00" className="h-9 font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sz-stop" className="font-mono text-[10px] tracking-wider text-muted-foreground">STOP LOSS ($)</Label>
              <Input id="sz-stop" type="number" min="0" step="any" value={stop} onChange={(e) => setStop(e.target.value)} placeholder="295.00" className="h-9 font-mono" />
            </div>
          </div>
          {result === null && entry && stop && Number(entry) === Number(stop) ? (
            <p className="mt-3 text-xs text-loss">Entry and stop can't be equal.</p>
          ) : null}
        </section>

        <section className="rounded-lg border border-border bg-card p-4">
          <header className="mb-3 flex items-center justify-between">
            <h2 className="font-mono text-xs font-bold tracking-widest">RESULT</h2>
            {symbol ? <span className="font-mono text-xs font-bold text-signal">{symbol}</span> : null}
          </header>

          {result === null ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Enter account size, entry and stop to size the position.
            </p>
          ) : result.shares <= 0 ? (
            <p className="py-6 text-center text-sm text-loss">
              Stop is too tight for this risk — the calculator can't size 0 shares.
              Widen the stop or increase risk %.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md border border-border bg-muted/20 p-3">
                  <div className="font-mono text-[10px] font-bold tracking-widest text-muted-foreground">RISK PER TRADE</div>
                  <div className="font-mono text-xl font-bold tabular-nums text-loss">{formatSigned(result.riskPerTrade)}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">≈ ${result.riskPerShare.toFixed(2)}/share</div>
                </div>
                <div className="rounded-md border border-border bg-muted/20 p-3">
                  <div className="font-mono text-[10px] font-bold tracking-widest text-muted-foreground">SHARES</div>
                  <div className="font-mono text-xl font-bold tabular-nums">{result.shares}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">floored</div>
                </div>
                <div className="rounded-md border border-border bg-muted/20 p-3">
                  <div className="font-mono text-[10px] font-bold tracking-widest text-muted-foreground">POSITION VALUE</div>
                  <div className="font-mono text-xl font-bold tabular-nums">{formatSigned(result.positionValue)}</div>
                </div>
                <div className="rounded-md border border-border bg-muted/20 p-3">
                  <div className="font-mono text-[10px] font-bold tracking-widest text-muted-foreground">% OF ACCOUNT</div>
                  <div className={cn('font-mono text-xl font-bold tabular-nums', colorForChange(result.pctOfAccount > 20 ? -1 : 1))}>
                    {result.pctOfAccount.toFixed(1)}%
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground">≥20% = heavy</div>
                </div>
              </div>

              <div>
                <div className="mb-1 flex justify-between font-mono text-[10px] text-muted-foreground">
                  <span>Risk {result.riskPerTrade.toFixed(0)}$</span>
                  <span>Position {result.positionValue.toFixed(0)}$</span>
                </div>
                <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="bg-loss"
                    style={{ width: `${Math.min(100, (result.riskPerTrade / result.positionValue) * 100)}%` }}
                  />
                  <div className="bg-signal" style={{ width: `${Math.max(0, 100 - Math.min(100, (result.riskPerTrade / result.positionValue) * 100))}%` }} />
                </div>
              </div>

              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Max loss if stopped: <span className="font-mono text-loss">{formatSigned(result.riskPerTrade)}</span>{' '}
                (shares × |entry − stop|). Round down, and size down when the setup is less than A+.
              </p>
            </div>
          )}
        </section>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Shares only — for option contracts, risk per contract is the premium paid; sizing is
        per-contract ×100 exposure. This is a discipline tool, not financial advice.
      </p>
    </div>
  );
};

export default SIZER;
