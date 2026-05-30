// Shared adapter helpers.

export function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

// First path segment of an ATS URL → title-cased company (jobs.lever.co/<co>/…,
// jobs.ashbyhq.com/<co>/…). "acme-corp" → "Acme Corp".
export function companyFromUrl(url: string): string {
  try {
    const seg = new URL(url).pathname.split('/').filter(Boolean)[0] ?? '';
    return seg
      .split(/[-_]/)
      .filter(Boolean)
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(' ');
  } catch {
    return '';
  }
}
