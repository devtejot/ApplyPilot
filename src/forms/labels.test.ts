import { describe, it, expect } from 'vitest';
import { resolveLabel } from './labels';

function fieldFrom(html: string, selector = 'input,textarea,select'): Element {
  const doc = new DOMParser().parseFromString(`<form>${html}</form>`, 'text/html');
  const el = doc.querySelector(selector);
  if (!el) throw new Error('no field in fixture');
  return el;
}

describe('resolveLabel priority ladder', () => {
  it('uses <label for> when present', () => {
    const el = fieldFrom('<label for="fn">First name</label><input id="fn" name="x">');
    expect(resolveLabel(el)).toEqual({ label: 'First name', source: 'label-for' });
  });

  it('uses a wrapping <label>', () => {
    const el = fieldFrom('<label>Email address<input name="x"></label>');
    expect(resolveLabel(el)).toEqual({ label: 'Email address', source: 'label-wrap' });
  });

  it('uses aria-labelledby referenced text', () => {
    const el = fieldFrom('<span id="lab">Phone</span><input aria-labelledby="lab" name="x">');
    expect(resolveLabel(el)).toEqual({ label: 'Phone', source: 'aria-labelledby' });
  });

  it('uses aria-label', () => {
    const el = fieldFrom('<input aria-label="LinkedIn URL" name="x">');
    expect(resolveLabel(el)).toEqual({ label: 'LinkedIn URL', source: 'aria-label' });
  });

  it('uses placeholder when nothing better', () => {
    const el = fieldFrom('<input placeholder="Your website" name="x">');
    expect(resolveLabel(el)).toEqual({ label: 'Your website', source: 'placeholder' });
  });

  it('tokenizes the name attribute as a last resort', () => {
    const el = fieldFrom('<input name="job_application[first_name]">');
    expect(resolveLabel(el)).toEqual({ label: 'first name', source: 'name-token' });
  });

  it('tokenizes camelCase ids', () => {
    const el = fieldFrom('<input id="linkedInProfile">');
    expect(resolveLabel(el)).toEqual({ label: 'linked in profile', source: 'name-token' });
  });

  it('label[for] wins over aria-label and placeholder', () => {
    const el = fieldFrom(
      '<label for="e">Email</label><input id="e" aria-label="ignore me" placeholder="nope">',
    );
    expect(resolveLabel(el)).toEqual({ label: 'Email', source: 'label-for' });
  });

  it('collapses whitespace and strips a trailing required asterisk', () => {
    const el = fieldFrom('<label for="e">  Email   address *</label><input id="e">');
    expect(resolveLabel(el)).toEqual({ label: 'Email address', source: 'label-for' });
  });
});
