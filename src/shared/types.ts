// Core domain types. Mirrors DESIGN.md §2,§3,§4,§6. Kept minimal for the
// scaffold; widened as slices land.

export type SiteId =
  | 'linkedin'
  | 'greenhouse'
  | 'lever'
  | 'ashby'
  | 'workday'
  | 'smartrecruiters'
  | 'generic';

export interface SiteMatch {
  site: SiteId;
  confidence: number; // 0..1
  url: string;
}

export interface JobDescription {
  title: string;
  company: string;
  location?: string;
  text: string; // normalized, trimmed for AI context
  url: string;
  extractedBy: 'adapter' | 'readability' | 'heuristic' | 'manual';
}

export type ControlType =
  | 'text'
  | 'email'
  | 'tel'
  | 'url'
  | 'number'
  | 'date'
  | 'textarea'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'file'
  | 'combobox';

export interface FieldDescriptor {
  id: string;
  selector: string;
  controlType: ControlType;
  label: string;
  labelSource: string; // which resolution rule matched — drives confidence
  required: boolean;
  options?: { value: string; label: string }[];
  group?: string;
  maxLength?: number;
  currentValue?: string;
  frameId?: number;
}

export interface FieldFill {
  fieldId: string;
  selector: string;
  value: string;
  confidence: number; // 0..1
  source: 'deterministic' | 'reuse' | 'ai';
  needsReview: boolean;
}

export interface FillFailure {
  fieldId: string;
  reason: string;
}

// ── Candidate profile (DESIGN.md §4) ────────────────────────────────────────
export interface CandidateProfile {
  version: 1;
  personal: {
    firstName: string;
    lastName: string;
    middleName?: string;
    preferredName?: string;
    email: string;
    phone: string;
    pronouns?: string;
    dateOfBirth?: string; // free text, e.g. "1995-04-12"
    languages?: string[];
    location: { line1?: string; city: string; state: string; country: string; postalCode?: string };
    links: { linkedin?: string; github?: string; portfolio?: string; twitter?: string; other?: string[] };
  };
  eligibility: {
    workAuthorized: boolean;
    requiresSponsorship: boolean;
    willingToRelocate: boolean;
    remoteOnly?: boolean;
    noticePeriodDays?: number;
    noticePeriod?: string; // free text, e.g. "30 days" / "immediate"
    desiredSalary?: string;
    currentSalary?: string; // current CTC / salary
    expectedSalary?: string; // expected CTC / salary
    availableStartDate?: string;
    yearsExperience?: string;
    citizenship?: string;
    workAuthCountry?: string; // defaults to location.country
  };
  // Optional self-identification. Left blank → deterministic mapping auto-selects
  // a "decline / prefer not to say" option (always needs-review). Never invented.
  demographics?: {
    gender?: string;
    raceEthnicity?: string;
    veteranStatus?: string;
    disabilityStatus?: string;
  };
  howHeard?: string; // "how did you hear about us"
  resume: { fileName: string; text: string; blobId?: string; updatedAt: number };
  workHistory: WorkItem[];
  education: EducationItem[];
  skills: string[];
  projects: ProjectItem[];
  certifications: CertItem[];
  summary?: string;
}

export interface WorkItem {
  company: string;
  title: string;
  startDate: string;
  endDate: string | 'present';
  location?: string;
  bullets: string[];
}

export interface EducationItem {
  school: string;
  degree: string;
  field: string;
  startDate?: string;
  endDate?: string;
  gpa?: string;
}

export interface ProjectItem {
  name: string;
  description: string;
  url?: string;
  tech?: string[];
}

export interface CertItem {
  name: string;
  issuer: string;
  date?: string;
}

export type ErrorCode =
  | 'AI_TIMEOUT'
  | 'NO_JD'
  | 'UNSUPPORTED_FORM'
  | 'DYNAMIC_PAGE'
  | 'RATE_LIMIT'
  | 'NETWORK'
  | 'BAD_AI_JSON'
  | 'INVALID_KEY'
  | 'LOCKED'
  | 'FILL_FAILED'
  | 'UNKNOWN';
