// Gemini adapter (free tier). Runs in the background worker only. Same shape as
// the Claude adapter: derive a JSON schema from the Zod contract, ask for JSON,
// parse it; StructuredProvider validates against the same Zod schema.
import { z, type ZodType } from 'zod';
import { StructuredProvider, type StructuredParseFn } from './provider';
import type { Settings } from '@/shared/settings';

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MAX_TOKENS = 4096;

export function makeGeminiProvider(settings: Settings): StructuredProvider {
  const parseFn: StructuredParseFn = async ({ system, user, schema, signal }) => {
    const jsonSchema = z.toJSONSchema(schema as ZodType);

    const res = await fetch(`${BASE}/${settings.model}:generateContent`, {
      method: 'POST',
      signal,
      headers: { 'content-type': 'application/json', 'x-goog-api-key': settings.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `${user}\n\nReturn ONLY a JSON object matching this JSON schema:\n${JSON.stringify(jsonSchema)}`,
              },
            ],
          },
        ],
        generationConfig: { responseMimeType: 'application/json', maxOutputTokens: MAX_TOKENS },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      // Gemini reports a bad key as 400 API_KEY_INVALID — normalize to 401.
      const status = res.status === 400 && /api[_ ]?key/i.test(body) ? 401 : res.status;
      const err = new Error(`Gemini API error ${res.status}: ${body.slice(0, 200)}`) as Error & { status: number };
      err.status = status;
      throw err;
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    if (!text.trim()) return null;
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  };

  return new StructuredProvider('gemini', parseFn);
}
