// Application history persistence (DESIGN.md §8). IndexedDB via Dexie. The record
// id is the job URL, so re-saving the same posting upserts (natural dedupe).
import { db, type ApplicationRecord } from '@/shared/db';

/** SHA-256 hex of normalized JD text — the content dedupe key. */
export async function hashText(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function saveApplication(rec: ApplicationRecord): Promise<void> {
  await db.applications.put(rec);
}

export async function findApplicationByUrl(jobUrl: string): Promise<ApplicationRecord | undefined> {
  return db.applications.where('jobUrl').equals(jobUrl).first();
}

export async function recentApplications(limit = 20): Promise<ApplicationRecord[]> {
  return db.applications.orderBy('appliedAt').reverse().limit(limit).toArray();
}
