import { describe, it, expect } from 'vitest';
import { ashbyAdapter } from './ashby';

const PAGE = `
  <h1>Staff Systems Engineer</h1>
  <div class="ashby-job-posting-right-pane">
    <div class="_description_a1b2c3"><p>Rust and distributed systems. 8+ years.</p></div>
  </div>
  <form class="ashby-application-form">
    <label for="_systemfield_name">Name</label>
    <input id="_systemfield_name" name="_systemfield_name">
    <label for="_systemfield_email">Email</label>
    <input id="_systemfield_email" name="_systemfield_email" type="email">
  </form>
`;

function doc(html: string): Document {
  return new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
}

describe('ashby adapter', () => {
  it('matches ashbyhq.com URLs only', () => {
    expect(ashbyAdapter.matchUrl('https://jobs.ashbyhq.com/acme/abc-uuid')).toBe(1);
    expect(ashbyAdapter.matchUrl('https://jobs.lever.co/acme/1')).toBe(0);
  });

  it('matches the Ashby DOM', () => {
    expect(ashbyAdapter.matchDom(doc(PAGE))).toBe(1);
    expect(ashbyAdapter.matchDom(doc('<div>x</div>'))).toBe(0);
  });

  it('extracts title, company (from URL), and description', () => {
    const jd = ashbyAdapter.extractJD(doc(PAGE), 'https://jobs.ashbyhq.com/acme/abc-uuid');
    expect(jd?.title).toBe('Staff Systems Engineer');
    expect(jd?.company).toBe('Acme');
    expect(jd?.text).toContain('Rust');
    expect(jd?.extractedBy).toBe('adapter');
  });

  it('scans the application form fields by label', () => {
    const fields = ashbyAdapter.scanForm(doc(PAGE));
    expect(fields.map((f) => f.label)).toEqual(['Name', 'Email']);
  });
});
