import { Link } from 'react-router-dom';

import type { NewsItem } from '@/lib/yahoo';
import { formatRelativeTime } from '@/lib/format';
import { sanitizeUrl } from '@/lib/sanitize';

interface NewsFeedProps {
  items: NewsItem[];
  compact?: boolean;
}

/** List of market-news headlines with publisher, time and related tickers. */
export function NewsFeed({ items, compact = false }: NewsFeedProps) {
  if (items.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-muted-foreground">
        No headlines right now.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {items.map((item) => {
        const href = sanitizeUrl(item.link);
        if (!href) return null;
        return (
          <li key={item.uuid} className="group">
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="block px-3 py-2.5 transition-colors hover:bg-muted/40"
            >
              <p className={`font-medium leading-snug text-foreground group-hover:text-signal ${compact ? 'text-[13px]' : 'text-sm'}`}>
                {item.title}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground/70">{item.publisher}</span>
                <span aria-hidden>·</span>
                <span>{formatRelativeTime(item.providerPublishTime)}</span>
                {item.relatedTickers?.slice(0, 4).map((t) => (
                  <Link
                    key={t}
                    to={`/stock/${t}`}
                    className="rounded-sm bg-muted px-1.5 py-0.5 font-mono font-semibold text-muted-foreground hover:bg-signal/20 hover:text-signal"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {t}
                  </Link>
                ))}
              </div>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
