import { describe, it, expect } from 'vitest';
import { leverAdapter } from './lever';

const PAGE = `
  <div class="posting-headline"><h2>Senior Frontend Engineer</h2></div>
  <div class="posting-categories"><span class="location">Remote — US</span></div>
  <div class="section-wrapper">
    <div class="section page-centered" data-qa="job-description"><p>Build React apps. TypeScript required.</p></div>
  </div>
  <form class="application-form">
    <label>Full name<input name="name"></label>
    <label>Email<input name="email" type="email"></label>
    <label>Resume<input name="resume" type="file"></label>
  </form>
`;

function doc(html: string): Document {
  return new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
}

describe('lever adapter', () => {
  it('matches jobs.lever.co URLs only', () => {
    expect(leverAdapter.matchUrl('https://jobs.lever.co/acme/abc-123')).toBe(1);
    expect(leverAdapter.matchUrl('https://boards.greenhouse.io/acme/jobs/1')).toBe(0);
  });

  it('matches the Lever application DOM', () => {
    expect(leverAdapter.matchDom(doc(PAGE))).toBe(1);
    expect(leverAdapter.matchDom(doc('<div>x</div>'))).toBe(0);
  });

  it('extracts title, company (from URL), location, and description', () => {
    const jd = leverAdapter.extractJD(doc(PAGE), 'https://jobs.lever.co/acme/abc-123');
    expect(jd?.title).toBe('Senior Frontend Engineer');
    expect(jd?.company).toBe('Acme');
    expect(jd?.location).toBe('Remote — US');
    expect(jd?.text).toContain('TypeScript');
    expect(jd?.extractedBy).toBe('adapter');
  });

  it('scans the application form fields', () => {
    const fields = leverAdapter.scanForm(doc(PAGE));
    expect(fields.map((f) => f.controlType)).toEqual(['text', 'email', 'file']);
    expect(fields[0].label).toBe('Full name');
  });
});
