import { type ReactNode } from 'react';
import { cn } from './cn';

export type BadgeVariant = 'auto' | 'review' | 'ai' | 'reuse' | 'neutral' | 'success' | 'warning' | 'danger';

// Static map — never build `bg-${variant}` dynamically (Tailwind would purge it).
const styles: Record<BadgeVariant, string> = {
  auto: 'bg-success/15 text-success',
  success: 'bg-success/15 text-success',
  review: 'bg-warning/15 text-warning',
  warning: 'bg-warning/15 text-warning',
  ai: 'bg-info/15 text-info',
  reuse: 'bg-reuse/15 text-reuse',
  danger: 'bg-danger/15 text-danger',
  neutral: 'bg-surface-muted text-fg-muted',
};

export function Badge({
  variant = 'neutral',
  children,
  className,
}: {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium',
        styles[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
