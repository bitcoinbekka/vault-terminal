import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';

import { useCurrentUser } from './useCurrentUser';
import { decryptOwnData, isEncryptedEvent } from '@/lib/nostrCrypto';

/**
 * Reads the owner's SEC fundamentals report for a symbol from Nostr
 * (kind 30078, d = "vault:fundamentals:<SYMBOL>", t = <SYMBOL>).
 * Written by server/sec-fundamentals.mjs on the user's VPS. See NIP.md.
 */

export const FUNDAMENTALS_KIND = 30078;
export const FUNDAMENTALS_PREFIX = 'vault:fundamentals:';

export interface FundamentalsYear {
  year: number;
  revenue: number | null;
  netIncome: number | null;
  eps: number | null;
  grossProfit: number | null;
  operatingIncome: number | null;
  totalAssets: number | null;
  totalLiabilities: number | null;
}

export interface FundamentalsReport {
  version?: number;
  symbol: string;
  cik: number;
  name?: string;
  updatedAt: number;
  years: FundamentalsYear[];
}

export function useFundamentals(symbol: string) {
  const { user } = useCurrentUser();
  const { nostr } = useNostr();
  const pubkey = user?.pubkey;
  const upper = symbol.toUpperCase();

  return useQuery<FundamentalsReport | null>({
    queryKey: ['vault', 'fundamentals', upper, pubkey],
    enabled: Boolean(pubkey && upper),
    queryFn: async ({ signal }) => {
      if (!pubkey) return null;
      const events = await nostr.query(
        [{ kinds: [FUNDAMENTALS_KIND], authors: [pubkey], '#t': [upper], limit: 8 }],
        { signal },
      );

      for (const ev of events) {
        const d = ev.tags.find(([k]) => k === 'd')?.[1] ?? '';
        if (!d.startsWith(`${FUNDAMENTALS_PREFIX}${upper}`)) continue;
        let parsed: FundamentalsReport | null = null;
        if (isEncryptedEvent(ev)) {
          parsed = user ? await decryptOwnData<FundamentalsReport>(user.signer, pubkey, ev.content) : null;
        } else {
          try {
            parsed = JSON.parse(ev.content) as FundamentalsReport;
          } catch {
            parsed = null;
          }
        }
        if (parsed && Array.isArray(parsed.years)) return parsed;
      }
      return null;
    },
    staleTime: 60_000,
  });
}
