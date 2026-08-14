import { useState } from 'react';
import { Bell, BellOff, BellRing, RefreshCcw, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { useAlerts, describeAlert } from '@/hooks/useAlerts';
import { useToast } from '@/hooks/useToast';
import {
  notificationPermission,
  notificationsSupported,
  requestNotificationPermission,
} from '@/lib/notify';
import { cn } from '@/lib/utils';

/** Header bell: active-alert count + alert management dialog. */
export function AlertBell() {
  const { alerts, save, user } = useAlerts();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const activeCount = alerts.filter((a) => !a.firedAt).length;
  const permission = notificationPermission();

  const remove = async (id: string) => {
    try {
      await save(alerts.filter((a) => a.id !== id));
    } catch {
      toast({ title: 'Failed to remove alert', variant: 'destructive' });
    }
  };

  const rearm = async (id: string) => {
    try {
      await save(alerts.map((a) => (a.id === id ? { ...a, firedAt: undefined } : a)));
    } catch {
      toast({ title: 'Failed to re-arm alert', variant: 'destructive' });
    }
  };

  const enableNotifications = async () => {
    const result = await requestNotificationPermission();
    toast({
      title: result === 'granted' ? 'Notifications enabled' : 'Notifications blocked',
      description:
        result === 'granted'
          ? 'Price alerts will notify you even in another tab.'
          : 'Allow notifications for this site in your browser settings.',
      variant: result === 'granted' ? 'default' : 'destructive',
    });
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="relative text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(true)}
        aria-label={`Alerts (${activeCount} active)`}
      >
        <Bell className="size-4" />
        {activeCount > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 grid min-w-4 place-items-center rounded-full bg-loss px-1 font-mono text-[9px] font-bold text-white">
            {activeCount}
          </span>
        ) : null}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-mono">PRICE ALERTS</DialogTitle>
            <DialogDescription>
              Checked every 60s while the terminal is open. Stored on Nostr — they follow your npub.
              Add alerts from any stock page.
            </DialogDescription>
          </DialogHeader>

          {!user ? (
            <p className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              Log in with Nostr to manage price alerts.
            </p>
          ) : (
            <div className="space-y-2">
              {notificationsSupported() && permission !== 'granted' && (
                <div className="flex items-center justify-between gap-2 rounded-md border border-signal/40 bg-signal/10 px-3 py-2">
                  <span className="text-xs text-foreground">
                    {permission === 'default' ? 'Enable browser notifications for alerts.' : 'Notifications are blocked in your browser.'}
                  </span>
                  {permission === 'default' && (
                    <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={enableNotifications}>
                      Enable
                    </Button>
                  )}
                </div>
              )}

              {alerts.length === 0 ? (
                <p className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                  No alerts yet. Open a stock and hit the bell to set one.
                </p>
              ) : (
                <ul className="max-h-72 space-y-1.5 overflow-y-auto">
                  {alerts.map((a) => (
                    <li
                      key={a.id}
                      className={cn(
                        'flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2',
                        a.firedAt && 'opacity-70',
                      )}
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="font-mono text-sm font-bold">
                          {describeAlert(a)}
                          {a.firedAt ? (
                            <span className="ml-2 rounded-sm bg-signal/15 px-1 py-0.5 font-mono text-[9px] font-bold text-signal">
                              FIRED
                            </span>
                          ) : (
                            <span className="ml-2 rounded-sm bg-gain/15 px-1 py-0.5 font-mono text-[9px] font-bold text-gain">
                              ARMED
                            </span>
                          )}
                        </span>
                        {a.note ? <span className="truncate text-[11px] text-muted-foreground">{a.note}</span> : null}
                      </span>
                      <span className="flex shrink-0 gap-1">
                        {a.firedAt ? (
                          <Button size="icon" variant="ghost" className="size-7" aria-label="Re-arm alert" onClick={() => rearm(a.id)}>
                            <RefreshCcw className="size-3.5" />
                          </Button>
                        ) : null}
                        <Button size="icon" variant="ghost" className="size-7 text-muted-foreground hover:text-loss" aria-label="Delete alert" onClick={() => remove(a.id)}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex items-center gap-2 pt-1 text-[11px] text-muted-foreground">
                {activeCount > 0 ? <BellRing className="size-3.5 text-gain" /> : <BellOff className="size-3.5" />}
                {activeCount} armed · {alerts.length - activeCount} fired
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
