// Tier-1 deterministic mapping (DESIGN.md §7): label keyword -> canonical profile
// value. No AI. Confidence is driven by how trustworthy the label source is.
// Locale (profile country) shapes phone formatting. Sensitive/eligibility/
// demographic answers always need review.
import type { CandidateProfile, ControlType, FieldDescriptor, FieldFill } from '@/shared/types';
import { dice } from '@/reuse/reuse';
import { normalizeLabel, tokenizeLabel } from '@/forms/normalizeLabel';
import { normalizePhone, normalizeUrl } from './format';

// Text-like controls the rules below can fill. number/date included for salary,
// years-of-experience, start date, DOB, postal, graduation year, etc.
const TIER1_TYPES = new Set<ControlType>(['text', 'email', 'tel', 'url', 'textarea', 'number', 'date']);

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

const currentJob = (p: CandidateProfile) => p.workHistory[0];
const latestEdu = (p: CandidateProfile) => p.education[0];
const list = (xs?: string[]) => (xs && xs.length ? xs.join(', ') : undefined);

// Order = priority; first matching rule wins. Specific labels precede generic.
const RULES: Rule[] = [
  // Contact + links
  { re: /\be-?mail\b/, get: (p) => p.personal.email },
  { re: /\b(phone|mobile|telephone|cell|contact (number|no))\b/, get: (p) => normalizePhone(p.personal.phone, p.personal.location.country) },
  { re: /linked\s?in|\bli profile\b/, get: (p) => maybeUrl(p.personal.links.linkedin) },
  { re: /git\s?hub/, get: (p) => maybeUrl(p.personal.links.github) },
  { re: /\b(twitter|x handle|x profile)\b/, get: (p) => maybeUrl(p.personal.links.twitter) },
  { re: /\b(portfolio|personal (web)?site|personal page|blog|website|web ?site)\b/, get: (p) => maybeUrl(p.personal.links.portfolio) },

  // Names
  { re: /\b(preferred name|nick ?name|known as)\b/, get: (p) => p.personal.preferredName },
  { re: /\bmiddle name\b/, get: (p) => p.personal.middleName },
  { re: /\b(first ?name|given name|fname|forename)\b/, get: (p) => p.personal.firstName },
  { re: /\b(last ?name|surname|family name|lname)\b/, get: (p) => p.personal.lastName },
  { re: /\b(full name|your name|legal name|candidate name)\b/, get: (p) => fullName(p) },
  { re: /\bpronouns?\b/, get: (p) => p.personal.pronouns },
  { re: /\b(date of birth|d\.?o\.?b\.?|birth ?date)\b/, get: (p) => p.personal.dateOfBirth },

  // Address (line-2 guard first so it isn't filled with line 1)
  { re: /(address|street)\s*(line\s*)?2\b|line\s*2\b/, get: () => undefined },
  { re: /\b(street address|address line 1|street|mailing address)\b/, get: (p) => p.personal.location.line1 },
  { re: /\b(city|town)\b/, get: (p) => p.personal.location.city },
  { re: /\b(state|province|region)\b(?!.*code)/, get: (p) => p.personal.location.state },
  { re: /\b(country|country of residence)\b(?!.*code)/, get: (p) => p.personal.location.country },
  { re: /\b(zip|postal|pin ?code|post ?code)\b/, get: (p) => p.personal.location.postalCode },
  { re: /\baddress\b/, get: (p) => p.personal.location.line1 },

  // Current employment (from latest work item)
  { re: /\b(current|present)\s+(employer|company|organi[sz]ation)\b/, get: (p) => currentJob(p)?.company },
  { re: /\b(current|present)\s+(title|role|designation|position|job title)\b/, get: (p) => currentJob(p)?.title },

  // Compensation (current/expected, CTC synonyms)
  { re: /\b(current|present)\s+(ctc|salary|compensation|pay)\b/, get: (p) => p.eligibility.currentSalary },
  {
    re: /\b(expected|desired)\s+(ctc|salary|compensation|pay)\b|salary expectation|compensation expectation/,
    get: (p) => p.eligibility.expectedSalary ?? p.eligibility.desiredSalary,
  },

  // Availability / experience (notice period before generic "notice"/start)
  { re: /\bnotice period\b/, get: (p) => p.eligibility.noticePeriod },
  { re: /\b(years?\s+of\s+experience|total\s+experience|years?\s+exp\b|yrs?\s+exp)\b/, get: (p) => p.eligibility.yearsExperience },
  { re: /\b(available start|start date|availability|date of joining|joining date|earliest start|available to start)\b/, get: (p) => p.eligibility.availableStartDate },

  // Identity / work auth
  { re: /\b(citizenship|citizen of|nationality)\b/, get: (p) => p.eligibility.citizenship },

  // Education (latest)
  { re: /\b(university|college|school|alma mater|institution)\b/, get: (p) => latestEdu(p)?.school },
  { re: /\b(degree|qualification|highest education)\b/, get: (p) => latestEdu(p)?.degree },
  { re: /\b(field of study|major|specialization)\b/, get: (p) => latestEdu(p)?.field },
  { re: /\b(graduation|grad(uation)? year|year of passing|passing year|completion year)\b/, get: (p) => latestEdu(p)?.endDate },

  // Misc
  { re: /\blanguages?\b/, get: (p) => list(p.personal.languages) },
  { re: /\b(referral source|source of application|how did you find)\b/, get: (p) => p.howHeard },
];

