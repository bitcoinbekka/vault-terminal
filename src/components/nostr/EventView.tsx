import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';
import { Link } from 'react-router-dom';
import { nip19 } from 'nostr-tools';

import { useAuthor } from '@/hooks/useAuthor';
import { formatDateTime } from '@/lib/format';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

interface EventViewProps {
  id?: string;
  kind?: number;
  author?: string;
  identifier?: string;
}

function AuthorLine({ pubkey }: { pubkey: string }) {
  const authorData = useAuthor(pubkey);
  const authorName = authorData.data?.metadata?.name ?? 'Anonymous';
  return (
    <Link to={`/${nip19.npubEncode(pubkey)}`} className="font-semibold text-foreground hover:text-signal">
      {authorName}
    </Link>
  );
}

/** Generic Nostr event view for note / nevent / naddr routes. */
export function EventView({ id, kind, author, identifier }: EventViewProps) {
  const { nostr } = useNostr();

  const query = useQuery({
    queryKey: ['nostr', 'event', id, kind, author, identifier],
    queryFn: async ({ signal }) => {
      if (id) {
        const events = await nostr.query([{ ids: [id], limit: 1 }], { signal });
        return events[0];
      }
      if (kind && author && identifier) {
        // Addressable events must be constrained by author — the d tag alone is not a trust boundary.
        const events = await nostr.query([{ kinds: [kind], authors: [author], '#d': [identifier], limit: 1 }], { signal });
        return events[0];
      }
      return undefined;
    },
    enabled: Boolean(id || (kind && author && identifier)),
  });

  const event: NostrEvent | undefined = query.data;

  if (query.isPending && !query.data) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="mt-3 h-20 w-full" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="rounded-lg border border-dashed border-border px-4 py-12 text-center">
        <p className="text-sm text-muted-foreground">
          Could not find this event on the connected relays.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <article className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground">
            KIND {event.kind}
          </Badge>
          <span className="font-mono text-[11px] text-muted-foreground">{formatDateTime(event.created_at)}</span>
        </div>
        <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
          {event.content || '—'}
        </p>
        <div className="mt-4 border-t border-border pt-3 font-mono text-[11px] text-muted-foreground">
          By <AuthorLine pubkey={event.pubkey} />
        </div>
      </article>
    </div>
  );
}
