import { cn } from '@/lib/utils';
import { colorForChange, formatChange, formatPercent } from '@/lib/format';

interface PriceChangeProps {
  /** Absolute change. */
  change?: number | null;
  /** Percent change. */
  percent?: number | null;
  className?: string;
  showPercent?: boolean;
  compact?: boolean;
}

/** Signed change with terminal gain/loss coloring. */
export function PriceChange({
  change,
  percent,
  className,
  showPercent = true,
  compact = false,
}: PriceChangeProps) {
  const color = colorForChange(change ?? percent ?? 0);

  return (
    <span className={cn('inline-flex items-center gap-1 font-mono tabular-nums whitespace-nowrap', color, className)}>
      {change !== null && change !== undefined ? (
        <span>{formatChange(change)}</span>
      ) : null}
      {showPercent && percent !== null && percent !== undefined ? (
        <span className={compact ? undefined : 'text-muted-foreground'}>
          ({formatPercent(percent)})
        </span>
      ) : null}
      {change === null && percent === null ? <span>—</span> : null}
    </span>
  );
}
