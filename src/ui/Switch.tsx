import { useId, type ReactNode } from 'react';
import { cn } from './cn';

export function Switch({
  checked,
  onChange,
  label,
  id,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label?: ReactNode;
  id?: string;
  disabled?: boolean;
  className?: string;
}) {
  const autoId = useId();
  const sid = id ?? autoId;
  return (
    <span className={cn('inline-flex items-center gap-2', disabled && 'opacity-50', className)}>
      <button
        id={sid}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-bg',
          checked ? 'bg-accent' : 'border border-border bg-surface-muted',
        )}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 transform rounded-full bg-surface shadow transition-transform',
            checked ? 'translate-x-4' : 'translate-x-0.5',
          )}
        />
      </button>
      {label && (
        <label htmlFor={sid} className="cursor-pointer select-none text-sm text-fg">
          {label}
        </label>
      )}
    </span>
  );
}
