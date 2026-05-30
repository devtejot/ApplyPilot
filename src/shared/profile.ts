// Profile persistence over chrome.storage.local (DESIGN.md §10). The real profile
// setup UI lands in Slice 2; SAMPLE_PROFILE lets Slice 1 demo end-to-end now.
import type { CandidateProfile } from "./types";

const KEY = "profile";

export async function loadProfile(): Promise<CandidateProfile | null> {
  const res = await chrome.storage.local.get(KEY);
  return (res[KEY] as CandidateProfile | undefined) ?? null;
}

export async function saveProfile(profile: CandidateProfile): Promise<void> {
  await chrome.storage.local.set({ [KEY]: profile });
}

export function emptyProfile(): CandidateProfile {
  return {
    version: 1,
    personal: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      location: { city: '', state: '', country: '' },
      links: {},
    },
    eligibility: { workAuthorized: false, requiresSponsorship: false, willingToRelocate: false },
    resume: { fileName: '', text: '', updatedAt: 0 },
    workHistory: [],
    education: [],
    skills: [],
    projects: [],
    certifications: [],
  };
}

export const SAMPLE_PROFILE: CandidateProfile = {
  version: 1,
  personal: {
    firstName: "Dev",
    lastName: "Tejot",
    email: "dev@example.com",
    phone: "+1 (415) 555-1234",
    location: {
      city: "Austin",
      state: "TX",
      country: "USA",
      postalCode: "78701",
    },
    links: {
      linkedin: "linkedin.com/in/devtejot",
      github: "github.com/devtejot",
      portfolio: "devtejot.dev",
    },
  },
  eligibility: {
    workAuthorized: true,
    requiresSponsorship: false,
    willingToRelocate: true,
    desiredSalary: "140k-160k",
  },
  resume: {
    fileName: "dev-tejot-resume.pdf",
    text: "Senior backend engineer…",
    updatedAt: Date.now(),
  },
  workHistory: [
    {
      company: "Globex",
      title: "Senior Backend Engineer",
      startDate: "2021-03",
      endDate: "present",
      bullets: [
        "Built distributed Go services on Kubernetes",
        "Cut p99 latency 40%",
      ],
    },
  ],
  education: [
    {
      school: "UT Austin",
      degree: "BS",
      field: "Computer Science",
      endDate: "2018",
    },
  ],
  skills: ["Go", "TypeScript", "Kubernetes", "PostgreSQL", "gRPC"],
  projects: [],
  certifications: [],
  summary: "Backend engineer with 7 years building distributed systems in Go.",
};
