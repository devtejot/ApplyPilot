// AI provider settings (DESIGN.md §13). BYO key, stored locally only. Provider is
// user-selectable — Gemini (free tier) is the default; Claude is opt-in.
import { z } from 'zod';

export type Provider = 'claude' | 'gemini';
export type ThemePref = 'light' | 'dark' | 'system';

export const CLAUDE_MODELS = ['claude-opus-4-8', 'claude-sonnet-4-6', 'claude-haiku-4-5'] as const;
export const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro'] as const;

export const encryptedKeySchema = z.object({
  ciphertext: z.string(),
  iv: z.string(),
  salt: z.string(),
});

export const settingsSchema = z.object({
  provider: z.enum(['claude', 'gemini']),
  // Plaintext key. Empty when the key is encrypted at rest (see apiKeyEnc).
  apiKey: z.string(),
  model: z.string(),
  // UI theme preference. `.default` keeps legacy stored settings (which lack this
  // field) valid — safeParse fills it in.
  theme: z.enum(['light', 'dark', 'system']).default('system'),
  // First-run flag — set true when the user finishes (or skips) onboarding.
  onboardingComplete: z.boolean().default(false),
  // When true, the key lives encrypted in apiKeyEnc and is unlocked per session.
  keyEncrypted: z.boolean().default(false),
  apiKeyEnc: encryptedKeySchema.optional(),
});

export type Settings = z.infer<typeof settingsSchema>;

const KEY = 'settings';
// Session-only (memory) cache of the decrypted key — never written to disk,
// cleared when the browser closes. Shared across extension pages + the worker.
const SESSION_KEY = 'apiKeyPlain';

export function defaultModelFor(provider: Provider): string {
  return provider === 'gemini' ? 'gemini-2.5-flash' : 'claude-opus-4-8';
}

export function modelsFor(provider: Provider): readonly string[] {
  return provider === 'gemini' ? GEMINI_MODELS : CLAUDE_MODELS;
}

export function defaultSettings(): Settings {
  return {
    provider: 'gemini',
    apiKey: '',
    model: defaultModelFor('gemini'),
    theme: 'system',
    onboardingComplete: false,
    keyEncrypted: false,
  };
}

/** Configured = a usable key exists (plaintext, or encrypted and unlockable). */
export function isConfigured(s: Settings): boolean {
  return s.apiKey.trim() !== '' || (s.keyEncrypted && !!s.apiKeyEnc);
}

export async function getSessionKey(): Promise<string | null> {
  try {
    const res = await chrome.storage.session.get(SESSION_KEY);
    const v = res[SESSION_KEY];
    return typeof v === 'string' && v ? v : null;
  } catch {
    return null;
  }
}

export async function setSessionKey(key: string): Promise<void> {
  await chrome.storage.session.set({ [SESSION_KEY]: key });
}

export async function clearSessionKey(): Promise<void> {
  try {
    await chrome.storage.session.remove(SESSION_KEY);
  } catch {
    /* session storage unavailable — nothing to clear */
  }
}

/** The API key usable right now: the plaintext setting, or the unlocked session key. */
export async function effectiveApiKey(s: Settings): Promise<string | null> {
  if (!s.keyEncrypted) return s.apiKey.trim() ? s.apiKey : null;
  return getSessionKey();
}

export async function loadSettings(): Promise<Settings> {
  const res = await chrome.storage.local.get(KEY);
  const parsed = settingsSchema.safeParse(res[KEY]);
  return parsed.success ? parsed.data : defaultSettings();
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ [KEY]: settings });
}
