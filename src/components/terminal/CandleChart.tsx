import { useEffect, useMemo, useRef, useState } from 'react';

import type { Candle } from '@/lib/yahoo';
import { Bollinger, EMA, MACD, RSI, SMA, VWAP, type IndicatorValue } from '@/lib/indicators';
import { decimalsForPrice, formatCompact, formatDate, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface ChartOverlays {
  sma?: boolean;
  ema?: boolean;
  bollinger?: boolean;
  vwap?: boolean;
  rsi?: boolean;
  macd?: boolean;
}

interface CandleChartProps {
  candles: Candle[];
  height?: number;
  className?: string;
  overlays?: ChartOverlays;
}

const PAD = { top: 12, right: 64, bottom: 22, left: 10 };
const VOL_H = 42;
const STRIP_H = 64;
const STRIP_GAP = 6;

// Indicator line colors (readable on the dark terminal background)
const COLORS = {
  sma: '#38bdf8',
  ema: '#a78bfa',
  boll: '#94a3b8',
  vwap: '#22d3ee',
  rsi: '#fbbf24',
  macd: '#38bdf8',
  macdSignal: '#f472b6',
};

function useContainerWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    const ro = new ResizeObserver(update);
    ro.observe(el);
    const frame = requestAnimationFrame(update);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  return { ref, width };
}

function toPolyline(
  arr: IndicatorValue[],
  xCenter: (i: number) => number,
  y: (v: number) => number,
): string {
  return arr
    .map((v, i) => (v === null ? null : `${xCenter(i).toFixed(1)},${y(v).toFixed(1)}`))
    .filter((p): p is string => p !== null)
    .join(' ');
}

