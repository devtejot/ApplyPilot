import { describe, it, expect } from 'vitest';
import { withRetry } from './retry';
import { AIError } from './provider';

const fast = { delayMs: () => 0 };

describe('withRetry', () => {
  it('returns immediately on success (one call)', async () => {
    let calls = 0;
    const r = await withRetry(async () => {
      calls++;
      return 'ok';
    }, fast);
    expect(r).toBe('ok');
    expect(calls).toBe(1);
  });

  it('retries on RATE_LIMIT then succeeds', async () => {
    let calls = 0;
    const r = await withRetry(async () => {
      calls++;
      if (calls < 3) throw new AIError('RATE_LIMIT', 'slow down');
      return 'ok';
    }, fast);
    expect(r).toBe('ok');
    expect(calls).toBe(3);
  });

  it('does not retry a non-retryable error (INVALID_KEY)', async () => {
    let calls = 0;
    await expect(
      withRetry(async () => {
        calls++;
        throw new AIError('INVALID_KEY', 'bad key');
      }, fast),
    ).rejects.toMatchObject({ code: 'INVALID_KEY' });
    expect(calls).toBe(1);
  });

  it('gives up after exhausting retries', async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls++;
          throw new AIError('RATE_LIMIT', 'nope');
        },
        { delayMs: () => 0, retries: 2 },
      ),
    ).rejects.toMatchObject({ code: 'RATE_LIMIT' });
    expect(calls).toBe(3); // initial + 2 retries
  });
});
