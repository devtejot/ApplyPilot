import { describe, it, expect } from 'vitest';
import { settingsSchema, defaultSettings, isConfigured, defaultModelFor, modelsFor } from './settings';

describe('settings', () => {
  it('defaults to the free provider (Gemini) with no key', () => {
    const s = defaultSettings();
    expect(s.provider).toBe('gemini');
    expect(s.model).toBe('gemini-2.5-flash');
    expect(s.apiKey).toBe('');
  });

  it('validates a well-formed settings object', () => {
    expect(settingsSchema.safeParse(defaultSettings()).success).toBe(true);
  });

  it('accepts both claude and gemini providers', () => {
    expect(settingsSchema.safeParse({ ...defaultSettings(), provider: 'claude' }).success).toBe(true);
    expect(settingsSchema.safeParse({ ...defaultSettings(), provider: 'gemini' }).success).toBe(true);
  });

  it('rejects an unknown provider', () => {
    expect(settingsSchema.safeParse({ ...defaultSettings(), provider: 'mistral' }).success).toBe(false);
  });

  it('isConfigured tracks whether a key is present', () => {
    expect(isConfigured(defaultSettings())).toBe(false);
    expect(isConfigured({ ...defaultSettings(), apiKey: 'x' })).toBe(true);
  });

  it('defaults theme to system and backfills legacy settings missing the field', () => {
    expect(defaultSettings().theme).toBe('system');
    const legacy = { provider: 'gemini', apiKey: '', model: 'gemini-2.5-flash' };
    const parsed = settingsSchema.safeParse(legacy);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.theme).toBe('system');
  });

  it('exposes a default model and model list per provider', () => {
    expect(defaultModelFor('claude')).toBe('claude-opus-4-8');
    expect(defaultModelFor('gemini')).toBe('gemini-2.5-flash');
    expect(modelsFor('gemini')).toContain('gemini-2.5-flash');
    expect(modelsFor('claude')).toContain('claude-opus-4-8');
  });
});
