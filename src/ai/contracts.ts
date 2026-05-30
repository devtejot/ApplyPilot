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

export type JobAnalysis = z.infer<typeof jobAnalysisSchema>;
export type MatchScore = z.infer<typeof matchScoreSchema>;
export type AnalysisResponse = z.infer<typeof analysisResponseSchema>;
export type AnswersResponse = z.infer<typeof answersResponseSchema>;
export type CoverLetterResponse = z.infer<typeof coverLetterSchema>;
