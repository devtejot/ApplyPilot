// Thin progress bar — used for profile completeness. Color shifts with value so
// a low score reads as a nudge, not a neutral stat.
import { cn } from './cn';

export function Meter({ percent, className }: { percent: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(percent)));
  const tone = pct >= 80 ? 'bg-success' : pct >= 50 ? 'bg-warning' : 'bg-danger';
  return (
    <div
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-surface-muted', className)}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={cn('h-full rounded-full transition-all', tone)} style={{ width: `${pct}%` }} />
    </div>
  );
}
