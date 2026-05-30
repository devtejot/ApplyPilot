// AI provider settings (DESIGN.md §13). BYO key, stored locally only. Provider is
// user-selectable — Gemini (free tier) is the default; Claude is opt-in.
import { z } from 'zod';

export type Provider = 'claude' | 'gemini';
export type ThemePref = 'light' | 'dark' | 'system';

export const CLAUDE_MODELS = ['claude-opus-4-8', 'claude-sonnet-4-6', 'claude-haiku-4-5'] as const;
export const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro'] as const;

export const settingsSchema = z.object({
  provider: z.enum(['claude', 'gemini']),
  apiKey: z.string(),
  model: z.string(),
  // UI theme preference. `.default` keeps legacy stored settings (which lack this
  // field) valid — safeParse fills it in.
  theme: z.enum(['light', 'dark', 'system']).default('system'),
  // First-run flag — set true when the user finishes (or skips) onboarding.
  onboardingComplete: z.boolean().default(false),
});

export type Settings = z.infer<typeof settingsSchema>;

const KEY = 'settings';

export function defaultModelFor(provider: Provider): string {
  return provider === 'gemini' ? 'gemini-2.5-flash' : 'claude-opus-4-8';
}

export function modelsFor(provider: Provider): readonly string[] {
  return provider === 'gemini' ? GEMINI_MODELS : CLAUDE_MODELS;
}

export function defaultSettings(): Settings {
  return { provider: 'gemini', apiKey: '', model: defaultModelFor('gemini'), theme: 'system', onboardingComplete: false };
}

export function isConfigured(s: Settings): boolean {
  return s.apiKey.trim() !== '';
}

export async function loadSettings(): Promise<Settings> {
  const res = await chrome.storage.local.get(KEY);
  const parsed = settingsSchema.safeParse(res[KEY]);
  return parsed.success ? parsed.data : defaultSettings();
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ [KEY]: settings });
}
