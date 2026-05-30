import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/shared/db';
import { saveAnswer, findReusable } from './answerBank';

beforeEach(async () => {
  await db.answerBank.clear();
});

describe('answerBank', () => {
  it('saves an answer and reuses it on an exact question', async () => {
    await saveAnswer('Why do you want to work here?', 'I love the mission.');
    const m = await findReusable('Why do you want to work here?');
    expect(m?.kind).toBe('exact');
    expect(m?.record.answer).toBe('I love the mission.');
  });

  it('reuses on a fuzzy variant of the same question', async () => {
    await saveAnswer('What are your salary expectations?', '$140k');
    const m = await findReusable('What is your salary expectation?');
    expect(m?.record.answer).toBe('$140k');
  });

  it('returns null when nothing matches', async () => {
    await saveAnswer('Why us?', 'Mission.');
    expect(await findReusable('Describe a time you failed')).toBeNull();
  });

  it('guards against leaking a different company name', async () => {
    await saveAnswer('Why do you want to work here?', 'Excited to join Acme!', 'Acme');
    // Same question, but now applying to Beta — must not reuse the Acme-specific answer
    expect(await findReusable('Why do you want to work here?', 'Beta')).toBeNull();
  });
});
