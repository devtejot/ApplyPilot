import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db, type ApplicationRecord } from '@/shared/db';
import { saveApplication, findApplicationByUrl, recentApplications, hashText } from './historyRepo';

function app(p: Partial<ApplicationRecord> & { id: string; jobUrl: string }): ApplicationRecord {
  return {
    company: 'Acme',
    role: 'Engineer',
    site: 'greenhouse',
    jobDescriptionHash: 'h',
    jobDescription: 'jd',
    matchScore: 0,
    generatedAnswers: [],
    status: 'filled',
    appliedAt: Date.now(),
    updatedAt: Date.now(),
    ...p,
  };
}

beforeEach(async () => {
  await db.applications.clear();
});

describe('historyRepo', () => {
  it('saves and finds an application by URL', async () => {
    await saveApplication(app({ id: 'https://x/1', jobUrl: 'https://x/1' }));
    const found = await findApplicationByUrl('https://x/1');
    expect(found?.company).toBe('Acme');
  });

  it('upserts by id (re-saving the same URL keeps one record)', async () => {
    await saveApplication(app({ id: 'https://x/1', jobUrl: 'https://x/1', matchScore: 50 }));
    await saveApplication(app({ id: 'https://x/1', jobUrl: 'https://x/1', matchScore: 80 }));
    const all = await recentApplications();
    expect(all).toHaveLength(1);
    expect(all[0].matchScore).toBe(80);
  });

  it('lists recent applications newest first', async () => {
    await saveApplication(app({ id: 'a', jobUrl: 'a', appliedAt: 100 }));
    await saveApplication(app({ id: 'b', jobUrl: 'b', appliedAt: 200 }));
    const all = await recentApplications();
    expect(all.map((r) => r.id)).toEqual(['b', 'a']);
  });
});

describe('hashText', () => {
  it('returns a deterministic 64-char hex digest', async () => {
    const a = await hashText('hello');
    const b = await hashText('hello');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});
