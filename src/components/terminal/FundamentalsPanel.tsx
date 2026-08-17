import { useMemo, useState } from 'react';
import { FileText, Loader2, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import { useFundamentals } from '@/hooks/useFundamentals';
import { useAnalysis, useRequestAnalysis } from '@/hooks/useAnalysis';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';

/** Compact SVG bar chart (one series), terminal styling. */
function BarsChart({ data, color }: { data: { label: string; value: number }[]; color: string }) {
  const width = 220;
  const height = 76;
  const pad = 4;

  const { min, max } = useMemo(() => {
    const vals = data.map((d) => d.value);
    const mx = Math.max(...vals, 0);
    const mn = Math.min(...vals, 0);
    return { min: mn, max: mx };
  }, [data]);

  const range = max - min || 1;
  const X = (i: number) => pad + (i * (width - pad * 2)) / data.length + (width - pad * 2) / data.length / 2;
  const Y = (v: number) => height - 10 - ((v - min) / range) * (height - 18);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="w-full" aria-hidden>
      {/* zero line */}
      <line x1={pad} x2={width - pad} y1={Y(0)} y2={Y(0)} stroke="currentColor" strokeOpacity={0.25} strokeDasharray="2 3" />
      {data.map((d, i) => (
        <g key={`${d.label}-${i}`}>
          <rect
            x={X(i) - (width - pad * 2) / data.length / 3}
            y={Math.min(Y(d.value), Y(0))}
            width={(width - pad * 2) / data.length / 1.5}
            height={Math.max(1, Math.abs(Y(d.value) - Y(0)))}
            fill={color}
            opacity={0.85}
            rx={1}
          />
          <text x={X(i)} y={height - 2} fontSize={8} textAnchor="middle" fill="currentColor" opacity={0.55} fontFamily="var(--font-mono)">
            {d.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

function fmtBig(v: number | null): string {
  if (v === null || v === undefined) return '—';
  const abs = Math.abs(v);
  if (abs >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  return `$${v.toLocaleString('en-US')}`;
}

/** SEC EDGAR fundamentals: revenue/income/EPS/margins charts + key stats. */
export function FundamentalsPanel({ symbol }: { symbol: string }) {
  const { data: report, isPending } = useFundamentals(symbol);

  if (isPending && !report) {
    return (
      <section className="rounded-lg border border-border bg-card p-3">
        <div className="space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-20 w-full" />
        </div>
      </section>
    );
  }

  if (!report || report.years.length === 0) {
    return (
      <section className="rounded-lg border border-border bg-card p-4">
        <header className="mb-2 flex items-center gap-2">
          <FileText className="size-4 text-signal" />
          <h2 className="font-mono text-[11px] font-bold tracking-[0.15em]">FUNDAMENTALS // SEC FILINGS</h2>
        </header>
        <p className="text-sm text-muted-foreground">
          No SEC fundamentals recorded yet. Run{' '}
          <span className="font-mono text-xs">node server/sec-fundamentals.mjs</span> on your VPS (cron:
          daily) to pull US filings from EDGAR automatically. Canadian (SEDAR) and other listings come via
          manual filing upload in Phase 2.
        </p>
        <div className="mt-3">
          <AnalysisSection symbol={symbol} />
        </div>
      </section>
    );
  }

  const years = report.years;
  const latest = years[years.length - 1];
  const revData = years.map((y) => ({ label: String(y.year).slice(2), value: y.revenue ?? 0 })).filter((d) => d.value !== 0);
  const niData = years.map((y) => ({ label: String(y.year).slice(2), value: y.netIncome ?? 0 })).filter((d) => d.value !== 0);

  const grossMargin = latest.grossProfit !== null && latest.revenue ? (latest.grossProfit / latest.revenue) * 100 : null;
  const opMargin = latest.operatingIncome !== null && latest.revenue ? (latest.operatingIncome / latest.revenue) * 100 : null;
  const netMargin = latest.netIncome !== null && latest.revenue ? (latest.netIncome / latest.revenue) * 100 : null;

  return (
    <section className="rounded-lg border border-border bg-card p-3">
      <header className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-mono text-[11px] font-bold tracking-[0.15em]">
          <FileText className="size-4 text-signal" />
          FUNDAMENTALS // SEC FILINGS
        </h2>
        <span className="font-mono text-[10px] text-muted-foreground">
          {report.name ?? report.symbol} · CIK {report.cik} · {new Date(report.updatedAt * 1000).toLocaleDateString()}
        </span>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-border bg-muted/20 p-2.5">
          <div className="mb-1 font-mono text-[10px] font-bold tracking-widest text-muted-foreground">REVENUE (FY)</div>
          {revData.length >= 2 ? <BarsChart data={revData} color="var(--signal)" /> : <p className="text-xs text-muted-foreground">—</p>}
        </div>
        <div className="rounded-md border border-border bg-muted/20 p-2.5">
          <div className="mb-1 font-mono text-[10px] font-bold tracking-widest text-muted-foreground">NET INCOME (FY)</div>
          {niData.length >= 2 ? <BarsChart data={niData} color="var(--gain)" /> : <p className="text-xs text-muted-foreground">—</p>}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-md border border-border p-2.5 sm:grid-cols-4">
        {[
          ['REVENUE (FY' + latest.year + ')', fmtBig(latest.revenue)],
          ['NET INCOME', fmtBig(latest.netIncome)],
          ['EPS', latest.eps !== null ? `$${latest.eps.toFixed(2)}` : '—'],
          ['ASSETS', fmtBig(latest.totalAssets)],
          ['LIABILITIES', fmtBig(latest.totalLiabilities)],
          ['GROSS MARGIN', grossMargin !== null ? `${grossMargin.toFixed(1)}%` : '—'],
          ['OPERATING MARGIN', opMargin !== null ? `${opMargin.toFixed(1)}%` : '—'],
          ['NET MARGIN', netMargin !== null ? `${netMargin.toFixed(1)}%` : '—'],
        ].map(([label, value]) => (
          <div key={label as string}>
            <div className="font-mono text-[9px] font-bold tracking-widest text-muted-foreground">{label}</div>
            <div className={cn('font-mono text-sm font-bold tabular-nums', typeof value === 'string' && value.includes('−') ? 'text-loss' : '')}>
              {value}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3">
        <AnalysisSection symbol={symbol} />
      </div>

      <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
        Annual 10-K figures from SEC EDGAR (XBRL company facts) · fiscal years, not calendar ·
        Canadian &amp; international filings via manual upload (Phase 2).
      </p>
    </section>
  );
}

/** AI filing analysis: requests the VPS analyzer, renders the encrypted report. */
function AnalysisSection({ symbol }: { symbol: string }) {
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const request = useRequestAnalysis();
  const [requested, setRequested] = useState(false);
  const [sending, setSending] = useState(false);
  const { data: report } = useAnalysis(symbol, requested ? 20_000 : undefined);

  if (!user) return null;

  const run = async () => {
    setSending(true);
    try {
      await request(symbol);
      setRequested(true);
      toast({ title: 'Analysis requested', description: 'The VPS analyzer will run the AI and post an encrypted report here.' });
    } catch {
      toast({ title: 'Could not request analysis', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const verdictUpper = report?.verdict?.toUpperCase() ?? '';
  const verdictClass = verdictUpper.startsWith('BUY') ? 'text-gain' : verdictUpper.startsWith('SELL') ? 'text-loss' : 'text-signal';
  const verdictBg = verdictUpper.startsWith('BUY') ? 'bg-gain/15' : verdictUpper.startsWith('SELL') ? 'bg-loss/15' : 'bg-signal/15';

  return (
    <section className="rounded-md border border-border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 font-mono text-[10px] font-bold tracking-widest text-muted-foreground">
          <Sparkles className="size-3.5 text-signal" /> AI FILING ANALYSIS
        </h3>
        {report ? (
          <span className="font-mono text-[10px] text-muted-foreground">
            {report.model} · {new Date(report.updatedAt * 1000).toLocaleString()}
          </span>
        ) : (
          <Button size="sm" variant="outline" className="h-7 gap-1 font-mono text-[10px]" onClick={run} disabled={sending || requested}>
            {sending || requested ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
            {sending ? 'REQUESTING…' : requested ? 'RUNNING…' : 'RUN AI ANALYSIS'}
          </Button>
        )}
      </div>

      {report ? (
        <div className="mt-2 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('rounded-md px-2 py-0.5 font-mono text-sm font-bold', verdictClass, verdictBg)}>
              {report.verdict ?? '—'}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">AI opinion — verify before trading</span>
          </div>
          {report.summary ? <p className="text-sm leading-relaxed text-foreground/90">{report.summary}</p> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            {report.strengths?.length ? (
              <div>
                <div className="mb-1 font-mono text-[10px] font-bold tracking-widest text-gain">STRENGTHS</div>
                <ul className="space-y-1">
                  {report.strengths.map((s, i) => (
                    <li key={i} className="text-xs text-foreground/85">• {s}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {report.risks?.length ? (
              <div>
                <div className="mb-1 font-mono text-[10px] font-bold tracking-widest text-loss">RISKS</div>
                <ul className="space-y-1">
                  {report.risks.map((s, i) => (
                    <li key={i} className="text-xs text-foreground/85">• {s}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
          {report.insights?.length ? (
            <div>
              <div className="mb-1 font-mono text-[10px] font-bold tracking-widest text-signal">WHAT TO WATCH</div>
              <ul className="space-y-1">
                {report.insights.map((s, i) => (
                  <li key={i} className="text-xs text-foreground/85">→ {s}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {!requested ? (
            <Button size="sm" variant="outline" className="h-7 font-mono text-[10px]" onClick={run}>
              <Sparkles className="mr-1 size-3" /> RE-RUN
            </Button>
          ) : null}
        </div>
      ) : requested ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Waiting for the VPS analyzer (server/analyzer.mjs)… it pulls SEC data, runs the LLM, and posts an
          encrypted report here. This can take a minute.
        </p>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          Have the VPS AI summarize this company's SEC filings — plain-English summary, strengths, risks and a
          verdict. Requires the analyzer service with a DeepSeek key or local Ollama.
        </p>
      )}
    </section>
  );
}
