import { describe, it, expect } from 'vitest';
import { greenhouseAdapter } from './greenhouse';

const PAGE = `
  <h1 class="app-title">Senior Backend Engineer</h1>
  <span class="company-name">at Acme</span>
  <div class="location">Remote — US</div>
  <div id="content">
    <p>We need a Go engineer with distributed systems experience.</p>
    <ul><li>5+ years Go</li><li>Kubernetes</li></ul>
  </div>
  <form id="application_form">
    <label for="first_name">First Name *</label>
    <input id="first_name" name="job_application[first_name]" required>
    <label for="email">Email *</label>
    <input id="email" type="email" name="job_application[email]" required>
    <label for="resume">Resume *</label>
    <input id="resume" type="file" name="job_application[resume]" required>
  </form>
`;

function doc(html: string): Document {
  return new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
}

describe('greenhouse extractJD', () => {
  it('pulls title, company, location, and description text', () => {
    const jd = greenhouseAdapter.extractJD(doc(PAGE), 'https://boards.greenhouse.io/acme/jobs/1');
    expect(jd).not.toBeNull();
    expect(jd!.title).toBe('Senior Backend Engineer');
    expect(jd!.company).toBe('Acme'); // "at " prefix stripped
    expect(jd!.location).toBe('Remote — US');
    expect(jd!.text).toContain('distributed systems');
    expect(jd!.text).toContain('5+ years Go');
    expect(jd!.extractedBy).toBe('adapter');
    expect(jd!.url).toBe('https://boards.greenhouse.io/acme/jobs/1');
  });

  it('returns null when there is no description block', () => {
    expect(greenhouseAdapter.extractJD(doc('<h1 class="app-title">x</h1>'), 'https://x')).toBeNull();
  });
});

describe('greenhouse scanForm', () => {
  it('scans the application form fields', () => {
    const fields = greenhouseAdapter.scanForm(doc(PAGE));
    expect(fields.map((f) => f.id)).toEqual(['first_name', 'email', 'resume']);
    expect(fields[0]).toMatchObject({ label: 'First Name', required: true, controlType: 'text' });
    expect(fields[2].controlType).toBe('file');
  });
});
