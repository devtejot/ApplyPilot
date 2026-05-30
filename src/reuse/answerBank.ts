// Answer bank (DESIGN.md §9). Stores past answers keyed by normalized question;
// reuse via exact/fuzzy match, with a company-name leak guard.
import { db, type AnswerRecord } from '@/shared/db';
import { normalizeQuestion, intentTag, bestMatch, type ReuseMatch } from './reuse';

export async function saveAnswer(question: string, answer: string, company?: string): Promise<void> {
  const normalizedQuestion = normalizeQuestion(question);
  if (!normalizedQuestion) return;
  const rec: AnswerRecord = {
    id: normalizedQuestion,
    normalizedQuestion,
    intentTag: intentTag(question),
    question,
    answer,
    ...(company ? { company } : {}),
    updatedAt: Date.now(),
  };
  await db.answerBank.put(rec);
}

/**
 * Find a reusable prior answer. Skips a match whose stored answer name-drops a
 * different company than the one we're now applying to (avoids "excited to join
 * Acme" leaking onto a Beta application).
 */
export async function findReusable(question: string, currentCompany?: string): Promise<ReuseMatch | null> {
  const bank = await db.answerBank.toArray();
  const match = bestMatch(normalizeQuestion(question), intentTag(question), bank);
  if (!match) return null;

  const stored = match.record.company;
  if (stored && currentCompany && stored !== currentCompany && match.record.answer.includes(stored)) {
    return null; // would leak the wrong company name — regenerate instead
  }
  return match;
}
