// Selects the concrete adapter from settings. Adding OpenAI etc. = one more case.
import type { Settings } from '@/shared/settings';
import type { AIProvider } from './provider';
import { makeClaudeProvider } from './claudeClient';
import { makeGeminiProvider } from './geminiClient';

export function makeProvider(settings: Settings): AIProvider {
  return settings.provider === 'gemini' ? makeGeminiProvider(settings) : makeClaudeProvider(settings);
}
