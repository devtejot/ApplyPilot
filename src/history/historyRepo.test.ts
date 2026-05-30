import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db, type ApplicationRecord } from '@/shared/db';
import { saveApplication, findApplicationByUrl, recentApplications, hashText, deleteApplication, pruneApplications } from './historyRepo';

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

  it('deletes an application by id', async () => {
    await saveApplication(app({ id: 'a', jobUrl: 'a' }));
    await saveApplication(app({ id: 'b', jobUrl: 'b' }));
    await deleteApplication('a');
    const all = await recentApplications();
    expect(all.map((r) => r.id)).toEqual(['b']);
  });
});

describe('pruneApplications', () => {
  const day = 86_400_000;

  it('removes records older than maxAgeDays', async () => {
    await saveApplication(app({ id: 'old', jobUrl: 'old', appliedAt: Date.now() - 200 * day }));
    await saveApplication(app({ id: 'new', jobUrl: 'new', appliedAt: Date.now() }));
    const removed = await pruneApplications({ maxAgeDays: 180, maxCount: 1000 });
    expect(removed).toBe(1);
    expect((await recentApplications()).map((r) => r.id)).toEqual(['new']);
  });

  it('caps to the newest maxCount', async () => {
    for (let i = 0; i < 5; i++) await saveApplication(app({ id: `r${i}`, jobUrl: `r${i}`, appliedAt: 1000 + i }));
    const removed = await pruneApplications({ maxAgeDays: 99999, maxCount: 3 });
    expect(removed).toBe(2);
    expect((await recentApplications()).map((r) => r.id)).toEqual(['r4', 'r3', 'r2']);
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
