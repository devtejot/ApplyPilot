// Provider abstraction (DESIGN.md §13). One interface; Claude/OpenAI/Gemini are
// adapters. The extension only ever depends on AIProvider, never a concrete SDK.
import type { ZodType } from 'zod';
import type { ErrorCode } from '@/shared/types';

export class AIError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AIError';
  }
}

export interface AIProvider {
  id: 'claude' | 'openai' | 'gemini';
  generateStructured<T>(args: {
    system: string;
    user: string;
    schema: ZodType<T>;
    signal?: AbortSignal;
  }): Promise<T>;
}

// The network call, injected. Returns the parsed object (or null). The provider
// validates it against the schema and normalizes errors — shared by every adapter.
export type StructuredParseFn = (args: {
  system: string;
  user: string;
  schema: ZodType<unknown>;
  signal?: AbortSignal;
}) => Promise<unknown>;

export class StructuredProvider implements AIProvider {
  constructor(
    public readonly id: AIProvider['id'],
    private readonly parseFn: StructuredParseFn,
  ) {}

  async generateStructured<T>(args: {
    system: string;
    user: string;
    schema: ZodType<T>;
    signal?: AbortSignal;
  }): Promise<T> {
    let raw: unknown;
    try {
      raw = await this.parseFn(args as Parameters<StructuredParseFn>[0]);
    } catch (e) {
      if (e instanceof AIError) throw e;
      throw new AIError(mapAiError(e), (e as Error)?.message ?? 'AI request failed');
    }

    if (raw == null) throw new AIError('BAD_AI_JSON', 'Model returned no parseable output.');

    const parsed = args.schema.safeParse(raw);
    if (!parsed.success) throw new AIError('BAD_AI_JSON', parsed.error.message);
    return parsed.data;
  }
}

/** Normalize any thrown error (SDK, fetch, abort) to one of our ErrorCodes. */
export function mapAiError(e: unknown): ErrorCode {
  const err = e as { status?: number; name?: string } | null;
  if (err?.name === 'AbortError') return 'AI_TIMEOUT';
  switch (err?.status) {
    case 401:
    case 403:
      return 'INVALID_KEY';
    case 429:
      return 'RATE_LIMIT';
    case undefined:
      return 'NETWORK';
    default:
      return 'UNKNOWN';
  }
}
