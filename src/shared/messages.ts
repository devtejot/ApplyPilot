// Message contract between content script, side panel, and background hub.
// Validated with Zod at every boundary (DESIGN.md §1). Background is the only
// router; content and panel never message each other directly.
import { z } from 'zod';
import { analysisResponseSchema } from '@/ai/contracts';

const AiQuestionSchema = z.object({
  id: z.string(),
  text: z.string(),
  maxLength: z.number().optional(),
});

const SiteIdSchema = z.enum([
  'linkedin',
  'greenhouse',
  'lever',
  'ashby',
  'workday',
  'smartrecruiters',
  'generic',
]);

const SiteMatchSchema = z.object({
  site: SiteIdSchema,
  confidence: z.number().min(0).max(1),
  url: z.string(),
});

const JobDescriptionSchema = z.object({
  title: z.string(),
  company: z.string(),
  location: z.string().optional(),
  text: z.string(),
  url: z.string(),
  extractedBy: z.enum(['adapter', 'readability', 'heuristic', 'manual']),
});

const FieldDescriptorSchema = z.object({
  id: z.string(),
  selector: z.string(),
  controlType: z.enum([
    'text',
    'email',
    'tel',
    'url',
    'number',
    'date',
    'textarea',
    'select',
    'radio',
    'checkbox',
    'file',
    'combobox',
  ]),
  label: z.string(),
  labelSource: z.string(),
  required: z.boolean(),
  options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
  group: z.string().optional(),
  maxLength: z.number().optional(),
  currentValue: z.string().optional(),
  frameId: z.number().optional(),
});

const FieldFillSchema = z.object({
  fieldId: z.string(),
  selector: z.string(),
  value: z.string(),
  confidence: z.number().min(0).max(1),
  source: z.enum(['deterministic', 'reuse', 'ai']),
  needsReview: z.boolean(),
});

const FillFailureSchema = z.object({
  fieldId: z.string(),
  reason: z.string(),
});

const ErrorCodeSchema = z.enum([
  'AI_TIMEOUT',
  'NO_JD',
  'UNSUPPORTED_FORM',
  'DYNAMIC_PAGE',
  'RATE_LIMIT',
  'NETWORK',
  'BAD_AI_JSON',
  'INVALID_KEY',
  'FILL_FAILED',
  'UNKNOWN',
]);

export const MsgSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('PING') }),
  z.object({ kind: z.literal('PONG'), from: z.string() }),
  z.object({ kind: z.literal('DETECT_SITE'), tabId: z.number() }),
  z.object({ kind: z.literal('SITE_RESULT'), site: SiteMatchSchema }),
  z.object({ kind: z.literal('EXTRACT_JD'), tabId: z.number() }),
  z.object({ kind: z.literal('JD_RESULT'), jd: JobDescriptionSchema }),
  z.object({ kind: z.literal('SCAN_FORM'), tabId: z.number() }),
  z.object({ kind: z.literal('FORM_RESULT'), fields: z.array(FieldDescriptorSchema) }),
  z.object({
    kind: z.literal('GENERATE'),
    jd: JobDescriptionSchema,
    fields: z.array(FieldDescriptorSchema),
  }),
  z.object({ kind: z.literal('FILL'), tabId: z.number(), map: z.array(FieldFillSchema) }),
  z.object({
    kind: z.literal('FILL_RESULT'),
    filled: z.array(z.string()),
    failed: z.array(FillFailureSchema),
  }),
  // AI (panel → background; background owns the key + makes the call)
  z.object({ kind: z.literal('ANALYZE'), jd: JobDescriptionSchema }),
  z.object({
    kind: z.literal('ANALYSIS_RESULT'),
    analysis: analysisResponseSchema.shape.analysis,
    match: analysisResponseSchema.shape.match,
  }),
  z.object({
    kind: z.literal('GENERATE_ANSWERS'),
    jd: JobDescriptionSchema,
    questions: z.array(AiQuestionSchema),
  }),
  z.object({
    kind: z.literal('ANSWERS_RESULT'),
    answers: z.array(
      z.object({ id: z.string(), answer: z.string(), confidence: z.number(), reused: z.boolean() }),
    ),
  }),
  z.object({ kind: z.literal('GENERATE_COVER_LETTER'), jd: JobDescriptionSchema }),
  z.object({ kind: z.literal('COVER_LETTER_RESULT'), coverLetter: z.string() }),
  z.object({ kind: z.literal('ERROR'), code: ErrorCodeSchema, detail: z.string() }),
]);

export type Msg = z.infer<typeof MsgSchema>;

/** Parse an unknown runtime message; returns null if it fails validation. */
export function parseMsg(raw: unknown): Msg | null {
  const result = MsgSchema.safeParse(raw);
  return result.success ? result.data : null;
}
