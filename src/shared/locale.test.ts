import { describe, it, expect } from 'vitest';
import { localeFor, DEFAULT_COUNTRY, COUNTRIES, INDIAN_STATES } from './locale';

describe('locale', () => {
  it('defaults to India when country is empty or missing', () => {
    expect(localeFor().country).toBe('India');
    expect(localeFor('').country).toBe('India');
    expect(DEFAULT_COUNTRY).toBe('India');
  });

  it('returns India config with CTC wording, rupee, and dial code', () => {
    const l = localeFor('India');
    expect(l.dialCode).toBe('+91');
    expect(l.salaryTerm).toBe('CTC');
    expect(l.currency).toBe('₹');
    expect(l.states).toEqual(INDIAN_STATES);
  });

  it('uses Salary wording for the US and lists US states', () => {
    const l = localeFor('United States');
    expect(l.dialCode).toBe('+1');
    expect(l.salaryTerm).toBe('Salary');
    expect(l.states?.length).toBeGreaterThan(50);
  });

  it('resolves common aliases (USA, UK, UAE, Bharat)', () => {
    expect(localeFor('USA').country).toBe('United States');
    expect(localeFor('uk').country).toBe('United Kingdom');
    expect(localeFor('UAE').country).toBe('United Arab Emirates');
    expect(localeFor('Bharat').country).toBe('India');
  });

  it('falls back to a free-form config for unknown countries', () => {
    const l = localeFor('Narnia');
    expect(l.country).toBe('Narnia');
    expect(l.dialCode).toBe('');
    expect(l.states).toBeUndefined();
    expect(l.salaryTerm).toBe('Salary');
  });

  it('lists India first in the country picker', () => {
    expect(COUNTRIES[0]).toBe('India');
  });
});
