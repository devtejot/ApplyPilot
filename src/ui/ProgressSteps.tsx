import { Check } from 'lucide-react';
import { cn } from './cn';

export interface ProgressStepsProps {
  steps: string[];
  /** Index of the current step (0-based). Steps before it render as done. */
  current: number;
  /** Numbered circles + labels (onboarding) vs. compact bars (sidepanel header). */
  labeled?: boolean;
  className?: string;
}

export function ProgressSteps({ steps, current, labeled, className }: ProgressStepsProps) {
  if (labeled) {
    return (
      <ol className={cn('flex items-center gap-2', className)}>
        {steps.map((label, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={label} className="flex items-center gap-2">
              <span
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-medium transition-colors',
                  done
                    ? 'bg-accent text-accent-fg'
                    : active
                      ? 'border border-accent text-fg'
                      : 'border border-border text-fg-subtle',
                )}
              >
                {done ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span className={cn('whitespace-nowrap text-xs', active ? 'font-medium text-fg' : 'text-fg-subtle')}>{label}</span>
              {i < steps.length - 1 && <span className="h-px w-4 bg-border" />}
            </li>
          );
        })}
      </ol>
    );
  }

  return (
    <ol className={cn('flex items-center gap-1.5', className)} aria-label={`Step ${current + 1} of ${steps.length}`}>
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="h-1 flex-1" title={label}>
            <span
              className={cn(
                'block h-full rounded-full transition-colors',
                done ? 'bg-accent' : active ? 'bg-accent/50' : 'bg-surface-muted',
              )}
            />
          </li>
        );
      })}
    </ol>
  );
}
