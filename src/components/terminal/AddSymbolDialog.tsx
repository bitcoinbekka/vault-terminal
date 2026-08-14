import { useDeferredValue, useState } from 'react';
import { Loader2, Plus, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { LoginArea } from '@/components/auth/LoginArea';

import { useYahooSearch } from '@/hooks/useYahoo';
import { useWatchlist } from '@/hooks/useWatchlist';
import { useToast } from '@/hooks/useToast';
import { isValidSymbol, normalizeSymbol } from '@/lib/yahoo';

interface AddSymbolDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Search Yahoo symbols and add them to the Nostr-backed watchlist. */
export function AddSymbolDialog({ open, onOpenChange }: AddSymbolDialogProps) {
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);
  const search = useYahooSearch(deferred, open);
  const { watchlist, save, user } = useWatchlist();
  const { toast } = useToast();
  const [pending, setPending] = useState<string | null>(null);

  const add = async (symbol: string) => {
    const normalized = normalizeSymbol(symbol);
    if (!user) {
      toast({ title: 'Not logged in', description: 'Connect your Nostr account to save a watchlist.' });
      return;
    }
    if (watchlist.includes(normalized)) {
      toast({ title: 'Already on your watchlist', description: normalized });
      return;
    }
    setPending(normalized);
    try {
      await save([...watchlist, normalized]);
      toast({ title: 'Added to watchlist', description: normalized });
      setQuery('');
      onOpenChange(false);
    } catch {
      toast({ title: 'Failed to save', description: 'Could not publish to relays. Try again.', variant: 'destructive' });
    } finally {
      setPending(null);
    }
  };

  const manual = normalizeSymbol(query);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono">ADD SYMBOL</DialogTitle>
          <DialogDescription>
            Search equities, indices, ETFs or crypto. Saves to your Nostr watchlist (kind 30078).
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && isValidSymbol(manual)) add(manual);
            }}
            placeholder="e.g. AAPL, NVDA, ^VIX, BTC-USD…"
            className="pl-9 font-mono uppercase"
          />
        </div>

        {!user && (
          <div className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
            <p className="mb-2">Log in with Nostr to sync your watchlist to relays — it will follow your npub anywhere.</p>
            <LoginArea className="w-full" />
          </div>
        )}

        <div className="max-h-64 overflow-y-auto">
          {search.isPending ? (
            <div className="space-y-2 p-1">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : null}

          {search.data?.quotes.map((q) => (
            <button
              key={q.symbol}
              onClick={() => add(q.symbol)}
              disabled={Boolean(pending)}
              className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted/50 disabled:opacity-50"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="font-mono text-sm font-bold">{q.symbol}</span>
                <span className="truncate text-sm text-muted-foreground">
                  {q.longname ?? q.shortname ?? q.typeDisp}
                </span>
              </span>
              <span className="shrink-0">
                {pending === q.symbol ? (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                ) : (
                  <Plus className="size-4 text-muted-foreground" />
                )}
              </span>
            </button>
          ))}

          {query.trim().length > 0 &&
            !search.isPending &&
            isValidSymbol(manual) &&
            !search.data?.quotes.some((q) => q.symbol === manual) && (
              <button
                onClick={() => add(manual)}
                disabled={Boolean(pending)}
                className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted/50 disabled:opacity-50"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="font-mono text-sm font-bold">{manual}</span>
                  <span className="truncate text-sm text-muted-foreground">Add manually</span>
                </span>
                <Plus className="size-4 shrink-0 text-muted-foreground" />
              </button>
            )}

          {query.trim().length > 0 &&
            !search.isPending &&
            !isValidSymbol(manual) &&
            search.data?.quotes.length === 0 && (
              <p className="px-2 py-3 text-sm text-muted-foreground">No matches.</p>
            )}
        </div>

        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
