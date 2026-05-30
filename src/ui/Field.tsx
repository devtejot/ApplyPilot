import { type ReactNode } from 'react';
import { cn } from './cn';

// Shared base styling for text-like form controls (Input, Textarea, Select).
export const controlBase =
  'w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-fg ' +
  'placeholder:text-fg-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

export const controlInvalid = 'border-danger focus-visible:ring-danger';

/** Label + control wrapper with optional help / error text. */
export function Field({
  label,
  help,
  error,
  htmlFor,
  children,
  className,
}: {
  label?: ReactNode;
  help?: ReactNode;
  error?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-xs font-medium text-fg-muted">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <span className="text-xs text-danger">{error}</span>
      ) : help ? (
        <span className="text-xs text-fg-subtle">{help}</span>
      ) : null}
    </div>
  );
}
