import { useDeferredValue, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command, CornerDownLeft, TerminalSquare, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

import { useYahooSearch } from '@/hooks/useYahoo';
import { useToast } from '@/hooks/useToast';
import {
  COMMANDS,
  SYMBOL_COMMANDS,
  isSymbolish,
  resolveSymbol,
  type VaultCommand,
} from '@/lib/commands';
import { cn } from '@/lib/utils';

/** Bloomberg-style <GO> command bar: mnemonic codes + tickers. */
export function CommandBar() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const deferred = useDeferredValue(query);

  const symbolSearchEnabled =
    open && !showHelp && deferred.trim().length >= 2 && !COMMANDS.some((c) => c.code.startsWith(deferred.toUpperCase()));
  const search = useYahooSearch(deferred, symbolSearchEnabled);

  // Global "/" shortcut — opens the command bar unless typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = Boolean(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable));
      if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const close = () => {
    setOpen(false);
    setQuery('');
    setShowHelp(false);
  };

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      // Target is on the dashboard — go home first, then scroll.
      navigate('/');
      setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 250);
    }
  };

  const runCommand = (cmd: VaultCommand) => {
    if (cmd.code === 'HELP') {
      setShowHelp(true);
      setQuery('');
      return;
    }
    close();
    if (cmd.kind === 'route') {
      navigate(cmd.target);
    } else {
      scrollTo(cmd.target);
    }
  };

  const execute = (raw: string) => {
    const input = raw.trim().toUpperCase();
    if (!input) return;

    const parts = input.split(/\s+/);
    const first = parts[0];
    const cmd = COMMANDS.find((c) => c.code === first || c.aliases?.includes(first));

    // "SYMBOL OPTIONS" style: symbol + stock-page function
    if (first && SYMBOL_COMMANDS.has(first) && parts.length >= 2) {
      const sym = resolveSymbol(parts.slice(1).join(' '));
      if (sym) {
        const tab = SYMBOL_COMMANDS.get(first);
        close();
        navigate(`/stock/${sym}${tab && tab !== 'overview' ? `?tab=${tab}` : ''}`);
        return;
      }
    }

    // Plain command
    if (cmd) {
      if (cmd.code === 'HELP') {
        setShowHelp(true);
        setQuery('');
        return;
      }
      runCommand(cmd);
      return;
    }

    // Plain symbol
    const sym = resolveSymbol(input);
    if (sym) {
      close();
      navigate(`/stock/${sym}`);
      return;
    }

    toast({
      title: 'Unknown command',
      description: 'Try a ticker (AAPL <GO>), TOP, EQS, DES or HELP.',
      variant: 'destructive',
    });
  };

  const resolved = query.trim() ? resolveSymbol(query) : null;
  const upperQuery = query.trim().toUpperCase();
  const matchedCommands = query.trim()
    ? COMMANDS.filter(
        (c) => c.code.startsWith(upperQuery) || (c.aliases ?? []).some((a) => a.startsWith(upperQuery)),
      ).slice(0, 6)
    : COMMANDS.slice(0, 6);

  const symbolSuggestions = (search.data?.quotes ?? []).slice(0, 5);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="hidden h-8 gap-1.5 px-2 font-mono text-[11px] text-muted-foreground hover:text-foreground sm:flex"
        onClick={() => setOpen(true)}
        aria-label="Open command bar"
      >
        <TerminalSquare className="size-3.5" />
        <span>&gt;_</span>
        <kbd className="rounded-sm border border-border bg-muted/60 px-1 text-[9px] font-semibold text-muted-foreground">/</kbd>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:text-foreground sm:hidden"
        onClick={() => setOpen(true)}
        aria-label="Open command bar"
      >
        <Command className="size-4" />
      </Button>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!o) close();
        }}
      >
        <DialogContent className="top-[15%] translate-y-0 sm:max-w-xl" showCloseButton={false}>
          <DialogHeader className="hidden">
            <DialogTitle>Command bar</DialogTitle>
            <DialogDescription>Type a ticker or command and press GO.</DialogDescription>
          </DialogHeader>

          {showHelp ? (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-mono text-xs font-bold tracking-widest">HELP &lt;GO&gt; — COMMAND LEGEND</h3>
                <Button variant="ghost" size="icon" className="size-6 text-muted-foreground" onClick={() => setShowHelp(false)} aria-label="Back">
                  <X className="size-4" />
                </Button>
              </div>
              <div className="max-h-[50vh] overflow-y-auto rounded-md border border-border">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-muted/40 font-mono text-[10px] tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">COMMAND</th>
                      <th className="px-3 py-2">NAME</th>
                      <th className="hidden px-3 py-2 sm:table-cell">FUNCTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {COMMANDS.map((c) => (
                      <tr key={c.code}>
                        <td className="px-3 py-1.5 font-mono font-bold text-signal">{c.code} &lt;GO&gt;</td>
                        <td className="px-3 py-1.5 font-medium whitespace-nowrap">{c.name}</td>
                        <td className="hidden px-3 py-1.5 text-muted-foreground sm:table-cell">{c.description}</td>
                      </tr>
                    ))}
                    <tr>
                      <td className="px-3 py-1.5 font-mono font-bold text-signal">TICKER &lt;GO&gt;</td>
                      <td className="px-3 py-1.5 font-medium whitespace-nowrap">Any symbol</td>
                      <td className="hidden px-3 py-1.5 text-muted-foreground sm:table-cell">
                        Open a stock page — try AAPL, ^VIX, BTC-USD, or DES NVDA / OPTIONS NVDA
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-2 font-mono text-[10px] text-muted-foreground">
                SPX→^GSPC · NDX→^IXIC · INDU→^DJI · RTY→^RUT · GOLD→GC=F · BTC→BTC-USD
              </p>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 rounded-md border border-border bg-muted/20 px-3">
                <span className="font-mono text-sm font-bold text-signal">&gt;</span>
                <Input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') execute(query);
                    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault();
                  }}
                  placeholder="Type a ticker or command… e.g. AAPL, TOP, EQS, HELP"
                  className="h-11 border-0 bg-transparent font-mono text-sm shadow-none focus-visible:ring-0 focus-visible:outline-none"
                />
                <button
                  onClick={() => execute(query)}
                  className="shrink-0 rounded-md bg-gain px-2.5 py-1.5 font-mono text-[11px] font-bold tracking-wider text-white transition-colors hover:bg-gain/90"
                  title="Execute (Enter)"
                >
                  &lt;GO&gt;
                </button>
              </div>

              <div className="mt-2 max-h-[40vh] overflow-y-auto">
                {resolved ? (
                  <button
                    onClick={() => execute(query)}
                    className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left transition-colors hover:bg-muted/50"
                  >
                    <span className="flex items-center gap-2">
                      <CornerDownLeft className="size-3.5 text-muted-foreground" />
                      <span className="font-mono text-sm font-bold">{resolved}</span>
                      <span className="text-xs text-muted-foreground">Open &lt;GO&gt;</span>
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">GO</span>
                  </button>
                ) : null}

                {matchedCommands.map((c) => (
                  <button
                    key={c.code}
                    onClick={() => runCommand(c)}
                    className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left transition-colors hover:bg-muted/50"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="w-16 shrink-0 font-mono text-xs font-bold text-signal">{c.code}</span>
                      <span className="truncate text-sm text-foreground">{c.name}</span>
                    </span>
                    <span className="hidden truncate text-[11px] text-muted-foreground sm:inline">{c.description}</span>
                  </button>
                ))}

                {symbolSuggestions.map((q) => (
                  <button
                    key={q.symbol}
                    onClick={() => execute(q.symbol)}
                    className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left transition-colors hover:bg-muted/50"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="w-16 shrink-0 font-mono text-xs font-bold">{q.symbol}</span>
                      <span className="truncate text-sm text-muted-foreground">{q.longname ?? q.shortname}</span>
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{q.exchDisp}</span>
                  </button>
                ))}

                {!resolved && matchedCommands.length === 0 && symbolSuggestions.length === 0 && query.trim() ? (
                  <p className="px-3 py-3 text-xs text-muted-foreground">
                    No matches — try <span className="font-mono">HELP &lt;GO&gt;</span> for commands.
                  </p>
                ) : null}
              </div>

              <p className="mt-2 flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
                <span className={cn('rounded-sm border border-border bg-muted/60 px-1')}>/</span>
                open bar · ENTER = &lt;GO&gt; · try DES AAPL, OPTIONS NVDA, EQS
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
