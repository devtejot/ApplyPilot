import { describe, it, expect } from 'vitest';
import { greenhouseAdapter } from '@/adapters/greenhouse';
import { detectSite } from './detectSite';

const ADAPTERS = [greenhouseAdapter];

function docWith(html: string): Document {
  return new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
}

describe('greenhouse URL matching', () => {
  it('matches a boards.greenhouse.io job URL', () => {
    expect(greenhouseAdapter.matchUrl('https://boards.greenhouse.io/acme/jobs/123')).toBe(1);
  });

  it('matches job-boards.greenhouse.io', () => {
    expect(greenhouseAdapter.matchUrl('https://job-boards.greenhouse.io/acme/jobs/9')).toBe(1);
  });

  it('does not match an unrelated host', () => {
    expect(greenhouseAdapter.matchUrl('https://jobs.lever.co/acme/abc')).toBe(0);
  });
});

describe('greenhouse DOM matching', () => {
  it('matches a page with the application form root', () => {
    const doc = docWith('<form id="application_form"></form>');
    expect(greenhouseAdapter.matchDom(doc)).toBe(1);
  });

  it('does not match an empty page', () => {
    expect(greenhouseAdapter.matchDom(docWith('<div>hello</div>'))).toBe(0);
  });
});

describe('detectSite scoring', () => {
  it('detects greenhouse from URL + DOM with high confidence', () => {
    const doc = docWith('<form id="application_form"></form>');
    const m = detectSite('https://boards.greenhouse.io/acme/jobs/1', doc, ADAPTERS);
    expect(m.site).toBe('greenhouse');
    expect(m.confidence).toBeCloseTo(1);
  });

  it('detects greenhouse from URL alone (SPA pre-hydration, no DOM yet)', () => {
    const doc = docWith('<div></div>');
    const m = detectSite('https://boards.greenhouse.io/acme/jobs/1', doc, ADAPTERS);
    expect(m.site).toBe('greenhouse');
    expect(m.confidence).toBeCloseTo(0.6); // 0.6*url + 0.4*0
  });

  it('falls back to generic on an unknown site', () => {
    const m = detectSite('https://example.com/careers', docWith('<div></div>'), ADAPTERS);
    expect(m.site).toBe('generic');
    expect(m.confidence).toBeLessThan(0.6);
  });
});
