import { describe, it, expect } from 'vitest';
import { buildAnalysisUser, buildAnswersUser, buildCoverLetterUser } from './prompts';
import type { JobDescription } from '@/shared/types';

const jd: JobDescription = {
  title: 'Backend Engineer',
  company: 'Acme',
  text: 'We need Go and Kubernetes experience.',
  url: 'https://boards.greenhouse.io/acme/jobs/1',
  extractedBy: 'adapter',
};

describe('buildAnalysisUser', () => {
  it('embeds the profile context and the job description', () => {
    const out = buildAnalysisUser('PROFILE_BLOCK', jd);
    expect(out).toContain('PROFILE_BLOCK');
    expect(out).toContain('Backend Engineer');
    expect(out).toContain('Go and Kubernetes');
  });
});

describe('buildAnswersUser', () => {
  it('embeds the profile, job, and every question with its id', () => {
    const out = buildAnswersUser('PROFILE_BLOCK', jd, [
      { id: 'q1', text: 'Why us?' },
      { id: 'q2', text: 'Salary expectation?', maxLength: 100 },
    ]);
    expect(out).toContain('PROFILE_BLOCK');
    expect(out).toContain('Acme');
    expect(out).toContain('q1');
    expect(out).toContain('Why us?');
    expect(out).toContain('q2');
    expect(out).toContain('100');
  });
});

describe('buildCoverLetterUser', () => {
  it('embeds the profile and the job', () => {
    const out = buildCoverLetterUser('PROFILE_BLOCK', jd);
    expect(out).toContain('PROFILE_BLOCK');
    expect(out).toContain('Acme');
    expect(out).toContain('Backend Engineer');
  });
});
