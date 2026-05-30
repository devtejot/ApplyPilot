import { type ReactNode } from 'react';
import { cn } from './cn';

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-border px-4 py-6 text-center',
        className,
      )}
    >
      {icon && <div className="text-fg-subtle">{icon}</div>}
      <div className="text-sm font-medium text-fg">{title}</div>
      {description && <div className="text-xs text-fg-muted">{description}</div>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
