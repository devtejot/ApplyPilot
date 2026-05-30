import type { FieldDescriptor, JobDescription, SiteId } from '@/shared/types';

// One adapter per ATS. New site = new file implementing this (DESIGN.md §2).
export interface SiteAdapter {
  id: SiteId;
  /** Selector that signals the JD/form has rendered (for SPA render-wait). */
  readySelector: string;
  /** 0..1 — confidence the URL belongs to this site. */
  matchUrl(url: string): number;
  /** 0..1 — confidence the DOM is this site's application page. */
  matchDom(doc: Document): number;
  /** Pull the job description, or null if not extractable from this doc. */
  extractJD(doc: Document, url: string): JobDescription | null;
  /** Scan the application form into descriptors. */
  scanForm(doc: Document): FieldDescriptor[];
}
