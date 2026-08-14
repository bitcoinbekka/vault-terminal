/** Formatting helpers for terminal-style market data display. */

const GAIN = 'text-gain';
const LOSS = 'text-loss';
const FLAT = 'text-muted-foreground';

export function colorForChange(change: number | null | undefined): string {
  if (change === null || change === undefined || change === 0) return FLAT;
  return change > 0 ? GAIN : LOSS;
}

export function signFor(change: number | null | undefined): string {
  if (change === null || change === undefined || change === 0) return '';
  return change > 0 ? '+' : '−';
}

export function formatPrice(value: number | null | undefined, decimals?: number): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const d = decimals ?? (Math.abs(value) < 1 ? 4 : Math.abs(value) < 100 ? 2 : 2);
  return value.toLocaleString('en-US', {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}

export function formatChange(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${Math.abs(value).toFixed(2)}`;
}

/** Signed dollar amount, e.g. "+1,234.56" / "−56.70". */
export function formatSigned(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}$${Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${Math.abs(value).toFixed(2)}%`;
}

/** 1234567 -> "1.23M", 850 -> "850", 123456789 -> "123.46M" */
export function formatCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(value);
}

/** 1234567 -> "1,234,567" */
export function formatInteger(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return Math.round(value).toLocaleString('en-US');
}

export function formatTime(ts: number): string {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatDateTime(ts: number): string {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatDate(ts: number): string {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Expiration timestamp -> "Aug 21 '26" */
export function formatExpiration(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}

/** Relative time: "12m ago", "3h ago", "2d ago" */
export function formatRelativeTime(ts: number): string {
  const diff = Date.now() / 1000 - ts;
  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}d ago`;
  return formatDate(ts);
}

/** Multiplier for a market-data response, e.g. price display of ^VIX. */
export function decimalsForPrice(value: number): number {
  if (value === null || value === undefined || Number.isNaN(value)) return 2;
  return Math.abs(value) >= 1000 ? 2 : Math.abs(value) >= 100 ? 2 : Math.abs(value) >= 1 ? 2 : 4;
}
