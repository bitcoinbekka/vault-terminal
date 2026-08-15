import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';

import { useCurrentUser } from './useCurrentUser';
import { useNostrPublish } from './useNostrPublish';
import { decryptOwnData, encryptOwnData, isEncryptedEvent, type Nip44Signer } from '@/lib/nostrCrypto';

/**
 * The user's watchlist, stored as a NIP-78 app-data event (kind 30078,
 * d-tag `vault:watchlist`). Content is NIP-44 encrypted to the owner's own
 * pubkey (`enc` tag) so the symbols stay private on relays. See NIP.md.
 */

export const WATCHLIST_D = 'vault:watchlist';
export const WATCHLIST_KIND = 30078;

interface WatchlistContent {
  version?: number;
  symbols?: string[];
}

/** Parse a plaintext (legacy) watchlist event. */
export function parseWatchlist(event: NostrEvent): string[] {
  try {
    const parsed = JSON.parse(event.content) as WatchlistContent;
    if (Array.isArray(parsed?.symbols)) {
      return parsed.symbols.map((s) => s.toUpperCase());
    }
  } catch {
    // ignore malformed events
  }
  return event.tags
    .filter(([name]) => name === 't')
    .map(([, value]) => value)
    .filter(Boolean)
    .map((s) => s.toUpperCase());
}

async function readWatchlist(event: NostrEvent, pubkey: string, signer?: Nip44Signer): Promise<string[]> {
  if (isEncryptedEvent(event) && signer) {
    const decrypted = await decryptOwnData<WatchlistContent>(signer, pubkey, event.content);
    if (decrypted && Array.isArray(decrypted.symbols)) {
      return decrypted.symbols.map((s) => s.toUpperCase());
    }
  }
  return parseWatchlist(event);
}

export function useWatchlist() {
  const { user } = useCurrentUser();
  const { nostr } = useNostr();
  const queryClient = useQueryClient();
  const { mutateAsync: publish } = useNostrPublish();

  const pubkey = user?.pubkey;
  const queryKey = useMemo(() => ['vault', 'watchlist', pubkey] as const, [pubkey]);

  const query = useQuery({
    queryKey,
    enabled: Boolean(pubkey),
    queryFn: async ({ signal }) => {
      if (!pubkey) return [] as string[];
      const events = await nostr.query(
        [{ kinds: [WATCHLIST_KIND], authors: [pubkey], '#d': [WATCHLIST_D], limit: 1 }],
        { signal },
      );
      const event = events[0];
      return event ? readWatchlist(event, pubkey, user?.signer) : [];
    },
  });

  const save = useCallback(
    async (symbols: string[]) => {
      if (!user) throw new Error('Not logged in');
      const normalized = [...new Set(symbols.map((s) => s.trim().toUpperCase()))];
      const previous = queryClient.getQueryData<string[]>(queryKey);
      queryClient.setQueryData(queryKey, normalized); // optimistic
      try {
        const content = await encryptOwnData(user.signer, user.pubkey, { version: 1, symbols: normalized });
        const tags: string[][] = [
          ['d', WATCHLIST_D],
          ['enc', 'nip44'],
        ];
        await publish({ kind: WATCHLIST_KIND, content, tags });
      } catch (error) {
        queryClient.setQueryData(queryKey, previous);
        throw error;
      }
    },
    [user, publish, queryClient, queryKey],
  );

  return {
    watchlist: query.data ?? [],
    isLoading: query.isLoading,
    isPending: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
    save,
    user,
  };
}
