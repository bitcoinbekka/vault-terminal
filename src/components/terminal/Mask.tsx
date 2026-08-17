import type { ReactNode } from 'react';

import { usePrivacyMode } from '@/hooks/usePrivacyMode';
import { cn } from '@/lib/utils';

/**
 * Masks its children with •••• when privacy mode is on.
 * Wrap any quantity or dollar amount that shouldn't be screen-shared.
 */
export function Mask({ children, className }: { children: ReactNode; className?: string }) {
  const { privacy } = usePrivacyMode();
  if (!privacy) return <>{children}</>;
  return (
    <span className={cn('tracking-widest select-none', className)} aria-label="Hidden by privacy mode">
      ••••
    </span>
  );
}
