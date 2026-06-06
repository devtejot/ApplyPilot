// Single source of truth for ApplyPilot's privacy claims. Every line here must
// stay literally true (see DESIGN.md §12 — there is no backend, no telemetry).
// The API-key line is conditional: only claim "encrypted" once the user has
// turned on key encryption (Phase 4d) — pass `keyEncrypted` to privacyPoints().

export const PRIVACY_TAGLINE = '100% local';

/** One-line reassurance for tight spaces (popup subtitle, footers). */
export const PRIVACY_SUMMARY = 'Your data stays on this device — no servers, no tracking.';

export interface PrivacyPoint {
  title: string;
  detail: string;
}

export function privacyPoints(keyEncrypted = false): PrivacyPoint[] {
  return [
    {
      title: 'Stored only on your device',
      detail:
        'Your profile, resume, application history, and saved answers live in this browser (local storage + IndexedDB). Nothing is uploaded.',
    },
    {
      title: 'No servers, no tracking',
      detail: 'ApplyPilot has no backend and ships zero analytics or telemetry. We never see your data.',
    },
    {
      title: 'AI runs through your own key',
      detail:
        'When you use AI, only the job description and a compact profile summary are sent — directly to the provider you choose (Google or Anthropic), with your own API key.',
    },
    {
      title: keyEncrypted ? 'Your API key is encrypted at rest' : 'Your API key stays on this device',
      detail: keyEncrypted
        ? 'Your key is encrypted with your passphrase (AES-GCM) and only unlocked in memory while you use AI.'
        : 'Your key is kept locally and sent only to your chosen AI provider. Turn on encryption in settings to protect it at rest.',
    },
    {
      title: 'Never auto-submits',
      detail: 'ApplyPilot fills fields and flags them for your review. You always click submit yourself.',
    },
  ];
}
