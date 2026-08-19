import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';

import { useCurrentUser } from './useCurrentUser';
import { decryptOwnData, isEncryptedEvent, symKey } from '@/lib/nostrCrypto';

/**
 * Reads the owner's hourly market snapshots for a symbol from Nostr
 * (kind 30078, d = "vault:snapshot:<SYMBOL>:<hour>", t = <SYMBOL>).
 * Written by server/market-snapshot.mjs on the user's VPS. See NIP.md.
 */

export const SNAPSHOT_KIND = 30078;
export const SNAPSHOT_PREFIX = 'vault:snapshot:';

export interface MarketSnapshot {
  d: string;
  symbol: string;
  name?: string;
  price: number;
  prevClose: number | null;
  changePct: number | null;
  volume: number | null;
  ts: number;
}

interface SnapshotContent {
  version?: number;
  symbol?: string;
  name?: string;
  price?: number;
  prevClose?: number | null;
  changePct?: number | null;
  volume?: number | null;
  ts?: number;
}

export function useSnapshots(symbol: string) {
  const { user } = useCurrentUser();
  const { nostr } = useNostr();
  const pubkey = user?.pubkey;
  const upper = symbol.toUpperCase();

  return useQuery<MarketSnapshot[]>({
    queryKey: ['vault', 'snapshots', upper, pubkey],
    enabled: Boolean(pubkey && upper),
    queryFn: async ({ signal }) => {
      if (!pubkey) return [] as MarketSnapshot[];
      const key = await symKey(upper);
      const events = await nostr.query(
        [{ kinds: [SNAPSHOT_KIND], authors: [pubkey], '#t': [key], limit: 30 }],
        { signal },
      );

      const snaps: MarketSnapshot[] = [];
      for (const ev of events) {
        const d = ev.tags.find(([k]) => k === 'd')?.[1] ?? '';
        if (!d.startsWith(`${SNAPSHOT_PREFIX}${key}:`)) continue;

        let parsed: SnapshotContent | null = null;
        if (isEncryptedEvent(ev)) {
          parsed = user ? await decryptOwnData<SnapshotContent>(user.signer, pubkey, ev.content) : null;
        } else {
          try {
            parsed = JSON.parse(ev.content) as SnapshotContent;
          } catch {
            parsed = null;
          }
        }

        if (parsed && typeof parsed.price === 'number') {
          snaps.push({
            d,
            symbol: parsed.symbol ?? upper,
            name: parsed.name,
            price: parsed.price,
            prevClose: parsed.prevClose ?? null,
            changePct: parsed.changePct ?? null,
            volume: parsed.volume ?? null,
            ts: parsed.ts ?? 0,
          });
        }
      }

      return snaps.sort((a, b) => b.ts - a.ts).slice(0, 12);
    },
    staleTime: 60_000,
  });
}
