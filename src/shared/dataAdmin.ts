// Data administration: backup export/import + full local wipe (DESIGN.md §12).
// The API key is never exported (secret). parseBackup is pure + validated.
import { z } from 'zod';
import { profileSchema } from './profileSchema';
import { db, type AnswerRecord } from './db';
import { loadProfile, saveProfile } from './profile';
import type { CandidateProfile } from './types';

const answerRecordSchema = z.object({
  id: z.string(),
  normalizedQuestion: z.string(),
  intentTag: z.string(),
  question: z.string(),
  answer: z.string(),
  company: z.string().optional(),
  updatedAt: z.number(),
});

const backupSchema = z.object({
  profile: profileSchema,
  answerBank: z.array(answerRecordSchema).optional(),
});

export type ParseResult =
  | { ok: true; profile: CandidateProfile; answerBank: AnswerRecord[] }
  | { ok: false; error: string };

export function parseBackup(json: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, error: 'Not valid JSON.' };
  }
  const parsed = backupSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'Not a valid ApplyPilot backup.' };
  return { ok: true, profile: parsed.data.profile, answerBank: parsed.data.answerBank ?? [] };
}

/** JSON backup of profile + answer bank (no API key, no application history). */
export async function exportBackup(): Promise<string> {
  const profile = (await loadProfile()) ?? null;
  const answerBank = await db.answerBank.toArray();
  return JSON.stringify({ kind: 'applypilot-backup', version: 1, profile, answerBank }, null, 2);
}

export async function importBackup(json: string): Promise<ParseResult> {
  const result = parseBackup(json);
  if (!result.ok) return result;
  await saveProfile(result.profile);
  if (result.answerBank.length) await db.answerBank.bulkPut(result.answerBank);
  return result;
}

/** Wipe everything local: profile, settings (incl. API key), history, answer bank. */
export async function clearAllData(): Promise<void> {
  await chrome.storage.local.clear();
  await db.applications.clear();
  await db.answerBank.clear();
}
