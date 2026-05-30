// Generic fallback adapter (DESIGN.md §2 §3). For career pages with no specific
// ATS adapter: detect an application-like form, extract the JD by a readability-
// style heuristic, and reuse the generic form scanner. URL never matches — this
// is only reached when no real adapter clears the detection threshold.
import type { SiteAdapter } from './types';
import { scanForm } from '@/forms/scanForm';
import { collapse } from './util';

const APP_KEYWORDS = /first name|last name|full name|email|resume|cv|cover letter|phone|linkedin/i;
const MIN_BLOCK_LEN = 120;
const JD_MAX_CHARS = 6000;

function findApplicationForm(doc: Document): Element | null {
  let best: Element | null = null;
  let bestScore = 0;
  for (const form of doc.querySelectorAll('form')) {
    const hasFile = form.querySelector('input[type="file"]') ? 2 : 0;
    const hasKeywords = APP_KEYWORDS.test(form.textContent ?? '') ? 1 : 0;
    const fields = Math.min(form.querySelectorAll('input, textarea, select').length, 5) * 0.2;
    const score = hasFile + hasKeywords + fields;
    if (score > bestScore) {
      bestScore = score;
      best = form;
    }
  }
  return bestScore >= 1 ? best : null;
}

// Pick the densest text block (high text-to-markup ratio) outside nav/header/footer.
function largestTextBlock(doc: Document): string {
  const main = doc.querySelector('main, article, [role="main"]');
  if (main && (main.textContent ?? '').trim().length >= MIN_BLOCK_LEN) return collapse(main.textContent ?? '');

  let best = '';
  let bestScore = 0;
  for (const el of doc.querySelectorAll('section, div')) {
    if (el.closest('nav, header, footer')) continue;
    const text = (el.textContent ?? '').trim();
    if (text.length < MIN_BLOCK_LEN) continue;
    const ratio = text.length / (el.innerHTML.length || 1);
    const score = text.length * ratio;
    if (score > bestScore) {
      bestScore = score;
      best = text;
    }
  }
  return collapse(best);
}

// careers.acme.com → "Acme" (second-level domain, title-cased).
function companyFromHost(url: string): string {
  try {
    const parts = new URL(url).hostname.split('.').filter(Boolean);
    const seg = parts.length >= 2 ? parts[parts.length - 2] : parts[0] ?? '';
    return seg ? seg[0].toUpperCase() + seg.slice(1) : '';
  } catch {
    return '';
  }
}

export const genericAdapter: SiteAdapter = {
  id: 'generic',
  readySelector: 'form, main, article',

  matchUrl() {
    return 0;
  },

  matchDom(doc) {
    return findApplicationForm(doc) ? 0.5 : 0;
  },

  extractJD(doc, url) {
    const text = largestTextBlock(doc).slice(0, JD_MAX_CHARS);
    if (!text) return null;
    return {
      title: collapse(doc.querySelector('h1')?.textContent ?? '') || collapse(doc.title),
      company: companyFromHost(url),
      text,
      url,
      extractedBy: 'heuristic',
    };
  },

  scanForm(doc) {
    return scanForm(findApplicationForm(doc) ?? doc);
  },
};
