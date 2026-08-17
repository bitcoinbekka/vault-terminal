import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';

import { useCurrentUser } from './useCurrentUser';
import { useNostrPublish } from './useNostrPublish';
import { decryptOwnData, encryptOwnData, isEncryptedEvent } from '@/lib/nostrCrypto';

/**
 * Phase 2 AI filing analysis. The app publishes an encrypted request
 * (d = "vault:analysis:request:<SYMBOL>"); the VPS analyzer
 * (server/analyzer.mjs) runs the LLM and publishes an encrypted report
 * (d = "vault:analysis:<SYMBOL>"). Everything stays on Nostr, owner-only.
 */

export const ANALYSIS_KIND = 30078;
export const ANALYSIS_REQUEST_PREFIX = 'vault:analysis:request:';
export const ANALYSIS_RESULT_PREFIX = 'vault:analysis:';

export interface AnalysisReport {
  version?: number;
  symbol: string;
  model?: string;
  verdict?: string;
  summary?: string;
  strengths?: string[];
  risks?: string[];
  insights?: string[];
  updatedAt: number;
  requestedAt?: number;
}

export function useAnalysis(symbol: string, refetchIntervalMs?: number) {
  const { user } = useCurrentUser();
  const { nostr } = useNostr();
  const pubkey = user?.pubkey;
  const upper = symbol.toUpperCase();

  return useQuery<AnalysisReport | null>({
    queryKey: ['vault', 'analysis', upper, pubkey],
    enabled: Boolean(pubkey && upper),
    refetchInterval: refetchIntervalMs,
    queryFn: async ({ signal }) => {
      if (!pubkey) return null;
      const events = await nostr.query(
        [{ kinds: [ANALYSIS_KIND], authors: [pubkey], '#t': [upper], limit: 5 }],
        { signal },
      );
      for (const ev of events) {
        const d = ev.tags.find(([k]) => k === 'd')?.[1] ?? '';
        if (!d.startsWith(`${ANALYSIS_RESULT_PREFIX}${upper}`)) continue;
        let parsed: AnalysisReport | null = null;
        if (isEncryptedEvent(ev)) {
          parsed = user ? await decryptOwnData<AnalysisReport>(user.signer, pubkey, ev.content) : null;
        } else {
          try {
            parsed = JSON.parse(ev.content) as AnalysisReport;
          } catch {
            parsed = null;
          }
        }
        if (parsed && typeof parsed.summary === 'string') return parsed;
      }
      return null;
    },
    staleTime: 30_000,
  });
}

/** Publishes an analysis request the VPS analyzer picks up. */
export function useRequestAnalysis() {
  const { user } = useCurrentUser();
  const { mutateAsync: publish } = useNostrPublish();

  return useCallback(
    async (symbol: string): Promise<void> => {
      if (!user) throw new Error('Not logged in');
      const upper = symbol.toUpperCase();
      const payload = { version: 1, symbol: upper, createdAt: Math.floor(Date.now() / 1000) };
      const content = await encryptOwnData(user.signer, user.pubkey, payload);
      await publish({
        kind: ANALYSIS_KIND,
        content,
        tags: [
          ['d', `${ANALYSIS_REQUEST_PREFIX}${upper}`],
          ['enc', 'nip44'],
        ],
      });
    },
    [user, publish],
  );
}
