/**
 * Technical indicators computed from OHLCV candle data.
 * All functions return arrays aligned with the input; leading values are
 * `null` until the series has enough data.
 */

import type { Candle } from './yahoo';

export type IndicatorValue = number | null;

/** Simple moving average. */
export function SMA(values: number[], period: number): IndicatorValue[] {
  const out: IndicatorValue[] = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

/** Exponential moving average (seeded with the SMA of the first period). */
export function EMA(values: number[], period: number): IndicatorValue[] {
  const out: IndicatorValue[] = new Array(values.length).fill(null);
  const k = 2 / (period + 1);
  let prev: number | null = null;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    if (prev === null) {
      sum += values[i];
      if (i >= period - 1) {
        prev = sum / period;
        out[i] = prev;
      }
    } else {
      prev = values[i] * k + prev * (1 - k);
      out[i] = prev;
    }
  }
  return out;
}

/** Relative Strength Index (Wilder's smoothing). */
export function RSI(values: number[], period = 14): IndicatorValue[] {
  const out: IndicatorValue[] = new Array(values.length).fill(null);
  if (values.length <= period) return out;

  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) avgGain += d;
    else avgLoss -= d;
  }
  avgGain /= period;
  avgLoss /= period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    const gain = d > 0 ? d : 0;
    const loss = d < 0 ? -d : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

export interface MacdResult {
  macd: IndicatorValue[];
  signal: IndicatorValue[];
  histogram: IndicatorValue[];
}

/** MACD (12, 26, 9): macd line, signal line, histogram. */
export function MACD(values: number[], fast = 12, slow = 26, signalPeriod = 9): MacdResult {
  const emaFast = EMA(values, fast);
  const emaSlow = EMA(values, slow);

  const macd: IndicatorValue[] = values.map((_, i) => {
    const f = emaFast[i];
    const s = emaSlow[i];
    return f !== null && s !== null ? f - s : null;
  });

  // Signal line = EMA of the macd line, seeded where macd becomes available.
  const seed = macd.findIndex((v) => v !== null);
  const signal: IndicatorValue[] = new Array(values.length).fill(null);
  if (seed !== -1) {
    const k = 2 / (signalPeriod + 1);
    let prev = macd[seed] as number;
    signal[seed] = prev;
    for (let i = seed + 1; i < values.length; i++) {
      const m = macd[i];
      if (m === null) {
        signal[i] = prev;
        continue;
      }
      prev = m * k + prev * (1 - k);
      signal[i] = prev;
    }
  }

  const histogram: IndicatorValue[] = macd.map((m, i) => {
    const s = signal[i];
    return m !== null && s !== null ? m - s : null;
  });

  return { macd, signal, histogram };
}

export interface BollingerResult {
  upper: IndicatorValue[];
  middle: IndicatorValue[];
  lower: IndicatorValue[];
}

/** Bollinger Bands (20, 2): middle = SMA, bands = ± mult × stdev. */
export function Bollinger(values: number[], period = 20, mult = 2): BollingerResult {
  const middle = SMA(values, period);
  const upper: IndicatorValue[] = new Array(values.length).fill(null);
  const lower: IndicatorValue[] = new Array(values.length).fill(null);

  for (let i = period - 1; i < values.length; i++) {
    const m = middle[i] as number;
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += (values[j] - m) ** 2;
    }
    const sd = Math.sqrt(sum / period);
    upper[i] = m + mult * sd;
    lower[i] = m - mult * sd;
  }

  return { upper, middle, lower };
}

/** Cumulative volume-weighted average price from the start of the series. */
export function VWAP(candles: Candle[]): IndicatorValue[] {
  const out: IndicatorValue[] = new Array(candles.length).fill(null);
  let cumPV = 0;
  let cumV = 0;
  for (let i = 0; i < candles.length; i++) {
    const { h, l, c, v } = candles[i];
    const tp = (h + l + c) / 3;
    cumPV += tp * v;
    cumV += v;
    out[i] = cumV > 0 ? cumPV / cumV : null;
  }
  return out;
}
