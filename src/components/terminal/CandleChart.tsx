import { useEffect, useMemo, useRef, useState } from 'react';

import type { Candle } from '@/lib/yahoo';
import { decimalsForPrice, formatCompact, formatDate, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';

interface CandleChartProps {
  candles: Candle[];
  height?: number;
  className?: string;
}

const PAD = { top: 12, right: 64, bottom: 22, left: 10 };
const VOL_H = 42;

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

/** Terminal-style candlestick chart with volume, gridlines and crosshair. */
export function CandleChart({ candles, height = 340, className }: CandleChartProps) {
  const { ref, width } = useContainerWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const plot = useMemo(() => {
    if (candles.length === 0) return null;

    let min = Infinity;
    let max = -Infinity;
    let maxVol = 0;
    for (const c of candles) {
      if (c.l < min) min = c.l;
      if (c.h > max) max = c.h;
      if (c.v > maxVol) maxVol = c.v;
    }
    const pad = (max - min) * 0.06 || max * 0.01 || 1;
    min -= pad;
    max += pad;

    const W = Math.max(width, 300);
    const H = height;
    const plotBottom = H - PAD.bottom - VOL_H - 8;
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
      min,
      max,
    };
  }, [candles, width, height]);

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

  return (
    <div ref={ref} className={cn('relative w-full', className)} style={{ height }}>
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
            y2={plot.plotBottom + VOL_H}
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
          height={plot.plotBottom + VOL_H - plot.plotTop}
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
        <div
          className="pointer-events-none absolute top-2 right-2 z-10 rounded-md border border-border bg-background/95 px-3 py-2 font-mono text-[11px] shadow-md backdrop-blur"
        >
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
          </div>
        </div>
      )}
    </div>
  );
}
