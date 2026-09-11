import type { ReactNode } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { useInView } from '@/hooks/useInView';
import { Panel } from './Panel';

interface LazyPanelProps {
  title: string;
  children: ReactNode;
  /** Skeleton rows shown until the panel scrolls into view. */
  rows?: number;
}

/**
 * Defers mounting its children until the panel is scrolled into view.
 *
 * Heavy scanner panels (movers, sector rotation, discover, trending,
 * extended-hours) fetch dozens of quotes each; deferring them keeps the
 * initial dashboard load small and avoids tripping Yahoo Finance's rate limit.
 */
export function LazyPanel({ title, children, rows = 6 }: LazyPanelProps) {
  const { ref, inView } = useInView<HTMLDivElement>();

  if (inView) return <>{children}</>;

  return (
    <Panel title={title}>
      <div ref={ref} className="space-y-2 p-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    </Panel>
  );
}
