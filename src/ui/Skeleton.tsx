import { cn } from './cn';

/** Shimmer placeholder block. Size it with className (e.g. "h-3 w-2/3"). */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('relative overflow-hidden rounded bg-surface-muted', className)}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-fg/10 to-transparent" />
    </div>
  );
}
