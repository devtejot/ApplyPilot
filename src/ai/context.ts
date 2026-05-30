// Compact, deterministic AI context from a profile, plus selection of which
// form fields warrant an AI-generated answer (DESIGN.md §5,§7).
import type { CandidateProfile, FieldDescriptor } from '@/shared/types';

export interface AiQuestion {
  id: string;
  text: string;
  maxLength?: number;
}

/** Build a compact profile block for the AI prompt — top items only, no dumping. */
export function buildProfileContext(p: CandidateProfile): string {
  const lines: string[] = [];
  const name = `${p.personal.firstName} ${p.personal.lastName}`.trim();
  if (name) lines.push(`Name: ${name}`);
  if (p.summary) lines.push(`Summary: ${p.summary}`);

  const loc = [p.personal.location.city, p.personal.location.state, p.personal.location.country]
    .filter(Boolean)
    .join(', ');
  if (loc) lines.push(`Location: ${loc}`);

  const links = Object.entries(p.personal.links)
    .filter(([, v]) => typeof v === 'string' && v)
    .map(([k, v]) => `${k}: ${v as string}`);
  if (links.length) lines.push(`Links: ${links.join('; ')}`);

  lines.push(
    `Eligibility: work authorized ${yn(p.eligibility.workAuthorized)}, ` +
      `needs sponsorship ${yn(p.eligibility.requiresSponsorship)}, ` +
      `will relocate ${yn(p.eligibility.willingToRelocate)}`,
  );

  if (p.skills.length) lines.push(`Skills: ${p.skills.join(', ')}`);

  if (p.workHistory.length) {
    lines.push('Experience:');
    for (const w of p.workHistory.slice(0, 3)) {
      const bullets = w.bullets.slice(0, 2).join('; ');
      lines.push(`- ${w.title} at ${w.company} (${w.startDate}–${w.endDate})${bullets ? `: ${bullets}` : ''}`);
    }
  }

  if (p.education.length) {
    lines.push('Education:');
    for (const e of p.education.slice(0, 2)) {
      lines.push(`- ${e.degree} ${e.field}, ${e.school}${e.endDate ? ` (${e.endDate})` : ''}`);
    }
  }

  return lines.join('\n');
}

function yn(b: boolean): string {
  return b ? 'yes' : 'no';
}

const FREEFORM_MIN_LEN = 40;

function isFreeformLabel(label: string): boolean {
  const l = label.trim();
  return l.endsWith('?') || l.length > FREEFORM_MIN_LEN;
}

/**
 * Pick the fields an LLM should answer: unmapped freeform text — every textarea,
 * plus text inputs whose label reads like a question. Skips file/select/radio/
 * checkbox/combobox and anything already filled deterministically.
 */
export function selectAiQuestions(fields: FieldDescriptor[], filledIds: string[]): AiQuestion[] {
  const filled = new Set(filledIds);
  const out: AiQuestion[] = [];
  for (const f of fields) {
    if (filled.has(f.id)) continue;
    if (f.controlType !== 'text' && f.controlType !== 'textarea') continue;
    if (f.controlType === 'text' && !isFreeformLabel(f.label)) continue;
    out.push(f.maxLength ? { id: f.id, text: f.label, maxLength: f.maxLength } : { id: f.id, text: f.label });
  }
  return out;
}
