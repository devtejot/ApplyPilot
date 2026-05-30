// Tiny class-name joiner. Filters out falsy values so conditional classes read
// cleanly: cn('base', active && 'on', className). No clsx/tailwind-merge needed
// at this scale — keep variant classes in static lookup maps (Tailwind purge).
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
