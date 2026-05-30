// Previous-answer reuse without vectors (DESIGN.md §9): normalize the question,
// tag its intent, and match against the bank by exact-normalized hit or
// character-bigram (Dice) similarity within the same intent.
import type { AnswerRecord } from '@/shared/db';

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'to', 'of', 'for', 'in', 'on', 'at', 'is', 'are', 'am', 'be',
  'do', 'does', 'did', 'you', 'your', 'yours', 'we', 'us', 'our', 'please', 'tell', 'about',
  'me', 'my', 'have', 'has', 'with', 'why', 'what', 'how', 'when', 'which', 'that', 'this',
]);

export function normalizeQuestion(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w))
    .join(' ')
    .trim();
}

const INTENT_RULES: [RegExp, string][] = [
  [/sponsor|visa/, 'sponsorship'],
  [/authoriz|eligible to work|right to work|legally/, 'work_auth'],
  [/relocat/, 'relocate'],
  [/salary|compensation|expected pay|expected ctc/, 'salary'],
  [/notice period|start date|when can you start|availability/, 'notice_period'],
  [/why.*(company|work here|join|us\b)/, 'why_company'],
  [/why.*(role|position|job)/, 'why_role'],
  [/years? of experience|how many years/, 'years_experience'],
  [/strength/, 'strength'],
  [/weakness/, 'weakness'],
];

export function intentTag(text: string): string {
  const t = text.toLowerCase();
  for (const [re, tag] of INTENT_RULES) if (re.test(t)) return tag;
  return 'other';
}

function bigrams(s: string): Map<string, number> {
  const out = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++) {
    const g = s.slice(i, i + 2);
    out.set(g, (out.get(g) ?? 0) + 1);
  }
  return out;
}

/** Sørensen–Dice coefficient over character bigrams. 0..1. */
export function dice(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const A = bigrams(a);
  const B = bigrams(b);
  let inter = 0;
  for (const [g, c] of A) {
    const d = B.get(g);
    if (d) inter += Math.min(c, d);
  }
  return (2 * inter) / (a.length - 1 + (b.length - 1));
}

export interface ReuseMatch {
  record: AnswerRecord;
  score: number;
  kind: 'exact' | 'fuzzy';
}

const FUZZY_THRESHOLD = 0.7;

export function bestMatch(
  normalizedQuery: string,
  intent: string,
  bank: AnswerRecord[],
): ReuseMatch | null {
  const exact = bank.find((r) => r.normalizedQuestion === normalizedQuery);
  if (exact) return { record: exact, score: 1, kind: 'exact' };

  let best: ReuseMatch | null = null;
  for (const r of bank) {
    if (intent !== 'other' && r.intentTag !== intent) continue;
    const score = dice(normalizedQuery, r.normalizedQuestion);
    if (!best || score > best.score) best = { record: r, score, kind: 'fuzzy' };
  }
  return best && best.score >= FUZZY_THRESHOLD ? best : null;
}
