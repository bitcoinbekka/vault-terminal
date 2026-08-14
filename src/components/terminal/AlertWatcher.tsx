import { useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { useAlerts, describeAlert, type PriceAlert } from '@/hooks/useAlerts';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useToast } from '@/hooks/useToast';
import { fetchQuote } from '@/lib/yahoo';
import { playAlertSound, showNotification } from '@/lib/notify';

const CHECK_INTERVAL_MS = 60_000;

/** Renders nothing — polls active alerts and fires browser notifications. */
export function AlertWatcher() {
  const { alerts, save } = useAlerts();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const check = useCallback(async () => {
    if (!user) return;
    const active = alerts.filter((a) => !a.firedAt);
    if (active.length === 0) return;

    const fired: PriceAlert[] = [];
    for (const alert of active) {
      try {
        const data = await queryClient.fetchQuery({
          queryKey: ['yahoo', 'chart', alert.symbol, '1D'],
          queryFn: ({ signal }) => fetchQuote(alert.symbol, signal),
          staleTime: CHECK_INTERVAL_MS,
        });
        const price = data?.meta?.regularMarketPrice;
        const prev = data?.meta?.chartPreviousClose ?? data?.meta?.previousClose;
        if (typeof price !== 'number') continue;

        let hit = false;
        switch (alert.direction) {
          case 'above':
            hit = price > alert.value;
            break;
          case 'below':
            hit = price < alert.value;
            break;
          case 'pctUp':
            hit = typeof prev === 'number' && prev > 0 && ((price - prev) / prev) * 100 >= alert.value;
            break;
          case 'pctDown':
            hit = typeof prev === 'number' && prev > 0 && ((price - prev) / prev) * 100 <= -alert.value;
            break;
        }

        if (hit) {
          fired.push(alert);
          const body = `${describeAlert(alert)} — now $${price.toFixed(2)}`;
          showNotification('Vault Alert', body);
          playAlertSound();
          toast({ title: 'ALERT TRIGGERED', description: body, variant: 'default' });
        }
      } catch {
        // Feed unavailable — try again next tick.
      }
    }

    if (fired.length > 0) {
      const firedIds = new Set(fired.map((f) => f.id));
      const next = alerts.map((a) => (firedIds.has(a.id) ? { ...a, firedAt: Math.floor(Date.now() / 1000) } : a));
      try {
        await save(next);
      } catch {
        // Publishing failed — alerts will re-fire next tick; acceptable.
      }
    }
  }, [alerts, user, queryClient, save, toast]);

  useEffect(() => {
    if (!user) return;
    const id = setInterval(check, CHECK_INTERVAL_MS);
    const first = setTimeout(check, 2500);
    return () => {
      clearInterval(id);
      clearTimeout(first);
    };
  }, [check, user]);

  return null;
}
