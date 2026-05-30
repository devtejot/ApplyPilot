// Provider-agnostic AI tasks. Build the prompt, pick the schema, delegate to the
// provider. Adding OpenAI/Gemini later requires no change here.
import type { JobDescription } from '@/shared/types';
import type { AIProvider } from './provider';
import type { AiQuestion } from './context';
import {
  analysisResponseSchema,
  answersResponseSchema,
  coverLetterSchema,
  type AnalysisResponse,
  type AnswersResponse,
  type CoverLetterResponse,
} from './contracts';
import {
  SYSTEM_ANALYSIS,
  SYSTEM_ANSWERS,
  SYSTEM_COVER_LETTER,
  buildAnalysisUser,
  buildAnswersUser,
  buildCoverLetterUser,
} from './prompts';

export function analyzeJob(
  provider: AIProvider,
  args: { jd: JobDescription; profileContext: string; signal?: AbortSignal },
): Promise<AnalysisResponse> {
  return provider.generateStructured({
    system: SYSTEM_ANALYSIS,
    user: buildAnalysisUser(args.profileContext, args.jd),
    schema: analysisResponseSchema,
    signal: args.signal,
  });
}

export function generateAnswers(
  provider: AIProvider,
  args: { jd: JobDescription; profileContext: string; questions: AiQuestion[]; signal?: AbortSignal },
): Promise<AnswersResponse> {
  return provider.generateStructured({
    system: SYSTEM_ANSWERS,
    user: buildAnswersUser(args.profileContext, args.jd, args.questions),
    schema: answersResponseSchema,
    signal: args.signal,
  });
}

export function generateCoverLetter(
  provider: AIProvider,
  args: { jd: JobDescription; profileContext: string; signal?: AbortSignal },
): Promise<CoverLetterResponse> {
  return provider.generateStructured({
    system: SYSTEM_COVER_LETTER,
    user: buildCoverLetterUser(args.profileContext, args.jd),
    schema: coverLetterSchema,
    signal: args.signal,
  });
}
