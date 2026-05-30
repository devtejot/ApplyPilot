// Claude adapter — thin subclass of StructuredProvider. The shared validation +
// error-normalization logic lives in provider.ts; this just fixes the id.
// makeClaudeProvider (claudeClient.ts) injects the real Messages API call.
import { StructuredProvider, type StructuredParseFn } from './provider';

export type ClaudeParseFn = StructuredParseFn;

export class ClaudeProvider extends StructuredProvider {
  constructor(parseFn: ClaudeParseFn) {
    super('claude', parseFn);
  }
}
