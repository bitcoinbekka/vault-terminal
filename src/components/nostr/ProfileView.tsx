import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';
import { nip19 } from 'nostr-tools';

import { useAuthor } from '@/hooks/useAuthor';
import { sanitizeImageUrl } from '@/lib/sanitize';
import { formatRelativeTime } from '@/lib/format';
import { Skeleton } from '@/components/ui/skeleton';

function useProfileNotes(pubkey: string) {
  const { nostr } = useNostr();
  return useQuery({
    queryKey: ['nostr', 'notes', pubkey],
    queryFn: async ({ signal }) => nostr.query([{ kinds: [1], authors: [pubkey], limit: 15 }], { signal }),
    enabled: Boolean(pubkey),
  });
}

function NoteRow({ event }: { event: NostrEvent }) {
  return (
    <li className="px-4 py-3">
      <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">{event.content || '—'}</p>
      <div className="mt-1.5 font-mono text-[11px] text-muted-foreground">
        {formatRelativeTime(event.created_at)}
      </div>
    </li>
  );
}

/** Profile view for npub / nprofile routes: metadata header + recent notes. */
export function ProfileView({ pubkey }: { pubkey: string }) {
  const author = useAuthor(pubkey);
  const notes = useProfileNotes(pubkey);

  const metadata = author.data?.metadata;
  const picture = sanitizeImageUrl(metadata?.picture);
  const banner = sanitizeImageUrl(metadata?.banner);
  const npub = nip19.npubEncode(pubkey);
  const name = metadata?.name ?? metadata?.display_name ?? 'Anonymous';

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-lg border border-border bg-card">
        {banner ? (
          <div className="h-24 w-full bg-cover bg-center sm:h-32" style={{ backgroundImage: `url(${banner})` }} />
        ) : (
          <div className="h-24 w-full bg-muted sm:h-32" />
        )}
        <div className="px-4 pb-4">
          <div className="mb-3 flex items-end justify-between">
            <img
              src={picture}
              alt=""
              className="size-20 rounded-full border-4 border-card bg-muted object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <a
              href={`https://njump.me/${npub}`}
              target="_blank"
              rel="noreferrer"
              className="rounded border border-border px-2 py-1 font-mono text-[11px] text-muted-foreground hover:text-foreground"
            >
              VIEW IN CLIENT ↗
            </a>
          </div>
          <h1 className="font-mono text-xl font-bold">{name}</h1>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">
            {npub.slice(0, 12)}…{npub.slice(-8)}
          </p>
          {metadata?.nip05 ? (
            <p className="mt-1 inline-block rounded-sm bg-gain/10 px-1.5 py-0.5 font-mono text-xs font-semibold text-gain">
              {metadata.nip05}
            </p>
          ) : null}
          {metadata?.about ? (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed break-words whitespace-pre-wrap text-foreground/80">
              {metadata.about}
            </p>
          ) : null}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card">
        <header className="border-b border-border bg-muted/30 px-4 py-2 font-mono text-[11px] font-bold tracking-[0.15em]">
          RECENT NOTES
        </header>
        {notes.isPending && !notes.data ? (
          <div className="space-y-3 p-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))}
          </div>
        ) : notes.data && notes.data.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No public notes found. Check the relays the profile publishes to.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {notes.data?.map((note) => (
              <NoteRow key={note.id} event={note} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
