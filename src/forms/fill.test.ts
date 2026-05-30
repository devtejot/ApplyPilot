import { describe, it, expect } from 'vitest';
import type { FieldFill } from '@/shared/types';
import { setNativeValue, applyFill, applyFills } from './fill';

function root(html: string): HTMLElement {
  const doc = new DOMParser().parseFromString(`<form>${html}</form>`, 'text/html');
  return doc.querySelector('form')!;
}

function fill(p: Partial<FieldFill> & { selector: string; value: string }): FieldFill {
  return { fieldId: 'f', confidence: 1, source: 'deterministic', needsReview: false, ...p };
}

describe('setNativeValue', () => {
  it('sets the value and dispatches an input event (React-safe path)', () => {
    const r = root('<input name="x">');
    const input = r.querySelector('input')!;
    let heard = '';
    input.addEventListener('input', () => (heard = input.value));

    setNativeValue(input, 'hello');

    expect(input.value).toBe('hello');
    expect(heard).toBe('hello');
  });
});

describe('applyFill', () => {
  it('fills a text input and tags it for review state', () => {
    const r = root('<input id="e" name="e">');
    const res = applyFill(r, fill({ selector: '#e', value: 'dev@x.com', needsReview: true }));
    expect(res.ok).toBe(true);
    const input = r.querySelector('input')!;
    expect(input.value).toBe('dev@x.com');
    expect(input.getAttribute('data-applypilot')).toBe('review');
  });

  it('selects a valid <select> option', () => {
    const r = root('<select id="s"><option value=""></option><option value="yes">Yes</option></select>');
    const res = applyFill(r, fill({ selector: '#s', value: 'yes' }));
    expect(res.ok).toBe(true);
    expect((r.querySelector('select') as HTMLSelectElement).value).toBe('yes');
  });

  it('fails when a select option does not exist', () => {
    const r = root('<select id="s"><option value="a">A</option></select>');
    const res = applyFill(r, fill({ selector: '#s', value: 'zzz' }));
    expect(res.ok).toBe(false);
  });

  it('checks the matching radio in a group', () => {
    const r = root('<input type="radio" name="g" value="yes"><input type="radio" name="g" value="no">');
    const res = applyFill(r, fill({ selector: '[name="g"]', value: 'no' }));
    expect(res.ok).toBe(true);
    const no = r.querySelector('input[value="no"]') as HTMLInputElement;
    expect(no.checked).toBe(true);
  });

  it('treats a reformatting widget as success (phone, currency, etc.)', () => {
    const r = root('<input id="p" name="p">');
    const input = r.querySelector('input')!;
    // mimic an intl-tel-input style widget that rewrites the value on input
    input.addEventListener('input', () => (input.value = '+1 415-555-1234'));
    const res = applyFill(r, fill({ selector: '#p', value: '+14155551234' }));
    expect(res.ok).toBe(true);
    expect(input.value).toBe('+1 415-555-1234');
  });

  it('fails when the field rejects the value and stays empty', () => {
    const r = root('<input id="p" name="p">');
    const input = r.querySelector('input')!;
    input.addEventListener('input', () => (input.value = '')); // reject
    expect(applyFill(r, fill({ selector: '#p', value: 'x' })).ok).toBe(false);
  });

  it('fails when the selector matches nothing', () => {
    const res = applyFill(root('<input id="a">'), fill({ selector: '#missing', value: 'x' }));
    expect(res.ok).toBe(false);
  });

  it('refuses to fill file inputs', () => {
    const fileRes = applyFill(root('<input type="file" id="cv">'), fill({ selector: '#cv', value: 'x' }));
    expect(fileRes.ok).toBe(false);
  });

  it('fills an ARIA combobox by clicking the matching option', () => {
    const r = root(
      '<div id="c" role="combobox" aria-controls="lb"></div><ul id="lb" role="listbox"><li role="option">Yes</li><li role="option">No</li></ul>',
    );
    const yes = r.querySelector('li')!;
    let clicked = false;
    yes.addEventListener('click', () => (clicked = true));
    const res = applyFill(r, fill({ selector: '#c', value: 'Yes' }));
    expect(res.ok).toBe(true);
    expect(clicked).toBe(true);
  });

  it('fails a combobox when no option matches', () => {
    const r = root('<div id="c" role="combobox" aria-controls="lb"></div><ul id="lb" role="listbox"><li role="option">Maybe</li></ul>');
    expect(applyFill(r, fill({ selector: '#c', value: 'Yes' })).ok).toBe(false);
  });

  it('fails a combobox with no resolvable listbox (suggest-only)', () => {
    expect(applyFill(root('<div id="c" role="combobox"></div>'), fill({ selector: '#c', value: 'x' })).ok).toBe(false);
  });
});

describe('applyFills batch', () => {
  it('reports filled and failed separately', () => {
    const r = root('<input id="a" name="a"><input type="file" id="b">');
    const result = applyFills(r, [
      fill({ fieldId: 'a', selector: '#a', value: 'ok' }),
      fill({ fieldId: 'b', selector: '#b', value: 'no' }),
    ]);
    expect(result.filled).toEqual(['a']);
    expect(result.failed.map((f) => f.fieldId)).toEqual(['b']);
  });
});