function maybeUrl(raw?: string): string | undefined {
  return raw ? normalizeUrl(raw) : undefined;
}

function fullName(p: CandidateProfile): string {
  return `${p.personal.firstName} ${p.personal.lastName}`.trim();
}

// Fuzzy fallback (DESIGN.md §7): when no exact RULES keyword fires, match the
// label's tokens against canonical field aliases. Generic enough to catch
// unseen phrasings ("Url for linkedin", "Mobile no.", minor typos) without a
// rule per variant. Always low-confidence + needsReview — the user verifies
// before submit (the extension never auto-submits).
interface AliasGroup {
  aliases: string[];
  get: (p: CandidateProfile) => string | undefined;
}

const FIELD_ALIASES: AliasGroup[] = [
  { aliases: ['email', 'email address', 'e-mail'], get: (p) => p.personal.email },
  {
    aliases: ['phone', 'phone number', 'mobile', 'mobile number', 'contact number', 'telephone', 'cell phone'],
    get: (p) => normalizePhone(p.personal.phone, p.personal.location.country),
  },
  { aliases: ['linkedin', 'linkedin profile', 'linkedin url', 'linkedin link', 'linkedin page'], get: (p) => maybeUrl(p.personal.links.linkedin) },
  { aliases: ['github', 'github profile', 'github url'], get: (p) => maybeUrl(p.personal.links.github) },
  { aliases: ['portfolio', 'portfolio url', 'personal website', 'personal site'], get: (p) => maybeUrl(p.personal.links.portfolio) },
  { aliases: ['twitter', 'twitter handle', 'x profile'], get: (p) => maybeUrl(p.personal.links.twitter) },
  { aliases: ['first name', 'given name', 'forename'], get: (p) => p.personal.firstName },
  { aliases: ['last name', 'surname', 'family name'], get: (p) => p.personal.lastName },
  { aliases: ['preferred name', 'nickname'], get: (p) => p.personal.preferredName },
  { aliases: ['middle name'], get: (p) => p.personal.middleName },
  { aliases: ['full name', 'legal name', 'candidate name'], get: (p) => fullName(p) },
  { aliases: ['pronouns'], get: (p) => p.personal.pronouns },
  { aliases: ['street address', 'mailing address'], get: (p) => p.personal.location.line1 },
  { aliases: ['city', 'town'], get: (p) => p.personal.location.city },
  { aliases: ['state', 'province', 'region'], get: (p) => p.personal.location.state },
  { aliases: ['country'], get: (p) => p.personal.location.country },
  { aliases: ['postal code', 'zip code', 'pincode', 'pin code', 'postcode'], get: (p) => p.personal.location.postalCode },
  { aliases: ['current company', 'current employer', 'present employer'], get: (p) => currentJob(p)?.company },
  { aliases: ['current title', 'current role', 'current designation', 'job title'], get: (p) => currentJob(p)?.title },
  {
    aliases: ['expected salary', 'desired salary', 'salary expectation', 'expected compensation', 'expected ctc'],
    get: (p) => p.eligibility.expectedSalary ?? p.eligibility.desiredSalary,
  },
  { aliases: ['current salary', 'current ctc', 'current compensation'], get: (p) => p.eligibility.currentSalary },
  { aliases: ['notice period'], get: (p) => p.eligibility.noticePeriod },
  { aliases: ['years of experience', 'total experience', 'experience in years'], get: (p) => p.eligibility.yearsExperience },
  { aliases: ['available start date', 'start date', 'joining date', 'date of joining', 'availability'], get: (p) => p.eligibility.availableStartDate },
  { aliases: ['citizenship', 'nationality'], get: (p) => p.eligibility.citizenship },
  { aliases: ['university', 'college', 'institution', 'alma mater'], get: (p) => latestEdu(p)?.school },
  { aliases: ['degree', 'qualification'], get: (p) => latestEdu(p)?.degree },
  { aliases: ['field of study', 'major', 'specialization'], get: (p) => latestEdu(p)?.field },
];

