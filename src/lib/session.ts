/**
 * Extended-hours (pre-market / after-hours) session math.
 *
 * With `includePrePost=true`, the 1D/5m chart includes candles outside the
 * regular session. We classify them against the trading periods in the meta
 * and derive the last pre-market / after-hours price and its % change vs the
 * previous close.
 */

import type { Candle, YahooMeta } from './yahoo';

export interface SessionInfo {
  /** Last pre-market candle close (today's 4:00–9:30 ET session). */
  prePrice: number | null;
  preChangePct: number | null;
  /** Last after-hours candle close (16:00–20:00 ET). */
  postPrice: number | null;
  postChangePct: number | null;
  lastPrice: number | null;
  lastTime: number | null;
  inPre: boolean;
  inPost: boolean;
  inRegular: boolean;
}

const PRE_OPEN_MIN = 9 * 60 + 30; // 9:30 ET
const POST_OPEN_MIN = 16 * 60; // 16:00 ET

export function computeSession(
  candles: Candle[],
  meta?: YahooMeta,
  nowSec = Date.now() / 1000,
): SessionInfo {
  const periods = meta?.currentTradingPeriod;
  const regularStart = periods?.regular?.start;
  const regularEnd = periods?.regular?.end;
  const preStart = periods?.pre?.start;
  const postEnd = periods?.post?.end;
  const gmtoffset = meta?.gmtoffset ?? 0;

  const localMinutes = (t: number) => {
    const d = new Date((t + gmtoffset) * 1000);
    return d.getUTCHours() * 60 + d.getUTCMinutes();
  };

  let preLast: Candle | null = null;
  let postLast: Candle | null = null;

  for (const c of candles) {
    if (regularStart !== undefined) {
      if (c.t < regularStart && (preStart === undefined || c.t >= preStart)) preLast = c;
      else if (regularEnd !== undefined && c.t > regularEnd && (postEnd === undefined || c.t <= postEnd)) postLast = c;
    } else {
      const m = localMinutes(c.t);
      if (m < PRE_OPEN_MIN) preLast = c;
      else if (m >= POST_OPEN_MIN) postLast = c;
    }
  }

  const last = candles.length > 0 ? candles[candles.length - 1] : null;
  const prev = meta ? (meta.chartPreviousClose ?? meta.previousClose ?? null) : null;
  const pct = (p: number | null) => (p !== null && prev ? ((p - prev) / prev) * 100 : null);

  return {
    prePrice: preLast?.c ?? null,
    preChangePct: pct(preLast?.c ?? null),
    postPrice: postLast?.c ?? null,
    postChangePct: pct(postLast?.c ?? null),
    lastPrice: last?.c ?? null,
    lastTime: last?.t ?? null,
    inPre: regularStart !== undefined && nowSec < regularStart,
    inPost: regularEnd !== undefined && nowSec > regularEnd && (postEnd === undefined || nowSec <= postEnd),
    inRegular:
      regularStart !== undefined && regularEnd !== undefined && nowSec >= regularStart && nowSec <= regularEnd,
  };
}
