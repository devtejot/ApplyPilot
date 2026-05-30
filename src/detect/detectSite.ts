import type { SiteAdapter } from '@/adapters/types';
import type { SiteMatch } from '@/shared/types';

const URL_WEIGHT = 0.6;
const DOM_WEIGHT = 0.4;
export const DETECT_THRESHOLD = 0.6;

// Weighted confidence: URL is the strong signal, DOM confirms (DESIGN.md §2).
// Best adapter above threshold wins; otherwise fall back to generic.
export function detectSite(url: string, doc: Document, adapters: SiteAdapter[]): SiteMatch {
  let best: { site: SiteMatch['site']; score: number } = { site: 'generic', score: 0 };

  for (const adapter of adapters) {
    const score = URL_WEIGHT * adapter.matchUrl(url) + DOM_WEIGHT * adapter.matchDom(doc);
    if (score > best.score) best = { site: adapter.id, score };
  }

  if (best.score >= DETECT_THRESHOLD) {
    return { site: best.site, confidence: best.score, url };
  }
  return { site: 'generic', confidence: best.score, url };
}
