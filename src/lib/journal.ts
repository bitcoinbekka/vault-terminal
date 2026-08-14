/**
 * Trade journal engine — FIFO cost-basis accounting.
 *
 * Buys open lots; sells match the oldest open lots first (FIFO). From that we
 * derive realized P/L, win rate, average hold time, and open lots per symbol.
 */

export interface Trade {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  /** Unix seconds. */
  date: number;
  fees?: number;
  note?: string;
}

interface Lot {
  qty: number;
  price: number;
  date: number;
}

export interface JournalStats {
  /** Gross realized P/L (before fees). */
  realizedPnl: number;
  /** Sum of all trade fees. */
  fees: number;
  /** Net realized P/L = realizedPnl - fees. */
  netRealizedPnl: number;
  /** Percent of closed sell events with positive P/L, or null if none. */
  winRate: number | null;
  /** Average hold time in days (quantity-weighted), or null. */
  avgHoldDays: number | null;
  /** Number of sell events. */
  closedCount: number;
  /** Number of trade entries. */
  tradeCount: number;
  /** Shares still held per symbol (FIFO remainder). */
  openLots: Map<string, number>;
  /** Realized P/L per symbol. */
  realizedPerSymbol: Map<string, number>;
}

export function computeJournal(trades: Trade[]): JournalStats {
  const sorted = [...trades].sort((a, b) => a.date - b.date);
  const lots = new Map<string, Lot[]>();

  let realizedPnl = 0;
  let fees = 0;
  const realizedPerSymbol = new Map<string, number>();
  let wins = 0;
  let closed = 0;
  let holdWeight = 0;
  let holdDaysTotal = 0;

  for (const t of sorted) {
    fees += t.fees ?? 0;

    if (t.side === 'buy') {
      const symLots = lots.get(t.symbol) ?? [];
      symLots.push({ qty: t.quantity, price: t.price, date: t.date });
      lots.set(t.symbol, symLots);
    } else {
      const symLots = lots.get(t.symbol) ?? [];
      let remaining = t.quantity;
      let sellPnl = 0;
      let sellHoldWeight = 0;
      let sellHoldDays = 0;

      while (remaining > 0 && symLots.length > 0) {
        const lot = symLots[0];
        const matched = Math.min(remaining, lot.qty);
        sellPnl += (t.price - lot.price) * matched;
        sellHoldWeight += matched;
        sellHoldDays += (t.date - lot.date) * matched;
        lot.qty -= matched;
        if (lot.qty <= 0) symLots.shift();
        remaining -= matched;
      }

      realizedPnl += sellPnl;
      realizedPerSymbol.set(t.symbol, (realizedPerSymbol.get(t.symbol) ?? 0) + sellPnl);
      closed++;
      if (sellPnl > 0) wins++;
      if (sellHoldWeight > 0) {
        holdWeight += sellHoldWeight;
        holdDaysTotal += sellHoldDays;
      }
    }
  }

  const openLots = new Map<string, number>();
  for (const [symbol, symLots] of lots) {
    const total = symLots.reduce((sum, lot) => sum + lot.qty, 0);
    if (total > 0) openLots.set(symbol, total);
  }

  return {
    realizedPnl,
    fees,
    netRealizedPnl: realizedPnl - fees,
    winRate: closed > 0 ? (wins / closed) * 100 : null,
    avgHoldDays: holdWeight > 0 ? holdDaysTotal / holdWeight / 86400 : null,
    closedCount: closed,
    tradeCount: trades.length,
    openLots,
    realizedPerSymbol,
  };
}

/** Human-friendly hold time: "3d", "2w", "5mo", "1.2y". */
export function formatHoldTime(days: number): string {
  if (days < 1) return `${Math.round(days * 24)}h`;
  if (days < 30) return `${days.toFixed(1)}d`;
  if (days < 365) return `${(days / 30.4).toFixed(1)}mo`;
  return `${(days / 365).toFixed(1)}y`;
}
