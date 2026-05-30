import { describe, it, expect } from 'vitest';
import { joinItems, normalizePdfText } from './pdf';

describe('joinItems', () => {
  it('joins text items with spaces', () => {
    expect(joinItems([{ str: 'Hello' }, { str: 'world' }])).toBe('Hello world');
  });

  it('breaks a line when an item marks end-of-line', () => {
    expect(joinItems([{ str: 'Line1', hasEOL: true }, { str: 'Line2' }])).toBe('Line1\nLine2');
  });

  it('ignores empty items gracefully', () => {
    expect(joinItems([])).toBe('');
  });
});

describe('normalizePdfText', () => {
  it('collapses runs of spaces and tabs', () => {
    expect(normalizePdfText('a    \t b')).toBe('a b');
  });

  it('collapses 3+ blank lines down to one blank line', () => {
    expect(normalizePdfText('a\n\n\n\nb')).toBe('a\n\nb');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizePdfText('   hi   ')).toBe('hi');
  });
});
