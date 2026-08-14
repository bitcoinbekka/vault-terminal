import { useState } from 'react';
import { BellPlus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LoginArea } from '@/components/auth/LoginArea';

import { useAlerts, type AlertDirection } from '@/hooks/useAlerts';
import { useToast } from '@/hooks/useToast';
import { normalizeSymbol } from '@/lib/yahoo';
import { requestNotificationPermission } from '@/lib/notify';

interface AddAlertDialogProps {
  symbol: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DIRECTIONS: { value: AlertDirection; label: string }[] = [
  { value: 'above', label: 'Price rises above' },
  { value: 'below', label: 'Price drops below' },
  { value: 'pctUp', label: 'Gains at least (%)' },
  { value: 'pctDown', label: 'Falls at least (%)' },
];

/** Create a price alert for a symbol. Stored on Nostr (kind 30078). */
export function AddAlertDialog({ symbol, open, onOpenChange }: AddAlertDialogProps) {
  const [direction, setDirection] = useState<AlertDirection>('above');
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { alerts, save, user } = useAlerts();
  const { toast } = useToast();

  const submit = async () => {
    if (!user) return;
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) {
      setError('Enter a value greater than 0.');
      return;
    }

    setSaving(true);
    try {
      await requestNotificationPermission();
      const alert = {
        id: crypto.randomUUID(),
        symbol: normalizeSymbol(symbol),
        direction,
        value: num,
        note: note.trim() || undefined,
        createdAt: Math.floor(Date.now() / 1000),
      };
      await save([...alerts, alert]);
      toast({
        title: 'Alert set',
        description: `${alert.symbol} — ${direction === 'above' ? '>' : direction === 'below' ? '<' : direction === 'pctUp' ? 'up' : 'down'} ${num}`,
      });
      setValue('');
      setNote('');
      setError(null);
      onOpenChange(false);
    } catch {
      toast({ title: 'Failed to save alert', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono">SET ALERT · {normalizeSymbol(symbol)}</DialogTitle>
          <DialogDescription>
            Checked every 60s while the terminal is open. Fires a browser notification + sound. Saved
            to Nostr (kind 30078) — follows your npub.
          </DialogDescription>
        </DialogHeader>

        {!user ? (
          <div className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
            <p className="mb-2">Log in with Nostr to set price alerts.</p>
            <LoginArea className="w-full" />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="alert-direction" className="font-mono text-[11px] text-muted-foreground">CONDITION</Label>
              <Select value={direction} onValueChange={(v) => setDirection(v as AlertDirection)}>
                <SelectTrigger id="alert-direction" className="w-full font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIRECTIONS.map((d) => (
                    <SelectItem key={d.value} value={d.value} className="font-mono text-xs">
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="alert-value" className="font-mono text-[11px] text-muted-foreground">
                {direction === 'above' || direction === 'below' ? 'TARGET PRICE ($)' : 'PERCENT (%)'}
              </Label>
              <Input
                id="alert-value"
                type="number"
                min="0"
                step="any"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={direction === 'above' || direction === 'below' ? '520.00' : '5'}
                className="font-mono"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="alert-note" className="font-mono text-[11px] text-muted-foreground">NOTE (OPTIONAL)</Label>
              <Input
                id="alert-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Why this level matters…"
              />
            </div>

            {error ? <p className="text-xs text-loss">{error}</p> : null}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving || !user} className="gap-1 bg-signal text-signal-foreground hover:bg-signal/90">
            <BellPlus className="size-4" />
            {saving ? 'Saving…' : 'Set alert'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
