import { describe, it, expect } from 'vitest';
import type { ZodType } from 'zod';
import type { AIProvider } from './provider';
import { analyzeJob, generateAnswers, generateCoverLetter, tailorResume } from './tasks';
import { analysisResponseSchema, answersResponseSchema, coverLetterSchema } from './contracts';
import type { JobDescription } from '@/shared/types';

const jd: JobDescription = {
  title: 'Backend Engineer',
  company: 'Acme',
  text: 'Go and Kubernetes.',
  url: 'https://x',
  extractedBy: 'adapter',
};

function recordingProvider(canned: unknown): { provider: AIProvider; calls: { schema: ZodType<unknown>; user: string }[] } {
  const calls: { schema: ZodType<unknown>; user: string }[] = [];
  const provider: AIProvider = {
    id: 'claude',
    async generateStructured(args) {
      calls.push({ schema: args.schema as ZodType<unknown>, user: args.user });
      return canned as never;
    },
  };
  return { provider, calls };
}

describe('analyzeJob', () => {
  it('uses the analysis schema and embeds the profile + JD', async () => {
    const canned = {
      analysis: { title: 'x', company: 'y', seniority: 'senior', keyRequirements: [], niceToHave: [], redFlags: [] },
      match: { score: 80, verdict: 'strong', strengths: [], gaps: [], recommendation: 'apply' },
    };
    const { provider, calls } = recordingProvider(canned);
    const out = await analyzeJob(provider, { jd, profileContext: 'PROFILE' });
    expect(out.match.score).toBe(80);
    expect(calls[0].schema).toBe(analysisResponseSchema);
    expect(calls[0].user).toContain('PROFILE');
    expect(calls[0].user).toContain('Backend Engineer');
  });
});

describe('generateAnswers', () => {
  it('uses the answers schema and embeds the questions', async () => {
    const canned = { answers: [{ id: 'q1', answer: 'because', confidence: 0.8 }] };
    const { provider, calls } = recordingProvider(canned);
    const out = await generateAnswers(provider, {
      jd,
      profileContext: 'PROFILE',
      questions: [{ id: 'q1', text: 'Why us?' }],
    });
    expect(out.answers[0].id).toBe('q1');
    expect(calls[0].schema).toBe(answersResponseSchema);
    expect(calls[0].user).toContain('q1');
  });
});

describe('generateCoverLetter', () => {
  it('uses the cover letter schema', async () => {
    const { provider, calls } = recordingProvider({ coverLetter: 'Dear team, ...' });
    const out = await generateCoverLetter(provider, { jd, profileContext: 'PROFILE' });
    expect(out.coverLetter).toContain('Dear team');
    expect(calls[0].schema).toBe(coverLetterSchema);
  });
});

describe("tailorResume", () => {
  it("calls the provider with the resume system prompt + schema and returns parsed output", async () => {
    const resume = {
      name: "Dev", headline: "Engineer", contact: {}, summary: "s",
      experience: [], skills: [], education: [],
    };
    let seen: { system: string; user: string } | null = null;
    const provider: AIProvider = {
      id: "gemini",
      generateStructured: async (args) => {
        seen = { system: args.system, user: args.user };
        return resume as unknown as never;
      },
    };
    const jd = { title: "FE Eng", company: "Acme", text: "JD", url: "u", extractedBy: "adapter" as const };
    const out = await tailorResume(provider, { jd, profileContext: "Name: Dev", resumeText: "RESUME" });
    expect(out).toEqual(resume);
    expect(seen!.system.toLowerCase()).toContain("never invent");
    expect(seen!.user).toContain("RESUME");
  });
});
