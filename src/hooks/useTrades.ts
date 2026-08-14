import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';

import { useCurrentUser } from './useCurrentUser';
import { useNostrPublish } from './useNostrPublish';
import { computeJournal, type JournalStats, type Trade } from '@/lib/journal';

/**
 * The user's trade journal, stored as a NIP-78 app-data event (kind 30078,
 * d-tag `vault:trades`). Realized P/L is computed client-side with FIFO
 * accounting (see lib/journal.ts). See NIP.md.
 */

export const TRADES_D = 'vault:trades';
export const TRADES_KIND = 30078;

interface TradesContent {
  version?: number;
  trades?: Trade[];
}

export function parseTrades(event: NostrEvent): Trade[] {
  try {
    const parsed = JSON.parse(event.content) as TradesContent;
    if (Array.isArray(parsed?.trades)) {
      return parsed.trades.filter(
        (t) =>
          t &&
          typeof t.symbol === 'string' &&
          (t.side === 'buy' || t.side === 'sell') &&
          typeof t.quantity === 'number' &&
          typeof t.price === 'number',
      );
    }
  } catch {
    // ignore malformed events
  }
  return [];
}

export function useTrades() {
  const { user } = useCurrentUser();
  const { nostr } = useNostr();
  const queryClient = useQueryClient();
  const { mutateAsync: publish } = useNostrPublish();

  const pubkey = user?.pubkey;
  const queryKey = useMemo(() => ['vault', 'trades', pubkey] as const, [pubkey]);

  const query = useQuery({
    queryKey,
    enabled: Boolean(pubkey),
    queryFn: async ({ signal }) => {
      if (!pubkey) return [] as Trade[];
      const events = await nostr.query(
        [{ kinds: [TRADES_KIND], authors: [pubkey], '#d': [TRADES_D], limit: 1 }],
        { signal },
      );
      const event = events[0];
      return event ? parseTrades(event) : [];
    },
  });

  const save = useCallback(
    async (trades: Trade[]) => {
      if (!user) throw new Error('Not logged in');
      const previous = queryClient.getQueryData<Trade[]>(queryKey);
      queryClient.setQueryData(queryKey, trades); // optimistic
      try {
        const content = JSON.stringify({ version: 1, trades });
        const tags: string[][] = [['d', TRADES_D]];
        await publish({ kind: TRADES_KIND, content, tags });
      } catch (error) {
        queryClient.setQueryData(queryKey, previous);
        throw error;
      }
    },
    [user, publish, queryClient, queryKey],
  );

  const stats: JournalStats = useMemo(() => computeJournal(query.data ?? []), [query.data]);

  return {
    trades: query.data ?? [],
    stats,
    isLoading: query.isLoading,
    isPending: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
    save,
    user,
  };
}
