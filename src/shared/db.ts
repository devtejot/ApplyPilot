// IndexedDB via Dexie — application history + answer bank (DESIGN.md §8,§9).
// Profile, settings, API key live in chrome.storage.local instead (see §10).
import Dexie, { type Table } from 'dexie';
import type { SiteId } from './types';

export interface ApplicationRecord {
  id: string;
  company: string;
  role: string;
  jobUrl: string;
  site: SiteId;
  jobDescriptionHash: string; // sha256 of normalized JD — dedupe key
  jobDescription: string;
  matchScore: number;
  generatedAnswers: { question: string; answer: string }[];
  coverLetter?: string;
  status: 'drafted' | 'filled' | 'submitted_by_user';
  appliedAt: number;
  updatedAt: number;
}

export interface AnswerRecord {
  id: string;
  normalizedQuestion: string;
  intentTag: string;
  question: string;
  answer: string;
  company?: string; // for company-name leak guard on reuse
  updatedAt: number;
}

class ApplyPilotDB extends Dexie {
  applications!: Table<ApplicationRecord, string>;
  answerBank!: Table<AnswerRecord, string>;

  constructor() {
    super('applypilot');
    this.version(1).stores({
      applications: 'id, company, jobUrl, jobDescriptionHash, appliedAt, status',
      answerBank: 'id, normalizedQuestion, intentTag, updatedAt',
    });
  }
}

export const db = new ApplyPilotDB();
