import type { SiteAdapter } from './types';
import { scanForm } from '@/forms/scanForm';
import { collapse, companyFromUrl } from './util';

// Ashby (jobs.ashbyhq.com). React SPA — classes are hashed, but the form fields
// carry stable `_systemfield_*` ids and the shell uses ashby-* classes. JD lives
// in a description container; selectors are best-effort with a <main> fallback.
const DOM_SIGNATURES = ['[class*="ashby"]', '[id^="_systemfield"]'];
const TITLE_SEL = 'h1';
const CONTENT_SEL = '[class*="description"], [class*="Description"], main, article';
const FORM_SEL = 'form';
const JD_MAX_CHARS = 6000;

export const ashbyAdapter: SiteAdapter = {
  id: 'ashby',
  readySelector: '[id^="_systemfield"], form',

  matchUrl(url) {
    try {
      const host = new URL(url).hostname;
      return host === 'ashbyhq.com' || host.endsWith('.ashbyhq.com') ? 1 : 0;
    } catch {
      return 0;
    }
  },

  matchDom(doc) {
    return DOM_SIGNATURES.some((sel) => doc.querySelector(sel)) ? 1 : 0;
  },

  extractJD(doc, url) {
    const content = doc.querySelector(CONTENT_SEL);
    const text = collapse(content?.textContent ?? '').slice(0, JD_MAX_CHARS);
    if (!text) return null;
    return {
      title: collapse(doc.querySelector(TITLE_SEL)?.textContent ?? ''),
      company: companyFromUrl(url),
      text,
      url,
      extractedBy: 'adapter',
    };
  },

  scanForm(doc) {
    return scanForm(doc.querySelector(FORM_SEL) ?? doc);
  },
};
