import { useState } from 'react';
import { z } from 'zod';

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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoginArea } from '@/components/auth/LoginArea';

import { useTrades } from '@/hooks/useTrades';
import { useToast } from '@/hooks/useToast';
import { isValidSymbol, normalizeSymbol } from '@/lib/yahoo';

const schema = z.object({
  symbol: z.string().trim().transform(normalizeSymbol).refine(isValidSymbol, 'Invalid ticker symbol'),
  side: z.enum(['buy', 'sell']),
  quantity: z.coerce.number().positive('Quantity must be > 0'),
  price: z.coerce.number().positive('Price must be > 0'),
  date: z.string().min(1, 'Pick a date'),
  fees: z.coerce.number().min(0, 'Fees cannot be negative').optional(),
  note: z.string().trim().optional(),
});

function todayInput(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

interface AddTradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSymbol?: string;
}

/** Log a buy or sell. Stored on Nostr (kind 30078) — FIFO realized P/L follows. */
export function AddTradeDialog({ open, onOpenChange, initialSymbol }: AddTradeDialogProps) {
  const [symbol, setSymbol] = useState(initialSymbol ?? '');
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [date, setDate] = useState(todayInput());
  const [fees, setFees] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { trades, save, user } = useTrades();
  const { toast } = useToast();

  const submit = async () => {
    if (!user) return;
    const result = schema.safeParse({
      symbol,
      side,
      quantity,
      price,
      date,
      fees: fees === '' ? undefined : fees,
      note: note === '' ? undefined : note,
    });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Invalid input');
      return;
    }
    const data = result.data;
    const dateSec = Math.floor(new Date(`${data.date}T12:00:00`).getTime() / 1000);

    setSaving(true);
    try {
      const trade = {
        id: crypto.randomUUID(),
        symbol: data.symbol,
        side: data.side,
        quantity: data.quantity,
        price: data.price,
        date: dateSec,
        fees: data.fees,
        note: data.note,
      };
      await save([...trades, trade]);
      toast({
        title: `${data.side === 'buy' ? 'BUY' : 'SELL'} logged`,
        description: `${data.quantity} × ${data.symbol} @ $${data.price.toFixed(2)}`,
      });
      setSymbol(initialSymbol ?? '');
      setQuantity('');
      setPrice('');
      setDate(todayInput());
      setFees('');
      setNote('');
      setError(null);
      onOpenChange(false);
    } catch {
      toast({ title: 'Failed to save trade', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setError(null);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono">LOG TRADE</DialogTitle>
          <DialogDescription>
            Buys open lots, sells close them FIFO — realized P/L, win rate and hold time are computed
            automatically. Stored on Nostr (kind 30078).
          </DialogDescription>
        </DialogHeader>

        {!user ? (
          <div className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
            <p className="mb-2">Log in with Nostr to keep a trade journal.</p>
            <LoginArea className="w-full" />
          </div>
        ) : (
          <div className="space-y-3">
            <Tabs value={side} onValueChange={(v) => setSide(v as 'buy' | 'sell')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="buy" className="font-mono text-xs text-gain">BUY</TabsTrigger>
                <TabsTrigger value="sell" className="font-mono text-xs text-loss">SELL</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="trade-symbol" className="font-mono text-[11px] text-muted-foreground">SYMBOL</Label>
                <Input
                  id="trade-symbol"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  placeholder="AAPL"
                  className="font-mono uppercase"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="trade-qty" className="font-mono text-[11px] text-muted-foreground">QUANTITY</Label>
                <Input
                  id="trade-qty"
                  type="number"
                  min="0"
                  step="any"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="10"
                  className="font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="trade-price" className="font-mono text-[11px] text-muted-foreground">PRICE ($)</Label>
                <Input
                  id="trade-price"
                  type="number"
                  min="0"
                  step="any"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="180.50"
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="trade-date" className="font-mono text-[11px] text-muted-foreground">DATE</Label>
                <Input
                  id="trade-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="trade-fees" className="font-mono text-[11px] text-muted-foreground">FEES ($, OPTIONAL)</Label>
                <Input
                  id="trade-fees"
                  type="number"
                  min="0"
                  step="any"
                  value={fees}
                  onChange={(e) => setFees(e.target.value)}
                  placeholder="0.50"
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="trade-note" className="font-mono text-[11px] text-muted-foreground">NOTE (OPTIONAL)</Label>
                <Input
                  id="trade-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Thesis, setup, mistake…"
                />
              </div>
            </div>

            {error ? <p className="text-xs text-loss">{error}</p> : null}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={submit}
            disabled={saving || !user}
            className={side === 'buy' ? 'bg-gain text-white hover:bg-gain/90' : 'bg-loss text-white hover:bg-loss/90'}
          >
            {saving ? 'Saving…' : side === 'buy' ? 'Log buy' : 'Log sell'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
