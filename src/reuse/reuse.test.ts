import { describe, it, expect } from 'vitest';
import { normalizeQuestion, intentTag, dice, bestMatch } from './reuse';
import type { AnswerRecord } from '@/shared/db';

describe('normalizeQuestion', () => {
  it('lowercases, strips punctuation, drops filler', () => {
    expect(normalizeQuestion('Why do you want to work here?')).toBe('want work here');
  });
  it('collapses whitespace', () => {
    expect(normalizeQuestion('  Salary   expectations!! ')).toBe('salary expectations');
  });
});

describe('intentTag', () => {
  it('tags common application questions', () => {
    expect(intentTag('Why do you want to work here?')).toBe('why_company');
    expect(intentTag('What are your salary expectations?')).toBe('salary');
    expect(intentTag('Are you legally authorized to work in the US?')).toBe('work_auth');
    expect(intentTag('Do you require visa sponsorship?')).toBe('sponsorship');
    expect(intentTag('Are you willing to relocate?')).toBe('relocate');
  });
  it('falls back to other', () => {
    expect(intentTag('Describe your favorite color')).toBe('other');
  });
});

describe('dice', () => {
  it('is 1 for identical strings', () => {
    expect(dice('hello world', 'hello world')).toBe(1);
  });
  it('is 0 for fully disjoint strings', () => {
    expect(dice('abcd', 'wxyz')).toBe(0);
  });
  it('is between 0 and 1 for partial overlap', () => {
    const s = dice('why work here', 'why work there');
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThan(1);
  });
});

function rec(p: Partial<AnswerRecord> & { normalizedQuestion: string; intentTag: string }): AnswerRecord {
  return { id: p.normalizedQuestion, question: '', answer: 'A', updatedAt: 0, ...p };
}

describe('bestMatch', () => {
  const bank: AnswerRecord[] = [
    rec({ normalizedQuestion: 'want work here', intentTag: 'why_company', answer: 'Because mission.' }),
    rec({ normalizedQuestion: 'salary expectations', intentTag: 'salary', answer: '140k' }),
  ];

  it('returns an exact normalized match with score 1', () => {
    const m = bestMatch('want work here', 'why_company', bank);
    expect(m?.kind).toBe('exact');
    expect(m?.record.answer).toBe('Because mission.');
  });

  it('returns a fuzzy match within the same intent above threshold', () => {
    const m = bestMatch('want to work here please', 'why_company', bank);
    expect(m?.kind).toBe('fuzzy');
    expect(m?.record.answer).toBe('Because mission.');
  });

  it('returns null when no candidate clears the threshold', () => {
    expect(bestMatch('describe a conflict you resolved', 'other', bank)).toBeNull();
  });

  it('does not cross intent tags for fuzzy matches', () => {
    // close to a salary entry textually but tagged why_company → no salary reuse
    expect(bestMatch('salary expectation', 'why_company', bank)).toBeNull();
  });
});
