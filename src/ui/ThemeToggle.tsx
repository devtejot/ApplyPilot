import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from './useTheme';
import { cn } from './cn';
import type { ThemePref } from '@/shared/settings';

const options: { value: ThemePref; icon: typeof Sun; label: string }[] = [
  { value: 'light', icon: Sun, label: 'Light' },
  { value: 'system', icon: Monitor, label: 'System' },
  { value: 'dark', icon: Moon, label: 'Dark' },
];

/** Segmented light/system/dark control. Self-contained — reads + writes theme. */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn('inline-flex items-center gap-0.5 rounded-md border border-border bg-surface p-0.5', className)}
    >
      {options.map(({ value, icon: Icon, label }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setTheme(value)}
            className={cn(
              'inline-flex h-6 w-6 items-center justify-center rounded transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active ? 'bg-accent text-accent-fg' : 'text-fg-subtle hover:text-fg',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        );
      })}
    </div>
  );
}
