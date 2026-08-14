import type { ChartOverlays } from './CandleChart';
import { cn } from '@/lib/utils';

const TOGGLES: { key: keyof ChartOverlays; label: string }[] = [
  { key: 'sma', label: 'SMA 20' },
  { key: 'ema', label: 'EMA 50' },
  { key: 'bollinger', label: 'BOLL' },
  { key: 'vwap', label: 'VWAP' },
  { key: 'rsi', label: 'RSI 14' },
  { key: 'macd', label: 'MACD' },
];

interface IndicatorToolbarProps {
  value: ChartOverlays;
  onChange: (next: ChartOverlays) => void;
  className?: string;
}

/** Toggle chips for chart indicator overlays. */
export function IndicatorToolbar({ value, onChange, className }: IndicatorToolbarProps) {
  return (
    <div className={cn('flex flex-wrap gap-1', className)} role="group" aria-label="Chart indicators">
      {TOGGLES.map((t) => {
        const active = Boolean(value[t.key]);
        return (
          <button
            key={t.key}
            onClick={() => onChange({ ...value, [t.key]: !active })}
            aria-pressed={active}
            className={cn(
              'rounded border px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wider transition-colors',
              active
                ? 'border-signal bg-signal/15 text-signal'
                : 'border-border text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
