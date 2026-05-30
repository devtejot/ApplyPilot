import type { SiteAdapter } from './types';
import { scanForm } from '@/forms/scanForm';
import { collapse, companyFromUrl } from './util';

// Lever DOM signatures (jobs.lever.co). Server-rendered, stable markup.
const DOM_SIGNATURES = ['.application-form', '.posting-headline', '[data-qa="posting-form"]'];
const TITLE_SEL = '.posting-headline h2, .posting-headline h1';
const LOCATION_SEL = '.posting-categories .location, .posting-category.location';
const CONTENT_SEL = '[data-qa="job-description"], .section-wrapper';
const FORM_SEL = '.application-form, form[data-qa="posting-form"]';
const JD_MAX_CHARS = 6000;

export const leverAdapter: SiteAdapter = {
  id: 'lever',
  readySelector: `${FORM_SEL}, .posting-headline`,

  matchUrl(url) {
    try {
      const host = new URL(url).hostname;
      return host === 'lever.co' || host.endsWith('.lever.co') ? 1 : 0;
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
    const location = collapse(doc.querySelector(LOCATION_SEL)?.textContent ?? '');
    return {
      title: collapse(doc.querySelector(TITLE_SEL)?.textContent ?? ''),
      company: companyFromUrl(url),
      ...(location ? { location } : {}),
      text,
      url,
      extractedBy: 'adapter',
    };
  },

  scanForm(doc) {
    return scanForm(doc.querySelector(FORM_SEL) ?? doc);
  },
};
