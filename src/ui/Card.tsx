import { type ReactNode } from 'react';
import { cn } from './cn';

export function SectionHeader({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('text-[11px] font-medium uppercase tracking-wide text-fg-subtle', className)}>
      {children}
    </div>
  );
}

export function Card({
  label,
  action,
  children,
  className,
}: {
  label?: ReactNode;
  /** Optional control rendered on the right of the header row (e.g. Rescan). */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-lg border border-border bg-surface p-3', className)}>
      {(label || action) && (
        <div className="mb-1.5 flex items-center justify-between gap-2">
          {label ? <SectionHeader>{label}</SectionHeader> : <span />}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
