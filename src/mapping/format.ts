// Value formatters applied before filling (DESIGN.md §7) — prevent invalid formats.
import { localeFor } from '@/shared/locale';

/** Ensure a URL has a scheme so the field gets a valid absolute link. */
export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/**
 * Reduce a phone number to a leading + (if any) and digits only. When `country`
 * is given and the number has no country code, prepend the locale dial code
 * (e.g. India → +91) so portals that validate international format accept it.
 */
export function normalizePhone(raw: string, country?: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('+')) return '+' + trimmed.replace(/\D/g, '');

  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';
  const dial = country ? localeFor(country).dialCode : '';
  if (!dial) return digits; // unchanged single-arg behavior (no country code)

  const code = dial.replace(/\D/g, '');
  // Avoid double-prefixing if the user already typed the country code.
  return digits.startsWith(code) ? '+' + digits : dial + digits;
}
