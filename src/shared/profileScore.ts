// Weighted profile completeness (0–100). Distinct from isProfileComplete
// (profileSchema.ts), which is the hard "ready to fill" gate (name + email).
// This nudges users to fill the fields that make autofill + AI answers better.
import type { CandidateProfile } from './types';

export interface ProfileScore {
  percent: number; // 0..100
  missing: string[]; // human labels of notable gaps, most-impactful first
}

interface Check {
  label: string;
  weight: number;
  ok: (p: CandidateProfile) => boolean;
}

const has = (s?: string) => !!s && s.trim() !== '';

// Order = impact; weights bias toward fields portals ask for most.
const CHECKS: Check[] = [
  { label: 'Name', weight: 2, ok: (p) => has(p.personal.firstName) && has(p.personal.lastName) },
  { label: 'Email', weight: 2, ok: (p) => /\S+@\S+\.\S+/.test(p.personal.email) },
  { label: 'Phone', weight: 1, ok: (p) => has(p.personal.phone) },
  { label: 'Location', weight: 1, ok: (p) => has(p.personal.location.city) && has(p.personal.location.country) },
  { label: 'LinkedIn', weight: 1, ok: (p) => has(p.personal.links.linkedin) },
  { label: 'Resume', weight: 2, ok: (p) => has(p.resume.text) },
  { label: 'Work history', weight: 2, ok: (p) => p.workHistory.length > 0 },
  { label: 'Education', weight: 1, ok: (p) => p.education.length > 0 },
  { label: 'Skills', weight: 1, ok: (p) => p.skills.length > 0 },
  { label: 'Summary', weight: 1, ok: (p) => has(p.summary) },
];

export function profileScore(p: CandidateProfile): ProfileScore {
  const total = CHECKS.reduce((s, c) => s + c.weight, 0);
  const got = CHECKS.reduce((s, c) => s + (c.ok(p) ? c.weight : 0), 0);
  return {
    percent: Math.round((got / total) * 100),
    missing: CHECKS.filter((c) => !c.ok(p)).map((c) => c.label),
  };
}
