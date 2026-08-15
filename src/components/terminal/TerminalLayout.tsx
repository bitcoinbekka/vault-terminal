import { useEffect, useMemo, useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { Activity } from 'lucide-react';

import { LoginArea } from '@/components/auth/LoginArea';
import { cn } from '@/lib/utils';
import { TickerTape } from './TickerTape';
import { AlertBell } from './AlertBell';
import { AlertWatcher } from './AlertWatcher';
import { CommandBar } from './CommandBar';

/** New York market clock + session badge. */
function MarketClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const parts = useMemo(() => {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      weekday: 'short',
    });
    return fmt.formatToParts(now);
  }, [now]);

  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
  const mins = hour * 60 + minute;
  const isWeekend = weekday === 'Sat' || weekday === 'Sun';
  const isOpen = !isWeekend && mins >= 570 && mins < 960;
  const time = parts
    .filter((p) => ['hour', 'minute', 'second'].includes(p.type))
    .map((p) => p.value)
    .join(':');

  return (
    <div className="hidden items-center gap-2 font-mono text-xs md:flex">
      <span className="tabular-nums text-foreground/80">{time} ET</span>
      <span
        className={cn(
          'rounded px-1.5 py-0.5 font-bold tracking-wider',
          isOpen ? 'bg-gain/15 text-gain' : 'bg-muted text-muted-foreground',
        )}
      >
        {isOpen ? 'OPEN' : 'CLOSED'}
      </span>
    </div>
  );
}

export function TerminalLayout() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex h-12 items-center gap-3 px-3 sm:px-4">
          <Link to="/" className="flex items-center gap-2 font-mono text-sm font-bold tracking-widest">
            <span className="grid size-7 place-items-center rounded-sm bg-signal text-signal-foreground">
              <Activity className="size-4" />
            </span>
            <span className="hidden sm:inline">VAULT</span>
            <span className="text-signal">//</span>
            <span className="text-muted-foreground">TERMINAL</span>
          </Link>

          <nav className="ml-4 hidden items-center gap-1 sm:flex">
            <Link
              to="/"
              className="rounded px-2 py-1 text-xs font-semibold tracking-wider text-muted-foreground hover:text-foreground"
            >
              TERMINAL
            </Link>
            <Link
              to="/screener"
              className="rounded px-2 py-1 text-xs font-semibold tracking-wider text-muted-foreground hover:text-foreground"
            >
              EQS
            </Link>
            <Link
              to="/sizer"
              className="rounded px-2 py-1 text-xs font-semibold tracking-wider text-muted-foreground hover:text-foreground"
            >
              SIZER
            </Link>
            <Link
              to="/journal"
              className="rounded px-2 py-1 text-xs font-semibold tracking-wider text-muted-foreground hover:text-foreground"
            >
              JOURNAL
            </Link>
          </nav>

          <CommandBar />

          <div className="ml-auto flex items-center gap-3">
            <MarketClock />
            <AlertBell />
            <LoginArea className="max-w-56" />
          </div>
        </div>
        <TickerTape />
        <AlertWatcher />
      </header>

      <main className="mx-auto w-full max-w-[1600px] px-3 py-4 sm:px-4 sm:py-6">
        <Outlet />
      </main>

      <footer className="border-t border-border py-6">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-2 px-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl">
            Market data via Yahoo Finance &amp; CBOE (delayed, not real-time). Nothing here is financial
            advice. Your watchlist &amp; positions live on the Nostr network — they follow your npub,
            not this app.
          </p>
          <a
            href="https://shakespeare.diy"
            target="_blank"
            rel="noreferrer"
            className="shrink-0 font-medium hover:text-foreground"
          >
            Vibed with Shakespeare
          </a>
        </div>
      </footer>
    </div>
  );
}
