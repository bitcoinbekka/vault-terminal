/**
 * Options math: expected move, breakevens and payoff diagrams.
 * All inputs are per-contract; quantities/×100 are applied by callers.
 */

import type { OptionRow } from './yahoo';

/** Mid price when both bid/ask are live, otherwise last trade. */
export function optionMid(o: { bid: number; ask: number; last_trade_price: number }): number {
  if (o.bid > 0 && o.ask > 0) return (o.bid + o.ask) / 2;
  return o.last_trade_price;
}

/**
 * Expected move to expiry, as a percent of the underlying, from the ATM
 * straddle (call mid + put mid at the nearest strike). Approximates 1σ.
 */
export function expectedMove(
  bucket: { calls: OptionRow[]; puts: OptionRow[] } | undefined,
  underlyingPrice: number | null,
): number | null {
  if (!bucket || bucket.calls.length === 0 || !underlyingPrice || underlyingPrice <= 0) return null;

  let atm: OptionRow | null = null;
  for (const c of bucket.calls) {
    if (!atm || Math.abs(c.parsed.strike - underlyingPrice) < Math.abs(atm.parsed.strike - underlyingPrice)) {
      atm = c;
    }
  }
  if (!atm) return null;

  const put = bucket.puts.find((p) => p.parsed.strike === atm.parsed.strike);
  if (!put) return null;

  const straddle = optionMid(atm) + optionMid(put);
  if (straddle <= 0) return null;
  return (straddle / underlyingPrice) * 100;
}

/** Price at which an option position breaks even at expiry. */
export function optionBreakeven(type: 'C' | 'P', strike: number, cost: number): number {
  return type === 'C' ? strike + cost : strike - cost;
}

/** Per-contract P/L at expiry for an underlying price. */
export function payoffAtExpiry(type: 'C' | 'P', strike: number, cost: number, price: number): number {
  const intrinsic = type === 'C' ? Math.max(0, price - strike) : Math.max(0, strike - price);
  return intrinsic - cost;
}

/** Max profit per contract at expiry (null = unlimited, for calls). */
export function optionMaxProfit(type: 'C' | 'P', strike: number, cost: number): number | null {
  if (type === 'C') return null;
  return Math.max(0, strike - cost);
}

/** Max loss per contract at expiry. */
export function optionMaxLoss(_type: 'C' | 'P', _strike: number, cost: number): number {
  return cost;
}
