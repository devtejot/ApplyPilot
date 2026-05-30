import type { SiteAdapter } from './types';
import { scanForm } from '@/forms/scanForm';

// Greenhouse application-page DOM signatures (DESIGN.md §2).
const DOM_SIGNATURES = ['#application_form', '#application', 'input[id^="job_application"]'];

const TITLE_SEL = '.app-title, h1.app-title, h1';
const COMPANY_SEL = '.company-name';
const LOCATION_SEL = '.location';
const CONTENT_SEL = '#content, .job__description, #job_description';
const FORM_SEL = '#application_form, #application';
const JD_MAX_CHARS = 6000;

function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export const greenhouseAdapter: SiteAdapter = {
  id: 'greenhouse',
  readySelector: `${FORM_SEL}, ${CONTENT_SEL}`,

  matchUrl(url) {
    try {
      const host = new URL(url).hostname;
      return host === 'greenhouse.io' || host.endsWith('.greenhouse.io') ? 1 : 0;
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
    if (!text) return null; // no description — let the caller fall back to the ladder

    const company = collapse(doc.querySelector(COMPANY_SEL)?.textContent ?? '').replace(/^at\s+/i, '');
    const location = collapse(doc.querySelector(LOCATION_SEL)?.textContent ?? '');

    return {
      title: collapse(doc.querySelector(TITLE_SEL)?.textContent ?? ''),
      company,
      ...(location ? { location } : {}),
      text,
      url,
      extractedBy: 'adapter',
    };
  },

  scanForm(doc) {
    const root = doc.querySelector(FORM_SEL) ?? doc;
    return scanForm(root);
  },
};
