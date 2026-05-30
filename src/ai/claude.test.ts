import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { ClaudeProvider } from './claude';
import { AIError } from './provider';

const schema = z.object({ ok: z.boolean() });

describe('ClaudeProvider.generateStructured', () => {
  it('returns validated data when the model output is good', async () => {
    const provider = new ClaudeProvider(async () => ({ ok: true }));
    await expect(provider.generateStructured({ system: 's', user: 'u', schema })).resolves.toEqual({ ok: true });
  });

  it('throws BAD_AI_JSON when the model returns null', async () => {
    const provider = new ClaudeProvider(async () => null);
    await expect(provider.generateStructured({ system: 's', user: 'u', schema })).rejects.toMatchObject({ code: 'BAD_AI_JSON' });
  });

  it('throws BAD_AI_JSON when the output fails the schema', async () => {
    const provider = new ClaudeProvider(async () => ({ ok: 'nope' }));
    await expect(provider.generateStructured({ system: 's', user: 'u', schema })).rejects.toMatchObject({ code: 'BAD_AI_JSON' });
  });

  it('maps a 401 from the SDK to an INVALID_KEY AIError', async () => {
    const provider = new ClaudeProvider(async () => {
      throw Object.assign(new Error('unauthorized'), { status: 401 });
    });
    await expect(provider.generateStructured({ system: 's', user: 'u', schema })).rejects.toMatchObject({
      code: 'INVALID_KEY',
    });
  });

  it('rethrows an AIError unchanged', async () => {
    const provider = new ClaudeProvider(async () => {
      throw new AIError('AI_TIMEOUT', 'slow');
    });
    await expect(provider.generateStructured({ system: 's', user: 'u', schema })).rejects.toMatchObject({ code: 'AI_TIMEOUT' });
  });
});
