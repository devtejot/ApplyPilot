import { describe, it, expect } from 'vitest';
import { parseBackup } from './dataAdmin';
import { SAMPLE_PROFILE } from './profile';

function backupJson(extra: Record<string, unknown> = {}): string {
  return JSON.stringify({ kind: 'applypilot-backup', version: 1, profile: SAMPLE_PROFILE, ...extra });
}

describe('parseBackup', () => {
  it('accepts a well-formed backup', () => {
    const r = parseBackup(backupJson());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.profile.personal.email).toBe(SAMPLE_PROFILE.personal.email);
  });

  it('restores the answer bank when present', () => {
    const answers = [{ id: 'q', normalizedQuestion: 'q', intentTag: 'other', question: 'Q?', answer: 'A', updatedAt: 1 }];
    const r = parseBackup(backupJson({ answerBank: answers }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.answerBank).toHaveLength(1);
  });

  it('rejects malformed JSON', () => {
    expect(parseBackup('{not json').ok).toBe(false);
  });

  it('rejects a backup with no/invalid profile', () => {
    expect(parseBackup(JSON.stringify({ kind: 'applypilot-backup' })).ok).toBe(false);
    expect(parseBackup(JSON.stringify({ profile: { personal: {} } })).ok).toBe(false);
  });
});
