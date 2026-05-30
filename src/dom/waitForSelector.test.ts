import { describe, it, expect } from 'vitest';
import { waitForSelector } from './waitForSelector';

function emptyDoc(): Document {
  return new DOMParser().parseFromString('<body></body>', 'text/html');
}

describe('waitForSelector', () => {
  it('resolves immediately when the element is already present', async () => {
    const doc = new DOMParser().parseFromString('<body><form id="app"></form></body>', 'text/html');
    const el = await waitForSelector(doc, '#app', 1000);
    expect(el).not.toBeNull();
  });

  it('resolves once the element is added later (SPA hydration)', async () => {
    const doc = emptyDoc();
    setTimeout(() => {
      const f = doc.createElement('form');
      f.id = 'app';
      doc.body.appendChild(f);
    }, 20);
    const el = await waitForSelector(doc, '#app', 1000);
    expect(el).not.toBeNull();
  });

  it('resolves null on timeout when the element never appears', async () => {
    const el = await waitForSelector(emptyDoc(), '#never', 40);
    expect(el).toBeNull();
  });
});
