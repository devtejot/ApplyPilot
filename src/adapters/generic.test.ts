import { describe, it, expect } from 'vitest';
import { genericAdapter } from './generic';

function doc(html: string): Document {
  return new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
}

const JD = 'We are hiring a backend engineer to build distributed systems in Go and Kubernetes. '
  + 'You will own services end to end, mentor peers, and improve reliability across the platform.';

const PAGE = `
  <header><nav><a href="/a">Home</a><a href="/b">Jobs</a><a href="/c">About</a></nav></header>
  <h1>Senior Backend Engineer</h1>
  <main><div class="content"><p>${JD}</p><ul><li>5+ years Go</li><li>Kubernetes</li></ul></div></main>
  <form>
    <label>First name<input name="fn"></label>
    <label>Email<input name="email" type="email"></label>
    <label>Resume<input name="cv" type="file"></label>
  </form>
  <footer><a href="/privacy">Privacy</a></footer>
`;

describe('generic adapter', () => {
  it('never matches by URL (fallback only)', () => {
    expect(genericAdapter.matchUrl('https://careers.acme.com/jobs/1')).toBe(0);
  });

  it('matchDom detects an application form, ignores plain pages', () => {
    expect(genericAdapter.matchDom(doc(PAGE))).toBeGreaterThan(0);
    expect(genericAdapter.matchDom(doc('<p>just an article</p>'))).toBe(0);
  });

  it('extracts the main job text and a title, skipping nav/footer', () => {
    const jd = genericAdapter.extractJD(doc(PAGE), 'https://careers.acme.com/jobs/1');
    expect(jd?.title).toBe('Senior Backend Engineer');
    expect(jd?.company).toBe('Acme');
    expect(jd?.text).toContain('distributed systems');
    expect(jd?.text).not.toContain('Privacy');
    expect(jd?.extractedBy).toBe('heuristic');
  });

  it('scans the detected application form', () => {
    const fields = genericAdapter.scanForm(doc(PAGE));
    expect(fields.map((f) => f.controlType)).toEqual(['text', 'email', 'file']);
  });
});
