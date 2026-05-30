import { describe, it, expect } from 'vitest';
import { scanForm } from './scanForm';

function form(html: string): HTMLFormElement {
  const doc = new DOMParser().parseFromString(`<form>${html}</form>`, 'text/html');
  return doc.querySelector('form')!;
}

describe('scanForm control discovery', () => {
  it('describes a labelled text input', () => {
    const fields = scanForm(form('<label for="fn">First name</label><input id="fn" name="fn">'));
    expect(fields).toHaveLength(1);
    expect(fields[0]).toMatchObject({
      controlType: 'text',
      label: 'First name',
      labelSource: 'label-for',
      selector: '#fn',
      required: false,
    });
  });

  it('classifies email, tel, url, number, date, textarea, file', () => {
    const fields = scanForm(
      form(`
        <input type="email" name="e">
        <input type="tel" name="t">
        <input type="url" name="u">
        <input type="number" name="n">
        <input type="date" name="d">
        <textarea name="ta"></textarea>
        <input type="file" name="cv">
      `),
    );
    expect(fields.map((f) => f.controlType)).toEqual([
      'email',
      'tel',
      'url',
      'number',
      'date',
      'textarea',
      'file',
    ]);
  });

  it('skips submit, button, hidden, password, and disabled controls', () => {
    const fields = scanForm(
      form(`
        <input type="text" name="keep">
        <input type="submit" value="Apply">
        <button type="button">x</button>
        <input type="hidden" name="csrf">
        <input type="password" name="pw">
        <input type="text" name="off" disabled>
      `),
    );
    expect(fields.map((f) => f.selector)).toEqual(['[name="keep"]']);
  });

  it('detects required via attribute', () => {
    const fields = scanForm(form('<input name="e" type="email" required>'));
    expect(fields[0].required).toBe(true);
  });

  it('captures select options', () => {
    const fields = scanForm(
      form(`
        <label for="auth">Work authorized?</label>
        <select id="auth" name="auth">
          <option value="">Select...</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      `),
    );
    expect(fields[0].controlType).toBe('select');
    expect(fields[0].options).toEqual([
      { value: '', label: 'Select...' },
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
    ]);
  });

  it('collapses a radio group into one descriptor with options', () => {
    const fields = scanForm(
      form(`
        <fieldset>
          <legend>Sponsorship needed?</legend>
          <label><input type="radio" name="spon" value="yes">Yes</label>
          <label><input type="radio" name="spon" value="no">No</label>
        </fieldset>
      `),
    );
    expect(fields).toHaveLength(1);
    expect(fields[0]).toMatchObject({ controlType: 'radio', group: 'spon', label: 'Sponsorship needed?' });
    expect(fields[0].options).toEqual([
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
    ]);
  });

  it('skips reCAPTCHA / captcha fields by name', () => {
    const fields = scanForm(
      form('<textarea name="g-recaptcha-response"></textarea><input name="keep">'),
    );
    expect(fields.map((f) => f.selector)).toEqual(['[name="keep"]']);
  });

  it('skips CSS-hidden and aria-hidden fields', () => {
    const fields = scanForm(
      form('<input name="hp" style="display:none"><input name="x" aria-hidden="true"><input name="keep">'),
    );
    expect(fields.map((f) => f.selector)).toEqual(['[name="keep"]']);
  });

  it('classifies an ARIA combobox', () => {
    const fields = scanForm(
      form('<label for="loc">Location</label><div id="loc" role="combobox"></div>'),
    );
    expect(fields[0].controlType).toBe('combobox');
  });
});