/** Terminal-style candlestick chart with volume, indicators and crosshair. */
export function CandleChart({ candles, height = 340, className, overlays = {} }: CandleChartProps) {
  const { ref, width } = useContainerWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const plot = useMemo(() => {
    if (candles.length === 0) return null;

    const closes = candles.map((c) => c.c);
    const rsiOn = Boolean(overlays.rsi);
    const macdOn = Boolean(overlays.macd);
    const stripCount = (rsiOn ? 1 : 0) + (macdOn ? 1 : 0);
    const stripSpace = stripCount * (STRIP_H + STRIP_GAP);

    // Compute overlays (price-scaled + strips)
    const sma = overlays.sma ? SMA(closes, 20) : null;
    const ema = overlays.ema ? EMA(closes, 50) : null;
    const boll = overlays.bollinger ? Bollinger(closes, 20, 2) : null;
    const vwap = overlays.vwap ? VWAP(candles) : null;
    const rsi = rsiOn ? RSI(closes, 14) : null;
    const macd = macdOn ? MACD(closes) : null;

    let min = Infinity;
    let max = -Infinity;
    let maxVol = 0;
    for (const c of candles) {
      if (c.l < min) min = c.l;
      if (c.h > max) max = c.h;
      if (c.v > maxVol) maxVol = c.v;
    }
    const include = (v: IndicatorValue) => {
      if (v !== null) {
        if (v < min) min = v;
        if (v > max) max = v;
      }
    };
    sma?.forEach(include);
    ema?.forEach(include);
    boll?.upper.forEach(include);
    boll?.lower.forEach(include);
    vwap?.forEach(include);

    const pad = (max - min) * 0.06 || max * 0.01 || 1;
    min -= pad;
    max += pad;

    const W = Math.max(width, 300);
    const H = height + stripSpace;
    const plotBottom = H - PAD.bottom - VOL_H - 8 - stripSpace;
    const plotTop = PAD.top;
    const plotH = plotBottom - plotTop;
    const plotW = W - PAD.left - PAD.right;

    const n = candles.length;
    const step = plotW / n;
    const bodyW = Math.max(1.5, step * 0.62);

    const y = (v: number) => plotTop + (1 - (v - min) / (max - min)) * plotH;
    const xCenter = (i: number) => PAD.left + step * i + step / 2;

    const span = candles[candles.length - 1].t - candles[0].t;
    const intraday = span < 48 * 3600;

    const gridLines = [0, 0.25, 0.5, 0.75, 1].map((f) => {
      const v = min + (max - min) * f;
      return { y: y(v), price: v };
    });

    const tickCount = Math.min(6, n);
    const tickStep = Math.max(1, Math.floor(n / tickCount));
    const ticks = candles
      .map((c, i) => ({ c, i }))
      .filter((_, i) => i % tickStep === 0)
      .map(({ c, i }) => ({
        x: xCenter(i),
        label: intraday ? formatTime(c.t) : formatDate(c.t),
      }));
    if (ticks.length === 0 && candles[0]) {
      ticks.push({ x: xCenter(0), label: intraday ? formatTime(candles[0].t) : formatDate(candles[0].t) });
    }

    const last = candles[candles.length - 1];
    const lastY = y(last.c);

    const overlayLines: { points: string; color: string; opacity: number }[] = [];
    if (sma) overlayLines.push({ points: toPolyline(sma, xCenter, y), color: COLORS.sma, opacity: 0.95 });
    if (ema) overlayLines.push({ points: toPolyline(ema, xCenter, y), color: COLORS.ema, opacity: 0.95 });
    if (boll) {
      overlayLines.push({ points: toPolyline(boll.upper, xCenter, y), color: COLORS.boll, opacity: 0.55 });
      overlayLines.push({ points: toPolyline(boll.lower, xCenter, y), color: COLORS.boll, opacity: 0.55 });
      overlayLines.push({ points: toPolyline(boll.middle, xCenter, y), color: COLORS.boll, opacity: 0.8 });
    }
    if (vwap) overlayLines.push({ points: toPolyline(vwap, xCenter, y), color: COLORS.vwap, opacity: 0.95 });

    // Strips
    const strips: Array<{
      type: 'rsi' | 'macd';
      top: number;
      values?: IndicatorValue[];
      macdData?: ReturnType<typeof MACD>;
      rsiValue?: number | null;
      macdValue?: number | null;
    }> = [];
    let cursorY = plotBottom + VOL_H + 8 + STRIP_GAP;
    if (rsi) {
      const lastVal = rsi[n - 1];
      strips.push({ type: 'rsi', top: cursorY, values: rsi, rsiValue: lastVal });
      cursorY += STRIP_H + STRIP_GAP;
    }
    if (macd) {
      const lastVal = macd.macd[n - 1];
      strips.push({ type: 'macd', top: cursorY, macdData: macd, macdValue: lastVal });
      cursorY += STRIP_H + STRIP_GAP;
    }

    return {
      W,
      H,
      plotTop,
      plotBottom,
      plotW,
      y,
      xCenter,
      step,
      bodyW,
      gridLines,
      ticks,
      lastY,
      last,
      n,
      maxVol,
      intraday,
      overlayLines,
      strips,
      // data for the tooltip
      tooltip: { sma, ema, rsi, macd },
    };
  }, [candles, width, height, overlays]);

  if (!plot) {
    return (
      <div
        ref={ref}
        className={cn('flex items-center justify-center text-muted-foreground text-sm', className)}
        style={{ height }}
      >
        No chart data
      </div>
    );
  }

  const decimals = decimalsForPrice(plot.last.c);
  const lastColor = plot.last.c >= (candles[0]?.o ?? plot.last.c) ? 'var(--gain)' : 'var(--loss)';
  const hovered = hover !== null && hover >= 0 && hover < candles.length ? candles[hover] : null;

  const hoverSma = plot.tooltip.sma?.[hover ?? -1] ?? null;
  const hoverRsi = plot.tooltip.rsi?.[hover ?? -1] ?? null;
  const hoverMacd = plot.tooltip.macd?.macd[hover ?? -1] ?? null;

  return (
    <div ref={ref} className={cn('relative w-full', className)} style={{ height: plot.H }}>
      <svg
        width={plot.W}
        height={plot.H}
        viewBox={`0 0 ${plot.W} ${plot.H}`}
        role="img"
        aria-label="Price chart"
      >
        {/* grid */}
        {plot.gridLines.map((g, i) => (
          <g key={`g-${i}`}>
            <line
              x1={PAD.left}
              x2={plot.W - PAD.right}
              y1={g.y}
              y2={g.y}
              stroke="currentColor"
              strokeOpacity={0.08}
              strokeDasharray="3 4"
            />
            <text
              x={plot.W - PAD.right + 6}
              y={g.y + 3}
              fontSize={10}
              fill="currentColor"
              opacity={0.55}
              fontFamily="var(--font-mono)"
            >
              {g.price.toFixed(decimals)}
            </text>
          </g>
        ))}

        {/* volume bars */}
        {candles.map((c, i) => {
          const vh = plot.maxVol > 0 ? (c.v / plot.maxVol) * VOL_H : 0;
          const up = c.c >= c.o;
          return (
            <rect
              key={`v-${i}`}
              x={plot.xCenter(i) - plot.bodyW / 2}
              y={plot.plotBottom + VOL_H - vh}
              width={plot.bodyW}
              height={Math.max(0.5, vh)}
              fill={up ? 'var(--gain)' : 'var(--loss)'}
              opacity={0.25}
            />
          );
        })}

        {/* candlesticks */}
        {candles.map((c, i) => {
          const up = c.c >= c.o;
          const color = up ? 'var(--gain)' : 'var(--loss)';
          const bodyTop = plot.y(Math.max(c.o, c.c));
          const bodyBottom = plot.y(Math.min(c.o, c.c));
          const bodyH = Math.max(1, bodyBottom - bodyTop);
          const x = plot.xCenter(i) - plot.bodyW / 2;
          return (
            <g key={`c-${i}`}>
              <line
                x1={plot.xCenter(i)}
                x2={plot.xCenter(i)}
                y1={plot.y(c.h)}
                y2={plot.y(c.l)}
                stroke={color}
                strokeWidth={1}
              />
              <rect
                x={x}
                y={bodyTop}
                width={plot.bodyW}
                height={bodyH}
                fill={up ? color : 'var(--card)'}
                stroke={color}
                strokeWidth={1}
              />
            </g>
          );
        })}

        {/* indicator overlays (price-scaled) */}
        {plot.overlayLines.map((line, i) => (
          <polyline
            key={`ol-${i}`}
            points={line.points}
            fill="none"
            stroke={line.color}
            strokeWidth={1.2}
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity={line.opacity}
          />
        ))}

        {/* last price line */}
        <line
          x1={PAD.left}
          x2={plot.W - PAD.right}
          y1={plot.lastY}
          y2={plot.lastY}
          stroke="var(--signal)"
          strokeWidth={1}
          strokeDasharray="4 3"
          opacity={0.8}
        />
        <rect
          x={plot.W - PAD.right + 2}
          y={plot.lastY - 9}
          width={PAD.right - 4}
          height={18}
          rx={2}
          fill="var(--signal)"
        />
        <text
          x={plot.W - PAD.right + PAD.right / 2}
          y={plot.lastY + 3.5}
          fontSize={10}
          textAnchor="middle"
          fill="var(--signal-foreground)"
          fontFamily="var(--font-mono)"
          fontWeight={700}
        >
          {plot.last.c.toFixed(decimals)}
        </text>

        {/* RSI strip */}
        {plot.strips
          .filter((s) => s.type === 'rsi')
          .map((s) => {
            const top = s.top;
            const rsiY = (v: number) => top + (1 - v / 100) * (STRIP_H - 14);
            const points = (s.values ?? [])
              .map((v, i) => (v === null ? null : `${plot.xCenter(i).toFixed(1)},${rsiY(v).toFixed(1)}`))
              .filter((p): p is string => p !== null)
              .join(' ');
            return (
              <g key="rsi-strip">
                <line x1={PAD.left} x2={plot.W - PAD.right} y1={top} y2={top} stroke="currentColor" strokeOpacity={0.15} />
                <line x1={PAD.left} x2={plot.W - PAD.right} y1={rsiY(30)} y2={rsiY(30)} stroke="var(--loss)" strokeOpacity={0.3} strokeDasharray="3 4" />
                <line x1={PAD.left} x2={plot.W - PAD.right} y1={rsiY(70)} y2={rsiY(70)} stroke="var(--gain)" strokeOpacity={0.3} strokeDasharray="3 4" />
                <polyline points={points} fill="none" stroke={COLORS.rsi} strokeWidth={1.2} strokeLinejoin="round" />
                <text x={PAD.left + 4} y={top + 11} fontSize={10} fill={COLORS.rsi} fontFamily="var(--font-mono)" fontWeight={700}>
                  RSI 14 {s.rsiValue !== null && s.rsiValue !== undefined ? s.rsiValue.toFixed(1) : '—'}
                </text>
              </g>
            );
          })}

        {/* MACD strip */}
        {plot.strips
          .filter((s) => s.type === 'macd')
          .map((s) => {
            const top = s.top;
            const d = s.macdData;
            if (!d) return null;
            let maxAbs = 0;
            for (const arr of [d.macd, d.signal, d.histogram]) {
              for (const v of arr) {
                if (v !== null && Math.abs(v) > maxAbs) maxAbs = Math.abs(v);
              }
            }
            const scale = maxAbs || 1;
            const midY = top + (STRIP_H - 14) / 2;
            const macdY = (v: number) => midY - (v / scale) * ((STRIP_H - 14) / 2 - 2);
            const macdPoints = d.macd
              .map((v, i) => (v === null ? null : `${plot.xCenter(i).toFixed(1)},${macdY(v).toFixed(1)}`))
              .filter((p): p is string => p !== null)
              .join(' ');
            const signalPoints = d.signal
              .map((v, i) => (v === null ? null : `${plot.xCenter(i).toFixed(1)},${macdY(v).toFixed(1)}`))
              .filter((p): p is string => p !== null)
              .join(' ');
            return (
              <g key="macd-strip">
                <line x1={PAD.left} x2={plot.W - PAD.right} y1={top} y2={top} stroke="currentColor" strokeOpacity={0.15} />
                <line x1={PAD.left} x2={plot.W - PAD.right} y1={midY} y2={midY} stroke="currentColor" strokeOpacity={0.25} strokeDasharray="3 4" />
                {d.histogram.map((v, i) =>
                  v === null ? null : (
                    <rect
                      key={`mh-${i}`}
                      x={plot.xCenter(i) - plot.bodyW / 2}
                      y={v >= 0 ? macdY(v) : midY}
                      width={plot.bodyW}
                      height={Math.max(0.5, Math.abs(macdY(v) - midY))}
                      fill={v >= 0 ? 'var(--gain)' : 'var(--loss)'}
                      opacity={0.5}
                    />
                  ),
                )}
                <polyline points={macdPoints} fill="none" stroke={COLORS.macd} strokeWidth={1.2} strokeLinejoin="round" />
                <polyline points={signalPoints} fill="none" stroke={COLORS.macdSignal} strokeWidth={1.2} strokeLinejoin="round" />
                <text x={PAD.left + 4} y={top + 11} fontSize={10} fill={COLORS.macd} fontFamily="var(--font-mono)" fontWeight={700}>
                  MACD {s.macdValue !== null && s.macdValue !== undefined ? s.macdValue.toFixed(2) : '—'}
                </text>
              </g>
            );
          })}

        {/* time labels */}
        {plot.ticks.map((t, i) => (
          <text
            key={`t-${i}`}
            x={Math.min(Math.max(t.x, PAD.left + 20), plot.W - PAD.right - 20)}
            y={plot.H - 6}
            fontSize={10}
            textAnchor="middle"
            fill="currentColor"
            opacity={0.55}
            fontFamily="var(--font-mono)"
          >
            {t.label}
          </text>
        ))}

        {/* crosshair */}
        {hover !== null && (
          <line
            x1={plot.xCenter(hover)}
            x2={plot.xCenter(hover)}
            y1={plot.plotTop}
            y2={plot.H - PAD.bottom}
            stroke="var(--signal)"
            strokeWidth={1}
            opacity={0.6}
            strokeDasharray="3 3"
          />
        )}

        {/* hit area */}
        <rect
          x={PAD.left}
          y={plot.plotTop}
          width={plot.plotW}
          height={plot.H - PAD.bottom - plot.plotTop}
          fill="transparent"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left; // relative to the hit rect (starts at PAD.left)
            const idx = Math.floor(x / plot.step);
            setHover(Math.max(0, Math.min(plot.n - 1, idx)));
          }}
          onMouseLeave={() => setHover(null)}
        />
      </svg>

      {/* tooltip */}
      {hovered && (
        <div className="pointer-events-none absolute top-2 right-2 z-10 rounded-md border border-border bg-background/95 px-3 py-2 font-mono text-[11px] shadow-md backdrop-blur">
          <div className="mb-1 flex items-center gap-2">
            <span
              className="inline-block size-2 rounded-full"
              style={{ background: hovered.c >= hovered.o ? 'var(--gain)' : 'var(--loss)' }}
            />
            <span className="text-muted-foreground">
              {plot.intraday ? formatTime(hovered.t) : formatDate(hovered.t)}
            </span>
          </div>
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
            <span className="text-muted-foreground">O</span>
            <span>{hovered.o.toFixed(decimals)}</span>
            <span className="text-muted-foreground">H</span>
            <span style={{ color: 'var(--gain)' }}>{hovered.h.toFixed(decimals)}</span>
            <span className="text-muted-foreground">L</span>
            <span style={{ color: 'var(--loss)' }}>{hovered.l.toFixed(decimals)}</span>
            <span className="text-muted-foreground">C</span>
            <span style={{ color: lastColor }}>{hovered.c.toFixed(decimals)}</span>
            <span className="text-muted-foreground">VOL</span>
            <span>{formatCompact(hovered.v)}</span>
            {overlays.sma && hoverSma !== null ? (
              <>
                <span className="text-muted-foreground">SMA20</span>
                <span style={{ color: COLORS.sma }}>{hoverSma.toFixed(decimals)}</span>
              </>
            ) : null}
            {overlays.rsi && hoverRsi !== null ? (
              <>
                <span className="text-muted-foreground">RSI14</span>
                <span style={{ color: COLORS.rsi }}>{hoverRsi.toFixed(1)}</span>
              </>
            ) : null}
            {overlays.macd && hoverMacd !== null ? (
              <>
                <span className="text-muted-foreground">MACD</span>
                <span style={{ color: COLORS.macd }}>{hoverMacd.toFixed(2)}</span>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
