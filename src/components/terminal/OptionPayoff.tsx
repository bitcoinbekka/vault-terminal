import type { Position } from '@/hooks/usePositions';
import { optionBreakeven, optionMaxLoss, optionMaxProfit, payoffAtExpiry } from '@/lib/options';
import { formatExpiration, formatPrice } from '@/lib/format';
import { Mask } from './Mask';

interface PayoffChartProps {
  type: 'C' | 'P';
  strike: number;
  cost: number;
  currentPrice: number | null;
  width?: number;
  height?: number;
}

/** Compact per-contract payoff diagram at expiry, with breakeven + current price. */
export function PayoffChart({ type, strike, cost, currentPrice, width = 260, height = 78 }: PayoffChartProps) {
  const xMin = Math.max(strike * 0.55, 0.001);
  const xMax = strike * 1.45;
  const samples = 72;

  const pts: { S: number; y: number }[] = [];
  let yMax = cost * 0.6;
  for (let i = 0; i <= samples; i++) {
    const S = xMin + ((xMax - xMin) * i) / samples;
    const y = payoffAtExpiry(type, strike, cost, S);
    pts.push({ S, y });
    if (y > yMax) yMax = y;
  }
  const yMin = -cost * 1.35;

  const X = (S: number) => 10 + ((S - xMin) / (xMax - xMin)) * (width - 20);
  const Y = (v: number) => height - 10 - ((v - yMin) / (yMax - yMin)) * (height - 22);
  const zeroY = Y(0);

  const line = pts.map((p) => `${X(p.S).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ');
  const breakeven = optionBreakeven(type, strike, cost);
  const beX = Math.max(10, Math.min(width - 10, X(breakeven)));
  const curX = currentPrice !== null && currentPrice > 0 ? X(currentPrice) : null;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Payoff diagram">
      {/* zero line */}
      <line x1={10} x2={width - 10} y1={zeroY} y2={zeroY} stroke="currentColor" strokeOpacity={0.3} strokeDasharray="3 4" />
      {/* breakeven */}
      <line x1={beX} x2={beX} y1={10} y2={height - 10} stroke="#94a3b8" strokeWidth={1} strokeDasharray="2 3" />
      {/* payoff curve */}
      <polyline points={line} fill="none" stroke="var(--signal)" strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
      {/* current underlying price */}
      {curX !== null && currentPrice !== null ? (
        <g>
          <line x1={curX} x2={curX} y1={10} y2={height - 10} stroke="#22d3ee" strokeWidth={1} strokeDasharray="2 3" opacity={0.7} />
          <circle
            cx={curX}
            cy={Y(payoffAtExpiry(type, strike, cost, currentPrice))}
            r={3}
            fill="#22d3ee"
            stroke="var(--card)"
            strokeWidth={1}
          />
        </g>
      ) : null}
      <text x={8} y={height - 2} fontSize={9} fill="currentColor" opacity={0.6} fontFamily="var(--font-mono)">
        BE {formatPrice(breakeven)}
      </text>
      <text x={width - 8} y={10} fontSize={9} textAnchor="end" fill="currentColor" opacity={0.6} fontFamily="var(--font-mono)">
        P/L
      </text>
    </svg>
  );
}

interface PayoffCardProps {
  position: Position;
  currentPrice: number | null;
}

/** Breakevens, risk, and payoff curve for one tracked option position. */
export function PayoffCard({ position, currentPrice }: PayoffCardProps) {
  const type = position.optionType ?? 'C';
  const strike = position.strike ?? 0;
  const cost = position.avgCost;
  const breakeven = optionBreakeven(type, strike, cost);
  const maxProfit = optionMaxProfit(type, strike, cost);
  const maxLoss = optionMaxLoss(type, strike, cost);

  return (
    <div className="rounded-md border border-border bg-muted/20 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-mono text-xs font-bold">
          {position.symbol} {position.expiry ? formatExpiration(position.expiry) : ''} {type}{' '}
          {strike ? formatPrice(strike) : ''} ×{position.quantity}
        </span>
        <span className={type === 'C' ? 'shrink-0 font-mono text-[10px] font-bold text-gain' : 'shrink-0 font-mono text-[10px] font-bold text-loss'}>
          {type}
        </span>
      </div>
      <div className="mt-1 grid grid-cols-3 gap-1 font-mono text-[10px] text-muted-foreground">
        <div>
          BE <span className="font-semibold text-foreground"><Mask>{formatPrice(breakeven)}</Mask></span>
        </div>
        <div>
          MAX L <span className="font-semibold text-loss"><Mask>{formatPrice(maxLoss)}</Mask></span>
        </div>
        <div>
          MAX P{' '}
          {maxProfit === null ? (
            <span className="font-semibold text-gain">∞</span>
          ) : (
            <span className="font-semibold text-gain"><Mask>{formatPrice(maxProfit)}</Mask></span>
          )}
        </div>
      </div>
      <PayoffChart type={type} strike={strike} cost={cost} currentPrice={currentPrice} />
      {currentPrice !== null ? (
        <p className="font-mono text-[10px] text-muted-foreground">Underlying now {formatPrice(currentPrice)}</p>
      ) : null}
    </div>
  );
}
