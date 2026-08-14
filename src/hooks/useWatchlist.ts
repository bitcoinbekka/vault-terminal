import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';

import { useCurrentUser } from './useCurrentUser';
import { useNostrPublish } from './useNostrPublish';

/**
 * The user's watchlist, stored as a NIP-78 app-data event (kind 30078,
 * d-tag `vault:watchlist`). Symbols are mirrored into `t` tags so they are
 * queryable at the relay level. See NIP.md.
 */

export const WATCHLIST_D = 'vault:watchlist';
export const WATCHLIST_KIND = 30078;

interface WatchlistContent {
  version?: number;
  symbols?: string[];
}

export function parseWatchlist(event: NostrEvent): string[] {
  try {
    const parsed = JSON.parse(event.content) as WatchlistContent;
    if (Array.isArray(parsed?.symbols)) {
      return parsed.symbols.map((s) => s.toUpperCase());
    }
  } catch {
    // Fall through to tag parsing
  }
  return event.tags
    .filter(([name]) => name === 't')
    .map(([, value]) => value)
    .filter(Boolean)
    .map((s) => s.toUpperCase());
}

export function useWatchlist() {
  const { user } = useCurrentUser();
  const { nostr } = useNostr();
  const queryClient = useQueryClient();
  const { mutateAsync: publish } = useNostrPublish();

  const pubkey = user?.pubkey;
  const queryKey = ['vault', 'watchlist', pubkey] as const;

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
      return event ? parseWatchlist(event) : [];
    },
  });

  const save = useCallback(
    async (symbols: string[]) => {
      if (!user) throw new Error('Not logged in');
      const normalized = [...new Set(symbols.map((s) => s.trim().toUpperCase()))];
      const previous = queryClient.getQueryData<string[]>(queryKey);
      queryClient.setQueryData(queryKey, normalized); // optimistic
      try {
        const content = JSON.stringify({ version: 1, symbols: normalized });
        const tags: string[][] = [
          ['d', WATCHLIST_D],
          ...normalized.map((s) => ['t', s] as [string, string]),
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
