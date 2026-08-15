import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';

import { useCurrentUser } from './useCurrentUser';
import { useNostrPublish } from './useNostrPublish';
import { decryptOwnData, encryptOwnData, isEncryptedEvent, type Nip44Signer } from '@/lib/nostrCrypto';

/**
 * The user's positions (shares + option contracts), stored as a NIP-78
 * app-data event (kind 30078, d-tag `vault:positions`). Content is NIP-44
 * encrypted to the owner (see NIP.md).
 */

export const POSITIONS_D = 'vault:positions';
export const POSITIONS_KIND = 30078;

export interface Position {
  symbol: string;
  quantity: number;
  avgCost: number;
  note?: string;
  /** Present for option positions — OCC contract symbol, e.g. AAPL260919C00200000 */
  contract?: string;
  strike?: number;
  expiry?: number;
  optionType?: 'C' | 'P';
}

interface PositionsContent {
  version?: number;
  positions?: Position[];
}

export function parsePositions(event: NostrEvent): Position[] {
  try {
    const parsed = JSON.parse(event.content) as PositionsContent;
    if (Array.isArray(parsed?.positions)) {
      return parsed.positions.filter((p) => p && typeof p.symbol === 'string');
    }
  } catch {
    // ignore malformed events
  }
  return [];
}

async function readPositions(event: NostrEvent, pubkey: string, signer?: Nip44Signer): Promise<Position[]> {
  if (isEncryptedEvent(event) && signer) {
    const decrypted = await decryptOwnData<PositionsContent>(signer, pubkey, event.content);
    if (decrypted && Array.isArray(decrypted.positions)) {
      return decrypted.positions.filter((p) => p && typeof p.symbol === 'string');
    }
  }
  return parsePositions(event);
}

export function usePositions() {
  const { user } = useCurrentUser();
  const { nostr } = useNostr();
  const queryClient = useQueryClient();
  const { mutateAsync: publish } = useNostrPublish();

  const pubkey = user?.pubkey;
  const queryKey = useMemo(() => ['vault', 'positions', pubkey] as const, [pubkey]);

  const query = useQuery({
    queryKey,
    enabled: Boolean(pubkey),
    queryFn: async ({ signal }) => {
      if (!pubkey) return [] as Position[];
      const events = await nostr.query(
        [{ kinds: [POSITIONS_KIND], authors: [pubkey], '#d': [POSITIONS_D], limit: 1 }],
        { signal },
      );
      const event = events[0];
      return event ? readPositions(event, pubkey, user?.signer) : [];
    },
  });

  const save = useCallback(
    async (positions: Position[]) => {
      if (!user) throw new Error('Not logged in');
      const previous = queryClient.getQueryData<Position[]>(queryKey);
      queryClient.setQueryData(queryKey, positions); // optimistic
      try {
        const content = await encryptOwnData(user.signer, user.pubkey, { version: 1, positions });
        const tags: string[][] = [
          ['d', POSITIONS_D],
          ['enc', 'nip44'],
        ];
        await publish({ kind: POSITIONS_KIND, content, tags });
      } catch (error) {
        queryClient.setQueryData(queryKey, previous);
        throw error;
      }
    },
    [user, publish, queryClient, queryKey],
  );

  return {
    positions: query.data ?? [],
    isLoading: query.isLoading,
    isPending: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
    save,
    user,
  };
}
