import { describe, it, expect } from 'vitest';
import { mapAiError } from './provider';

describe('mapAiError', () => {
  it('maps 401 to INVALID_KEY', () => {
    expect(mapAiError({ status: 401 })).toBe('INVALID_KEY');
  });
  it('maps 429 to RATE_LIMIT', () => {
    expect(mapAiError({ status: 429 })).toBe('RATE_LIMIT');
  });
  it('maps an AbortError to AI_TIMEOUT', () => {
    expect(mapAiError({ name: 'AbortError' })).toBe('AI_TIMEOUT');
  });
  it('falls back to NETWORK', () => {
    expect(mapAiError(new Error('boom'))).toBe('NETWORK');
  });
});
