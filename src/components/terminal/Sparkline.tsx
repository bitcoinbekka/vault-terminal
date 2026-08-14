import { cn } from '@/lib/utils';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  /** Force direction; defaults to first-vs-last. */
  positive?: boolean;
  className?: string;
}

/** Tiny terminal-style line sparkline. */
export function Sparkline({ data, width = 96, height = 28, positive, className }: SparklineProps) {
  if (!data || data.length < 2) {
    return <div className={cn('w-24 h-7', className)} aria-hidden />;
  }

  const up = positive ?? data[data.length - 1] >= data[0];
  const color = up ? 'var(--gain)' : 'var(--loss)';
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);

  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = height - 2 - ((v - min) / range) * (height - 4);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn('overflow-visible shrink-0', className)}
      aria-hidden
    >
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