const FUZZY_THRESHOLD = 0.8;
const FUZZY_CONFIDENCE = 0.6;

// Token-subset match (all alias words present) is strong; otherwise fall back to
// character-bigram similarity for typos / glued words. Single-word aliases only
// trust short labels, so a stray "city" inside a long sentence won't fire.
function aliasScore(label: string, labelTokens: Set<string>, alias: string): number {
  const aTokens = tokenizeLabel(alias);
  if (aTokens.length === 0) return 0;
  if (aTokens.every((t) => labelTokens.has(t))) {
    if (aTokens.length >= 2) return 0.95;
    return labelTokens.size <= 4 ? 0.9 : 0;
  }
  return dice(label, alias);
}

function mapFuzzy(field: FieldDescriptor, profile: CandidateProfile): FieldFill | null {
  const label = normalizeLabel(field.label);
  const labelTokens = new Set(tokenizeLabel(field.label));
  if (labelTokens.size === 0) return null;
  let best: { value: string; score: number } | null = null;
  for (const group of FIELD_ALIASES) {
    let groupScore = 0;
    for (const alias of group.aliases) groupScore = Math.max(groupScore, aliasScore(label, labelTokens, alias));
    if (groupScore < FUZZY_THRESHOLD) continue;
    const value = group.get(profile);
    if (value && (!best || groupScore > best.score)) best = { value, score: groupScore };
  }
  if (!best) return null;
  return {
    fieldId: field.id,
    selector: field.selector,
    value: best.value,
    confidence: FUZZY_CONFIDENCE,
    source: 'deterministic',
    needsReview: true,
  };
}

const FREEFORM_MAX_LEN = 70;

// A keyword can appear inside a long freeform question ("...what email did you
// use?"). Deterministic mapping must NOT fire on those — questions and long
// labels are answered by AI / review, never auto-filled (DESIGN.md §7).
function isFreeform(label: string): boolean {
  const l = label.trim();
  return l.endsWith('?') || l.length > FREEFORM_MAX_LEN;
}

// Option-based fields (yes/no dropdowns + radios + comboboxes). DESIGN.md §4 §7.
const OPTION_TYPES = new Set<ControlType>(['select', 'radio']);
const YES = /^\s*(yes|y|true)\b/i;
const NO = /^\s*(no|n|false)\b/i;
const DECLINE = /decline|prefer not|don'?t wish|do not wish|not to (say|answer|disclose|identify)|rather not|no answer/i;

const ELIGIBILITY_RULES: { re: RegExp; get: (p: CandidateProfile) => boolean }[] = [
  { re: /sponsor|visa/, get: (p) => p.eligibility.requiresSponsorship },
  { re: /authoriz|eligible to work|legally|right to work|work permit/, get: (p) => p.eligibility.workAuthorized },
  { re: /relocat/, get: (p) => p.eligibility.willingToRelocate },
];

