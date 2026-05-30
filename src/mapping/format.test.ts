import { describe, it, expect } from 'vitest';
import { normalizeUrl, normalizePhone } from './format';

describe('normalizeUrl', () => {
  it('adds https:// when scheme is missing', () => {
    expect(normalizeUrl('linkedin.com/in/dev')).toBe('https://linkedin.com/in/dev');
  });

  it('leaves an https URL untouched', () => {
    expect(normalizeUrl('https://github.com/dev')).toBe('https://github.com/dev');
  });

  it('preserves an http URL', () => {
    expect(normalizeUrl('http://my.site')).toBe('http://my.site');
  });

  it('trims whitespace', () => {
    expect(normalizeUrl('  example.com  ')).toBe('https://example.com');
  });

  it('returns empty string for empty input', () => {
    expect(normalizeUrl('')).toBe('');
  });
});

describe('normalizePhone', () => {
  it('keeps a leading + and strips formatting', () => {
    expect(normalizePhone('+1 (415) 555-1234')).toBe('+14155551234');
  });

  it('strips formatting from a national number', () => {
    expect(normalizePhone('(415) 555-1234')).toBe('4155551234');
  });

  it('drops stray characters', () => {
    expect(normalizePhone('415.555.1234 ext')).toBe('4155551234');
  });
});
