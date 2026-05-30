// Real Anthropic wiring (DESIGN.md §13). Runs in the background worker only.
//
// We call the Messages API with `fetch` rather than the official SDK: the SDK's
// full entry pulls Node-only modules (node:fs, child_process, credential chains)
// that don't bundle into an MV3 service worker. Structured output uses forced
// tool-use — the most portable, model-agnostic method — and the tool's
// input_schema is derived from our Zod schema via z.toJSONSchema. ClaudeProvider
// then validates the tool input against that same Zod schema.
import { z, type ZodType } from 'zod';
import { ClaudeProvider, type ClaudeParseFn } from './claude';
import type { Settings } from '@/shared/settings';

const API_URL = 'https://api.anthropic.com/v1/messages';
const MAX_TOKENS = 4096;

interface ToolUseBlock {
  type: string;
  input?: unknown;
}

export function makeClaudeProvider(settings: Settings): ClaudeProvider {
  const parseFn: ClaudeParseFn = async ({ system, user, schema, signal }) => {
    const inputSchema = z.toJSONSchema(schema as ZodType);

    const res = await fetch(API_URL, {
      method: 'POST',
      signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': settings.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: settings.model,
        max_tokens: MAX_TOKENS,
        system,
        messages: [{ role: 'user', content: user }],
        tools: [{ name: 'submit', description: 'Return the result in this exact shape.', input_schema: inputSchema }],
        tool_choice: { type: 'tool', name: 'submit' },
      }),
    });

    if (!res.ok) {
      const err = new Error(`Anthropic API error ${res.status}`) as Error & { status: number };
      err.status = res.status;
      throw err;
    }

    const data = (await res.json()) as { content?: ToolUseBlock[] };
    const toolUse = data.content?.find((b) => b.type === 'tool_use');
    return toolUse?.input ?? null;
  };

  return new ClaudeProvider(parseFn);
}
