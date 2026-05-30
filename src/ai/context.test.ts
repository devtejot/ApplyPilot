import { describe, it, expect } from 'vitest';
import type { CandidateProfile, FieldDescriptor } from '@/shared/types';
import { buildProfileContext, selectAiQuestions } from './context';

const profile: CandidateProfile = {
  version: 1,
  personal: {
    firstName: 'Dev',
    lastName: 'Tejot',
    email: 'dev@example.com',
    phone: '+1 415 555 1234',
    location: { city: 'Austin', state: 'TX', country: 'USA' },
    links: { linkedin: 'linkedin.com/in/dev', github: 'github.com/dev' },
  },
  eligibility: { workAuthorized: true, requiresSponsorship: false, willingToRelocate: true },
  resume: { fileName: 'cv.pdf', text: '...', updatedAt: 0 },
  workHistory: [
    { company: 'Globex', title: 'Senior Backend Engineer', startDate: '2021', endDate: 'present', bullets: ['Built Go services'] },
  ],
  education: [{ school: 'UT Austin', degree: 'BS', field: 'CS', endDate: '2018' }],
  skills: ['Go', 'Kubernetes'],
  projects: [],
  certifications: [],
  summary: 'Backend engineer, 7 years.',
};

function field(p: Partial<FieldDescriptor> & { id: string; label: string }): FieldDescriptor {
  return { selector: `#${p.id}`, controlType: 'text', labelSource: 'label-for', required: false, ...p };
}

describe('buildProfileContext', () => {
  it('includes name, summary, a skill, a work entry, and a link', () => {
    const ctx = buildProfileContext(profile);
    expect(ctx).toContain('Dev Tejot');
    expect(ctx).toContain('Backend engineer, 7 years.');
    expect(ctx).toContain('Go');
    expect(ctx).toContain('Globex');
    expect(ctx).toContain('linkedin.com/in/dev');
  });

  it('does not throw on an empty profile', () => {
    const empty: CandidateProfile = {
      ...profile,
      summary: undefined,
      workHistory: [],
      education: [],
      skills: [],
      personal: { ...profile.personal, links: {} },
    };
    expect(() => buildProfileContext(empty)).not.toThrow();
  });
});

describe('selectAiQuestions', () => {
  const fields = [
    field({ id: 'q1', label: 'Why do you want to work here?', controlType: 'textarea' }),
    field({ id: 'q2', label: 'If you were previously employed here, explain the circumstances of your departure', controlType: 'text' }),
    field({ id: 'fn', label: 'First name', controlType: 'text' }),
    field({ id: 'cv', label: 'Resume', controlType: 'file' }),
    field({ id: 'auth', label: 'Work authorized?', controlType: 'select' }),
  ];

  it('selects unmapped freeform textareas and long/question text fields', () => {
    const qs = selectAiQuestions(fields, ['fn']);
    expect(qs.map((q) => q.id).sort()).toEqual(['q1', 'q2']);
  });

  it('excludes fields already filled deterministically', () => {
    const qs = selectAiQuestions(fields, ['fn', 'q1']);
    expect(qs.map((q) => q.id)).toEqual(['q2']);
  });

  it('excludes file/select and short plain text fields', () => {
    const qs = selectAiQuestions(fields, []);
    expect(qs.map((q) => q.id)).not.toContain('cv');
    expect(qs.map((q) => q.id)).not.toContain('auth');
    expect(qs.map((q) => q.id)).not.toContain('fn');
  });

  it('carries the field label as the question text and maxLength', () => {
    const qs = selectAiQuestions([field({ id: 'q', label: 'Why us?', controlType: 'textarea', maxLength: 500 })], []);
    expect(qs[0]).toEqual({ id: 'q', text: 'Why us?', maxLength: 500 });
  });
});
