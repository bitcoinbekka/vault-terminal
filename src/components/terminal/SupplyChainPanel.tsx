import { Link } from 'react-router-dom';
import { Boxes, Newspaper } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';

import { useQuotes } from '@/hooks/useYahoo';
import { useSupplyChain } from '@/hooks/useSupplyChain';
import { formatRelativeTime } from '@/lib/format';
import { sanitizeUrl } from '@/lib/sanitize';

/** Supply-chain / connected-companies panel, sourced from news coverage. */
export function SupplyChainPanel({ symbol }: { symbol: string }) {
  const { data, isPending } = useSupplyChain(symbol);
  const related = useQuotes((data?.related ?? []).map((r) => r.symbol));

  if (isPending && !data) {
    return (
      <section className="rounded-lg border border-border bg-card p-3">
        <div className="space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-16 w-full" />
        </div>
      </section>
    );
  }

  const relatedCount = data?.related.length ?? 0;
  const newsCount = data?.news.length ?? 0;

  return (
    <section className="rounded-lg border border-border bg-card p-3">
      <header className="mb-2 flex items-center gap-2">
        <Boxes className="size-4 text-signal" />
        <h2 className="font-mono text-[11px] font-bold tracking-[0.15em]">
          SUPPLY CHAIN // CONNECTED COMPANIES
        </h2>
      </header>

      {relatedCount > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {data!.related.map((r, i) => {
            const meta = related[i]?.data?.meta;
            const name = meta?.longName ?? meta?.shortName ?? r.symbol;
            return (
              <Link
                key={r.symbol}
                to={`/stock/${r.symbol}`}
                title={`${name} · mentioned ${r.mentions}× in coverage`}
                className="group flex items-center gap-1.5 rounded-md border border-border bg-muted/20 px-2 py-1 transition-colors hover:border-signal/60"
              >
                <span className="font-mono text-xs font-bold group-hover:text-signal">{r.symbol}</span>
                <span className="max-w-[160px] truncate text-[11px] text-muted-foreground">{name}</span>
                {r.mentions > 1 ? (
                  <span className="rounded-sm bg-signal/15 px-1 font-mono text-[9px] font-bold text-signal">{r.mentions}×</span>
                ) : null}
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          No connected companies surfaced from recent coverage. Try the NEWS tab for the latest mentions.
        </p>
      )}

      {newsCount > 0 ? (
        <div className="mt-3 border-t border-border pt-2">
          <div className="mb-1 flex items-center gap-1.5 font-mono text-[10px] font-bold tracking-widest text-muted-foreground">
            <Newspaper className="size-3" /> SUPPLY-CHAIN COVERAGE
          </div>
          <ul className="divide-y divide-border">
            {data!.news.slice(0, 6).map((item) => {
              const href = sanitizeUrl(item.link);
              if (!href) return null;
              return (
                <li key={item.uuid} className="group">
                  <a href={href} target="_blank" rel="noreferrer" className="block py-1.5 transition-colors hover:bg-muted/40">
                    <p className="text-[13px] leading-snug font-medium text-foreground group-hover:text-signal">{item.title}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                      {item.publisher} · {formatRelativeTime(item.providerPublishTime)}
                    </p>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
        Relationships surfaced from news headlines — not an exhaustive database. Always verify before trading.
      </p>
    </section>
  );
}
