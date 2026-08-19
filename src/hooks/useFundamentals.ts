import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';

import { useCurrentUser } from './useCurrentUser';
import { decryptOwnData, isEncryptedEvent, symKey } from '@/lib/nostrCrypto';

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
      const key = await symKey(upper);
      // Exact d-tag lookup (hashed symbol) — avoids both snapshot crowding and
      // symbol metadata leaking in plaintext.
      const events = await nostr.query(
        [{ kinds: [FUNDAMENTALS_KIND], authors: [pubkey], '#d': [`${FUNDAMENTALS_PREFIX}${key}`], limit: 1 }],
        { signal },
      );
      const ev = events[0];
      if (!ev) return null;
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
      return parsed && Array.isArray(parsed.years) ? parsed : null;
    },
    staleTime: 60_000,
  });
}
