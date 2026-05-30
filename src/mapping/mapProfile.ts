// Tier-1 deterministic mapping (DESIGN.md §7): label keyword -> canonical profile
// value. No AI. Confidence is driven by how trustworthy the label source is.
import type { CandidateProfile, ControlType, FieldDescriptor, FieldFill } from '@/shared/types';
import { normalizePhone, normalizeUrl } from './format';

const TIER1_TYPES = new Set<ControlType>(['text', 'email', 'tel', 'url', 'textarea']);

const SOURCE_WEIGHT: Record<string, number> = {
  'label-for': 1,
  'label-wrap': 1,
  legend: 1,
  'aria-labelledby': 1,
  'aria-label': 0.9,
  placeholder: 0.6,
  'name-token': 0.5,
  none: 0,
};

const REVIEW_THRESHOLD = 0.85;

interface Rule {
  re: RegExp;
  get: (p: CandidateProfile) => string | undefined;
}

// Order = priority; first matching rule wins. first/last must precede full name.
const RULES: Rule[] = [
  { re: /\be-?mail\b/, get: (p) => p.personal.email },
  { re: /\b(phone|mobile|telephone|cell)\b/, get: (p) => normalizePhone(p.personal.phone) },
  { re: /linkedin/, get: (p) => maybeUrl(p.personal.links.linkedin) },
  { re: /github/, get: (p) => maybeUrl(p.personal.links.github) },
  { re: /\b(portfolio|website|personal site)\b/, get: (p) => maybeUrl(p.personal.links.portfolio) },
  { re: /\b(first ?name|given name|fname|forename)\b/, get: (p) => p.personal.firstName },
  { re: /\b(last ?name|surname|family name|lname)\b/, get: (p) => p.personal.lastName },
  { re: /\b(full name|your name)\b/, get: (p) => fullName(p) },
  { re: /\b(city|town)\b/, get: (p) => p.personal.location.city },
];

function maybeUrl(raw?: string): string | undefined {
  return raw ? normalizeUrl(raw) : undefined;
}

function fullName(p: CandidateProfile): string {
  return `${p.personal.firstName} ${p.personal.lastName}`.trim();
}

const FREEFORM_MAX_LEN = 70;

// A keyword can appear inside a long freeform question ("...what email did you
// use?"). Deterministic mapping must NOT fire on those — questions and long
// labels are answered by AI / review, never auto-filled (DESIGN.md §7).
function isFreeform(label: string): boolean {
  const l = label.trim();
  return l.endsWith('?') || l.length > FREEFORM_MAX_LEN;
}

// Option-based eligibility fields (yes/no dropdowns + radios). DESIGN.md §4 §7.
const OPTION_TYPES = new Set<ControlType>(['select', 'radio']);
const YES = /^\s*(yes|y|true)\b/i;
const NO = /^\s*(no|n|false)\b/i;

const ELIGIBILITY_RULES: { re: RegExp; get: (p: CandidateProfile) => boolean }[] = [
  { re: /sponsor|visa/, get: (p) => p.eligibility.requiresSponsorship },
  { re: /authoriz|eligible to work|legally|right to work/, get: (p) => p.eligibility.workAuthorized },
  { re: /relocat/, get: (p) => p.eligibility.willingToRelocate },
];

function pickYesNo(options: { value: string; label: string }[], want: boolean): string | null {
  const re = want ? YES : NO;
  const opt = options.find((o) => re.test(o.label) || re.test(o.value));
  return opt ? opt.value : null;
}

function mapEligibility(field: FieldDescriptor, profile: CandidateProfile): FieldFill | null {
  if (!OPTION_TYPES.has(field.controlType) || !field.options) return null;
  const label = field.label.toLowerCase();
  for (const rule of ELIGIBILITY_RULES) {
    if (!rule.re.test(label)) continue;
    const value = pickYesNo(field.options, rule.get(profile));
    if (value == null) return null;
    return {
      fieldId: field.id,
      selector: field.selector,
      value,
      confidence: SOURCE_WEIGHT[field.labelSource] ?? 0.5,
      source: 'deterministic',
      needsReview: true, // eligibility is sensitive — always confirm
    };
  }
  return null;
}

function mapText(field: FieldDescriptor, profile: CandidateProfile): FieldFill | null {
  if (isFreeform(field.label)) return null;
  const label = field.label.toLowerCase();
  for (const rule of RULES) {
    if (!rule.re.test(label)) continue;
    const value = rule.get(profile);
    if (!value) return null; // canonical match but no profile data — nothing to fill
    const confidence = SOURCE_WEIGHT[field.labelSource] ?? 0.5;
    return {
      fieldId: field.id,
      selector: field.selector,
      value,
      confidence,
      source: 'deterministic',
      needsReview: confidence < REVIEW_THRESHOLD,
    };
  }
  return null;
}

export function mapField(field: FieldDescriptor, profile: CandidateProfile): FieldFill | null {
  if (TIER1_TYPES.has(field.controlType)) return mapText(field, profile);
  return mapEligibility(field, profile);
}

export function mapDeterministic(
  fields: FieldDescriptor[],
  profile: CandidateProfile,
): FieldFill[] {
  return fields
    .map((f) => mapField(f, profile))
    .filter((f): f is FieldFill => f !== null);
}
