import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';

import { useCurrentUser } from './useCurrentUser';
import { useNostrPublish } from './useNostrPublish';
import { decryptOwnData, encryptOwnData, isEncryptedEvent, type Nip44Signer } from '@/lib/nostrCrypto';

/**
 * The user's price alerts, stored as a NIP-78 app-data event (kind 30078,
 * d-tag `vault:alerts`). Content is NIP-44 encrypted to the owner. Alerts are
 * checked client-side while the terminal is open and by the server-side
 * watcher (which decrypts with the owner's nsec). See NIP.md.
 */

export const ALERTS_D = 'vault:alerts';
export const ALERTS_KIND = 30078;

export type AlertDirection = 'above' | 'below' | 'pctUp' | 'pctDown';

export interface PriceAlert {
  id: string;
  symbol: string;
  direction: AlertDirection;
  /** For above/below: target price. For pctUp/pctDown: target percent. */
  value: number;
  note?: string;
  createdAt: number;
  /** Set when the alert has fired once; clear to re-arm. */
  firedAt?: number;
}

interface AlertsContent {
  version?: number;
  alerts?: PriceAlert[];
}

export function parseAlerts(event: NostrEvent): PriceAlert[] {
  try {
    const parsed = JSON.parse(event.content) as AlertsContent;
    if (Array.isArray(parsed?.alerts)) {
      return parsed.alerts.filter(
        (a) => a && typeof a.symbol === 'string' && typeof a.value === 'number',
      );
    }
  } catch {
    // ignore malformed events
  }
  return [];
}

export function describeAlert(a: PriceAlert): string {
  switch (a.direction) {
    case 'above':
      return `${a.symbol} > $${a.value.toFixed(2)}`;
    case 'below':
      return `${a.symbol} < $${a.value.toFixed(2)}`;
    case 'pctUp':
      return `${a.symbol} up ${a.value}%`;
    case 'pctDown':
      return `${a.symbol} down ${a.value}%`;
  }
}

async function readAlerts(event: NostrEvent, pubkey: string, signer?: Nip44Signer): Promise<PriceAlert[]> {
  if (isEncryptedEvent(event) && signer) {
    const decrypted = await decryptOwnData<AlertsContent>(signer, pubkey, event.content);
    if (decrypted && Array.isArray(decrypted.alerts)) {
      return decrypted.alerts.filter(
        (a) => a && typeof a.symbol === 'string' && typeof a.value === 'number',
      );
    }
  }
  return parseAlerts(event);
}

export function useAlerts() {
  const { user } = useCurrentUser();
  const { nostr } = useNostr();
  const queryClient = useQueryClient();
  const { mutateAsync: publish } = useNostrPublish();

  const pubkey = user?.pubkey;
  const queryKey = useMemo(() => ['vault', 'alerts', pubkey] as const, [pubkey]);

  const query = useQuery({
    queryKey,
    enabled: Boolean(pubkey),
    queryFn: async ({ signal }) => {
      if (!pubkey) return [] as PriceAlert[];
      const events = await nostr.query(
        [{ kinds: [ALERTS_KIND], authors: [pubkey], '#d': [ALERTS_D], limit: 1 }],
        { signal },
      );
      const event = events[0];
      return event ? readAlerts(event, pubkey, user?.signer) : [];
    },
  });

  const save = useCallback(
    async (alerts: PriceAlert[]) => {
      if (!user) throw new Error('Not logged in');
      const previous = queryClient.getQueryData<PriceAlert[]>(queryKey);
      queryClient.setQueryData(queryKey, alerts); // optimistic
      try {
        const content = await encryptOwnData(user.signer, user.pubkey, { version: 1, alerts });
        const tags: string[][] = [
          ['d', ALERTS_D],
          ['enc', 'nip44'],
        ];
        await publish({ kind: ALERTS_KIND, content, tags });
      } catch (error) {
        queryClient.setQueryData(queryKey, previous);
        throw error;
      }
    },
    [user, publish, queryClient, queryKey],
  );

  return {
    alerts: query.data ?? [],
    isLoading: query.isLoading,
    isPending: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
    save,
    user,
  };
}
