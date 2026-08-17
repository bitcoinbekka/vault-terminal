import { useEffect, useRef, useState } from 'react';
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

import { usePositions, type Position } from '@/hooks/usePositions';
import { useToast } from '@/hooks/useToast';
import { isValidSymbol, normalizeSymbol, parseOCC } from '@/lib/yahoo';
import { cn } from '@/lib/utils';

const equitySchema = z.object({
  kind: z.literal('equity'),
  symbol: z
    .string()
    .trim()
    .transform(normalizeSymbol)
    .refine(isValidSymbol, 'Invalid ticker symbol'),
  quantity: z.coerce.number().positive('Quantity must be > 0'),
  avgCost: z.coerce.number().positive('Average cost must be > 0'),
  note: z.string().trim().optional(),
});

const optionSchema = z.object({
  kind: z.literal('option'),
  contract: z
    .string()
    .trim()
    .transform((s) => s.toUpperCase())
    .refine((s) => Boolean(parseOCC(s)), 'Invalid OCC contract, e.g. AAPL260919C00200000'),
  quantity: z.coerce.number().positive('Quantity must be > 0'),
  avgCost: z.coerce.number().positive('Average cost must be > 0'),
  note: z.string().trim().optional(),
});

const schema = z.discriminatedUnion('kind', [equitySchema, optionSchema]);

interface AddPositionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, the dialog edits this position instead of adding a new one. */
  editPosition?: Position | null;
}

