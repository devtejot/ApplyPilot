// Retry transient AI failures (rate limits, network) with backoff (DESIGN.md §14).
import { AIError } from './provider';

const RETRYABLE = new Set(['RATE_LIMIT', 'NETWORK']);

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts?: { retries?: number; delayMs?: (attempt: number) => number },
): Promise<T> {
  const retries = opts?.retries ?? 2;
  const delayMs = opts?.delayMs ?? ((attempt) => 800 * 2 ** attempt);

  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const retryable = e instanceof AIError && RETRYABLE.has(e.code);
      if (!retryable || attempt >= retries) throw e;
      await new Promise((r) => setTimeout(r, delayMs(attempt)));
    }
  }
}
