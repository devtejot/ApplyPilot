// JSON contracts between the extension and the AI (DESIGN.md §5). One Zod schema
// per task = the source of truth for structured output + runtime validation.
import { z } from 'zod';

export const jobAnalysisSchema = z.object({
  title: z.string(),
  company: z.string(),
  seniority: z.string(),
  keyRequirements: z.array(z.string()),
  niceToHave: z.array(z.string()),
  redFlags: z.array(z.string()),
});

export const matchScoreSchema = z.object({
  score: z.number().int().min(0).max(100),
  verdict: z.enum(['strong', 'moderate', 'weak']),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
  recommendation: z.string(),
});

export const analysisResponseSchema = z.object({
  analysis: jobAnalysisSchema,
  match: matchScoreSchema,
});

export const coverLetterSchema = z.object({
  coverLetter: z.string(),
});

export const answersResponseSchema = z.object({
  answers: z.array(
    z.object({
      id: z.string(),
      answer: z.string(),
      confidence: z.number().min(0).max(1),
    }),
  ),
});

export const resumeResponseSchema = z.object({
  name: z.string(),
  headline: z.string(),
  contact: z.object({
    email: z.string().optional(),
    phone: z.string().optional(),
    location: z.string().optional(),
    links: z.array(z.string()).optional(),
  }),
  summary: z.string(),
  experience: z.array(
    z.object({
      company: z.string(),
      location: z.string().optional(),
      title: z.string(),
      dates: z.string(),
      stack: z.string().optional(),
      bullets: z.array(z.string()),
    }),
  ),
  skills: z.array(z.object({ label: z.string(), items: z.string() })),
  projects: z
    .array(
      z.object({
        name: z.string(),
        stack: z.string().optional(),
        link: z.string().optional(),
        bullets: z.array(z.string()),
      }),
    )
    .optional(),
  education: z.array(
    z.object({
      school: z.string(),
      location: z.string().optional(),
      degree: z.string(),
      dates: z.string().optional(),
      coursework: z.string().optional(),
    }),
  ),
});

export type JobAnalysis = z.infer<typeof jobAnalysisSchema>;
export type MatchScore = z.infer<typeof matchScoreSchema>;
export type AnalysisResponse = z.infer<typeof analysisResponseSchema>;
export type AnswersResponse = z.infer<typeof answersResponseSchema>;
export type CoverLetterResponse = z.infer<typeof coverLetterSchema>;
export type ResumeResponse = z.infer<typeof resumeResponseSchema>;