export function AddPositionDialog({ open, onOpenChange, editPosition }: AddPositionDialogProps) {
  const [kind, setKind] = useState<'equity' | 'option'>('equity');
  const [symbol, setSymbol] = useState('');
  const [contract, setContract] = useState('');
  const [quantity, setQuantity] = useState('');
  const [avgCost, setAvgCost] = useState('');
  const [totalCost, setTotalCost] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const lastCostEdit = useRef<'avg' | 'total'>('total');

  const { positions, save } = usePositions();
  const { toast } = useToast();

  // Prefill fields when opening in edit mode.
  useEffect(() => {
    if (open && editPosition) {
      setKind(editPosition.contract ? 'option' : 'equity');
      setSymbol(editPosition.symbol ?? '');
      setContract(editPosition.contract ?? '');
      setQuantity(String(editPosition.quantity ?? ''));
      setAvgCost(String(editPosition.avgCost ?? ''));
      setTotalCost(String((editPosition.avgCost ?? 0) * (editPosition.quantity ?? 0) || ''));
      setNote(editPosition.note ?? '');
      setError(null);
      lastCostEdit.current = 'avg';
    }
  }, [open, editPosition]);

  // Total cost → average cost (total ÷ quantity).
  useEffect(() => {
    const q = Number(quantity);
    const t = Number(totalCost);
    if (q > 0 && Number.isFinite(t) && t >= 0 && lastCostEdit.current === 'total') {
      setAvgCost(String(+(t / q).toFixed(4)));
    }
  }, [quantity, totalCost]);

  // Average cost → total cost (average × quantity).
  useEffect(() => {
    const q = Number(quantity);
    const a = Number(avgCost);
    if (q > 0 && Number.isFinite(a) && a >= 0 && lastCostEdit.current === 'avg') {
      setTotalCost(String(+(a * q).toFixed(2)));
    }
  }, [quantity, avgCost]);

  const reset = () => {
    setKind('equity');
    setSymbol('');
    setContract('');
    setQuantity('');
    setAvgCost('');
    setTotalCost('');
    setNote('');
    setError(null);
    lastCostEdit.current = 'total';
  };

  const submit = async () => {
    const result = schema.safeParse(
      kind === 'equity'
        ? { kind, symbol, quantity, avgCost, note }
        : { kind, contract, quantity, avgCost, note },
    );
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Invalid input');
      return;
    }
    const data = result.data;

    let position: Position;
    if (data.kind === 'equity') {
      position = {
        symbol: data.symbol,
        quantity: data.quantity,
        avgCost: data.avgCost,
        note: data.note || undefined,
      };
    } else {
      const parsed = parseOCC(data.contract);
      position = {
        symbol: parsed?.symbol ?? '',
        contract: data.contract,
        strike: parsed?.strike,
        expiry: parsed?.date,
        optionType: parsed?.type,
        quantity: data.quantity,
        avgCost: data.avgCost,
        note: data.note || undefined,
      };
    }

    setSaving(true);
    try {
      const next = editPosition
        ? positions.map((p) => (p === editPosition ? position : p))
        : [...positions, position];
      await save(next);
      toast({
        title: editPosition ? 'Position updated' : 'Position saved',
        description: position.contract ?? position.symbol,
      });
      reset();
      onOpenChange(false);
    } catch {
      toast({ title: 'Failed to save position', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono">{editPosition ? 'EDIT POSITION' : 'ADD POSITION'}</DialogTitle>
          <DialogDescription>
            {editPosition
              ? 'Update this position — changes sync to Nostr (kind 30078).'
              : 'Track shares, ounces or coins you own. Stored on Nostr (kind 30078) — private to your npub.'}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={kind} onValueChange={(v) => setKind(v as 'equity' | 'option')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="equity" className="font-mono text-xs">STOCK</TabsTrigger>
            <TabsTrigger value="option" className="font-mono text-xs">OPTION</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="space-y-3">
          {kind === 'equity' ? (
            <div className="space-y-2">
              <Label htmlFor="pos-symbol" className="font-mono text-[11px] text-muted-foreground">SYMBOL</Label>
              <Input
                id="pos-symbol"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="AAPL, GC=F, BTC-USD…"
                className="font-mono uppercase"
              />
              <div className="flex flex-wrap gap-1.5">
                {[
                  ['GOLD', 'GC=F'],
                  ['SILVER', 'SI=F'],
                  ['BITCOIN', 'BTC-USD'],
                  ['ETHEREUM', 'ETH-USD'],
                ].map(([label, sym]) => (
                  <button
                    key={sym}
                    type="button"
                    onClick={() => setSymbol(sym)}
                    className={cn(
                      'rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold transition-colors',
                      symbol === sym
                        ? 'border-signal bg-signal/15 text-signal'
                        : 'border-border text-muted-foreground hover:text-signal',
                    )}
                  >
                    {label} · {sym}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Shares, commodities (ounces) and crypto (coins) — enter quantity + total value and the
                per-unit average fills in automatically.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="pos-contract" className="font-mono text-[11px] text-muted-foreground">OCC CONTRACT</Label>
              <Input
                id="pos-contract"
                value={contract}
                onChange={(e) => setContract(e.target.value.toUpperCase())}
                placeholder="AAPL260919C00200000"
                className="font-mono uppercase"
              />
              <p className="text-[11px] text-muted-foreground">
                OCC format: SYMBOL + YYMMDD + C/P + 8-digit strike. Find it on the stock page's Options tab.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="pos-qty" className="font-mono text-[11px] text-muted-foreground">
                {kind === 'option' ? 'CONTRACTS' : 'SHARES'}
              </Label>
              <Input
                id="pos-qty"
                type="number"
                min="0"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="10"
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pos-cost" className="font-mono text-[11px] text-muted-foreground">
                {kind === 'option' ? 'AVG PRICE / CONTRACT' : 'AVG PRICE / UNIT'}
              </Label>
              <Input
                id="pos-cost"
                type="number"
                min="0"
                step="any"
                value={avgCost}
                onChange={(e) => {
                  lastCostEdit.current = 'avg';
                  setAvgCost(e.target.value);
                }}
                placeholder="180.50"
                className="font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="pos-total" className="font-mono text-[11px] text-muted-foreground">TOTAL VALUE ($)</Label>
              <Input
                id="pos-total"
                type="number"
                min="0"
                step="any"
                value={totalCost}
                onChange={(e) => {
                  lastCostEdit.current = 'total';
                  setTotalCost(e.target.value);
                }}
                placeholder="Enter total value…"
                className="font-mono"
              />
              <p className="text-[10px] text-muted-foreground">Total value of the lot — per-unit average fills in</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pos-note" className="font-mono text-[11px] text-muted-foreground">NOTE (OPTIONAL)</Label>
              <Input
                id="pos-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Why you bought it, thesis, exit plan…"
              />
            </div>
          </div>

          {error ? <p className="text-xs text-loss">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving} className="bg-signal text-signal-foreground hover:bg-signal/90">
            {saving ? 'Saving…' : editPosition ? 'Save changes' : 'Save position'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