// Self-identification fields → user value, else a "decline" option. Never invented.
const DEMOGRAPHIC_RULES: { re: RegExp; get: (p: CandidateProfile) => string | undefined }[] = [
  { re: /\b(gender|sex)\b/, get: (p) => p.demographics?.gender },
  { re: /race|ethnic/, get: (p) => p.demographics?.raceEthnicity },
  { re: /veteran|military/, get: (p) => p.demographics?.veteranStatus },
  { re: /disab/, get: (p) => p.demographics?.disabilityStatus },
];

function pickYesNo(options: { value: string; label: string }[], want: boolean): string | null {
  const re = want ? YES : NO;
  const opt = options.find((o) => re.test(o.label) || re.test(o.value));
  return opt ? opt.value : null;
}

function pickByText(options: { value: string; label: string }[], want: string): string | null {
  const w = want.trim().toLowerCase();
  if (!w) return null;
  const opt = options.find((o) => o.label.toLowerCase().includes(w) || o.value.toLowerCase() === w);
  return opt ? opt.value : null;
}

function pickDecline(options: { value: string; label: string }[]): string | null {
  const opt = options.find((o) => DECLINE.test(o.label) || DECLINE.test(o.value));
  return opt ? opt.value : null;
}

function optionFill(field: FieldDescriptor, value: string): FieldFill {
  return {
    fieldId: field.id,
    selector: field.selector,
    value,
    confidence: SOURCE_WEIGHT[field.labelSource] ?? 0.5,
    source: 'deterministic',
    needsReview: true, // eligibility + demographics are sensitive — always confirm
  };
}

function mapEligibility(field: FieldDescriptor, profile: CandidateProfile): FieldFill | null {
  const isCombobox = field.controlType === 'combobox';
  if (!OPTION_TYPES.has(field.controlType) && !isCombobox) return null;
  if (!isCombobox && !field.options) return null;
  const label = field.label.toLowerCase();
  for (const rule of ELIGIBILITY_RULES) {
    if (!rule.re.test(label)) continue;
    const want = rule.get(profile);
    // combobox options aren't in the descriptor; emit yes/no — fillCombobox text-matches.
    const value = isCombobox ? (want ? 'yes' : 'no') : pickYesNo(field.options ?? [], want);
    if (value == null) return null;
    return optionFill(field, value);
  }
  return null;
}

function mapDemographics(field: FieldDescriptor, profile: CandidateProfile): FieldFill | null {
  const isCombobox = field.controlType === 'combobox';
  if (!OPTION_TYPES.has(field.controlType) && !isCombobox) return null;
  if (!isCombobox && !field.options) return null;
  const label = field.label.toLowerCase();
  for (const rule of DEMOGRAPHIC_RULES) {
    if (!rule.re.test(label)) continue;
    const userVal = rule.get(profile);
    let value: string | null;
    if (isCombobox) {
      value = userVal && userVal.trim() ? userVal : 'Decline to self-identify';
    } else {
      const opts = field.options ?? [];
      value = (userVal && pickByText(opts, userVal)) || pickDecline(opts);
    }
    if (value == null) return null;
    return optionFill(field, value);
  }
  return null;
}

function mapText(field: FieldDescriptor, profile: CandidateProfile): FieldFill | null {
  if (isFreeform(field.label)) return null;
  const label = normalizeLabel(field.label);
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
  // No exact keyword fired — try the fuzzy alias fallback (always review).
  return mapFuzzy(field, profile);
}

export function mapField(field: FieldDescriptor, profile: CandidateProfile): FieldFill | null {
  if (TIER1_TYPES.has(field.controlType)) return mapText(field, profile);
  return mapEligibility(field, profile) ?? mapDemographics(field, profile);
}

export function mapDeterministic(fields: FieldDescriptor[], profile: CandidateProfile): FieldFill[] {
  return fields.map((f) => mapField(f, profile)).filter((f): f is FieldFill => f !== null);
}
