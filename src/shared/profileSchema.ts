// Runtime validation for the candidate profile (DESIGN.md §15 — Zod is the
// keystone). Shape/type validation on save + import; completeness is separate
// (a profile can be saved partial, but only a complete one is "ready").
import { z } from 'zod';
import type { CandidateProfile } from './types';

const workItem = z.object({
  company: z.string(),
  title: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  location: z.string().optional(),
  bullets: z.array(z.string()),
});

const educationItem = z.object({
  school: z.string(),
  degree: z.string(),
  field: z.string(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  gpa: z.string().optional(),
});

const projectItem = z.object({
  name: z.string(),
  description: z.string(),
  url: z.string().optional(),
  tech: z.array(z.string()).optional(),
});

const certItem = z.object({
  name: z.string(),
  issuer: z.string(),
  date: z.string().optional(),
});

export const profileSchema = z.object({
  version: z.literal(1),
  personal: z.object({
    firstName: z.string(),
    lastName: z.string(),
    middleName: z.string().optional(),
    preferredName: z.string().optional(),
    email: z.string(),
    phone: z.string(),
    pronouns: z.string().optional(),
    dateOfBirth: z.string().optional(),
    languages: z.array(z.string()).optional(),
    location: z.object({
      line1: z.string().optional(),
      city: z.string(),
      state: z.string(),
      country: z.string(),
      postalCode: z.string().optional(),
    }),
    links: z.object({
      linkedin: z.string().optional(),
      github: z.string().optional(),
      portfolio: z.string().optional(),
      twitter: z.string().optional(),
      other: z.array(z.string()).optional(),
    }),
  }),
  eligibility: z.object({
    workAuthorized: z.boolean(),
    requiresSponsorship: z.boolean(),
    willingToRelocate: z.boolean(),
    remoteOnly: z.boolean().optional(),
    noticePeriodDays: z.number().optional(),
    noticePeriod: z.string().optional(),
    desiredSalary: z.string().optional(),
    currentSalary: z.string().optional(),
    expectedSalary: z.string().optional(),
    availableStartDate: z.string().optional(),
    yearsExperience: z.string().optional(),
    citizenship: z.string().optional(),
    workAuthCountry: z.string().optional(),
  }),
  demographics: z
    .object({
      gender: z.string().optional(),
      raceEthnicity: z.string().optional(),
      veteranStatus: z.string().optional(),
      disabilityStatus: z.string().optional(),
    })
    .optional(),
  howHeard: z.string().optional(),
  resume: z.object({
    fileName: z.string(),
    text: z.string(),
    blobId: z.string().optional(),
    updatedAt: z.number(),
  }),
  workHistory: z.array(workItem),
  education: z.array(educationItem),
  skills: z.array(z.string()),
  projects: z.array(projectItem),
  certifications: z.array(certItem),
  summary: z.string().optional(),
});

// Compile-time guard: schema output must be assignable to the hand-written type.
const _typecheck: CandidateProfile = {} as z.infer<typeof profileSchema>;
void _typecheck;

const emailSchema = z.string().email();

/** Core fields needed before the profile is usable for filling. */
export function isProfileComplete(p: CandidateProfile): boolean {
  return (
    p.personal.firstName.trim() !== '' &&
    p.personal.lastName.trim() !== '' &&
    emailSchema.safeParse(p.personal.email).success
  );
}
