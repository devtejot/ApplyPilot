// Value formatters applied before filling (DESIGN.md §7) — prevent invalid formats.

/** Ensure a URL has a scheme so the field gets a valid absolute link. */
export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/** Reduce a phone number to a leading + (if any) and digits only. */
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  const plus = trimmed.startsWith('+') ? '+' : '';
  return plus + trimmed.replace(/\D/g, '');
}
