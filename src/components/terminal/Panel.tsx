import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface PanelProps {
  title: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}

/** Terminal-style card with a mono uppercase header bar. */
export function Panel({ title, right, children, className, id }: PanelProps) {
  return (
    <section id={id} className={cn('overflow-hidden rounded-lg border border-border bg-card', className)}>
      <header className="flex min-h-9 items-center justify-between gap-2 border-b border-border bg-muted/30 px-3 py-1.5">
        <h2 className="truncate font-mono text-[11px] font-bold tracking-[0.15em] text-foreground">{title}</h2>
        {right ? <div className="flex shrink-0 items-center gap-2">{right}</div> : null}
      </header>
      <div>{children}</div>
    </section>
  );
}
