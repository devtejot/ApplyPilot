// Form scan engine (DESIGN.md §6). Discovers fillable controls, resolves labels,
// groups radios/checkboxes, and emits FieldDescriptor[]. Pure DOM read — no writes.
import type { ControlType, FieldDescriptor } from '@/shared/types';
import { resolveLabel } from './labels';

const CANDIDATE_SELECTOR =
  'input, textarea, select, [contenteditable], [role="combobox"], [role="listbox"]';

const SKIP_TYPES = new Set(['submit', 'button', 'reset', 'image', 'hidden', 'password']);
const TEXTLIKE = new Set(['text', 'email', 'tel', 'url', 'number', 'date']);

const UTILITY_FIELD = /recaptcha|captcha|hcaptcha|turnstile|honeypot/i;

function shouldSkip(el: Element): boolean {
  if ((el as HTMLInputElement).disabled || el.hasAttribute('disabled')) return true;
  if (el.hasAttribute('hidden') || el.getAttribute('aria-hidden') === 'true') return true;
  if (el.getAttribute('contenteditable') === 'false') return true;

  // Bot-protection / honeypot fields: never surface or fill them.
  if (UTILITY_FIELD.test(`${el.getAttribute('name') ?? ''} ${el.getAttribute('id') ?? ''}`)) return true;

  // Visually hidden (reCAPTCHA's textarea hides via inline style, not the hidden attr).
  const style = (el.getAttribute('style') ?? '').replace(/\s/g, '').toLowerCase();
  if (style.includes('display:none') || style.includes('visibility:hidden')) return true;

  if (el.tagName.toLowerCase() === 'input') {
    const t = (el.getAttribute('type') || 'text').toLowerCase();
    if (SKIP_TYPES.has(t)) return true;
  }
  return false;
}

function controlTypeOf(el: Element): ControlType {
  const tag = el.tagName.toLowerCase();
  if (tag === 'textarea') return 'textarea';
  if (tag === 'select') return 'select';
  const role = el.getAttribute('role');
  if (role === 'combobox' || role === 'listbox') return 'combobox';
  if (el.hasAttribute('contenteditable')) return 'textarea';
  if (tag === 'input') {
    const t = (el.getAttribute('type') || 'text').toLowerCase();
    if (t === 'file' || t === 'radio' || t === 'checkbox') return t;
    return TEXTLIKE.has(t) ? (t as ControlType) : 'text';
  }
  return 'text';
}

function selectorFor(el: Element): string {
  const id = el.getAttribute('id');
  if (id) return `#${id}`;
  const name = el.getAttribute('name');
  if (name) return `[name="${name}"]`;
  return el.tagName.toLowerCase();
}

function isRequired(el: Element): boolean {
  return (el as HTMLInputElement).required || el.getAttribute('aria-required') === 'true';
}

function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function selectOptions(el: HTMLSelectElement): { value: string; label: string }[] {
  return [...el.options].map((o) => ({ value: o.value, label: collapse(o.textContent ?? '') }));
}

function groupDescriptor(
  first: Element,
  name: string,
  controlType: ControlType,
  root: ParentNode,
  id: string,
): FieldDescriptor {
  const members = [...root.querySelectorAll('input')].filter(
    (i) => i.getAttribute('name') === name && !shouldSkip(i),
  );
  const options = members.map((m) => ({
    value: m.getAttribute('value') ?? '',
    label: resolveLabel(m).label || (m.getAttribute('value') ?? ''),
  }));

  const legend = first.closest('fieldset')?.querySelector('legend');
  const { label, source } = legend?.textContent?.trim()
    ? { label: collapse(legend.textContent), source: 'legend' }
    : resolveLabel(first);

  return {
    id,
    selector: `[name="${name}"]`,
    controlType,
    label,
    labelSource: source,
    required: members.some(isRequired),
    options,
    group: name,
  };
}

export function scanForm(root: ParentNode): FieldDescriptor[] {
  const els = [...root.querySelectorAll(CANDIDATE_SELECTOR)];
  const seenGroups = new Set<string>();
  const out: FieldDescriptor[] = [];
  let idx = 0;

  for (const el of els) {
    if (shouldSkip(el)) continue;
    const controlType = controlTypeOf(el);

    if (controlType === 'radio' || controlType === 'checkbox') {
      const name = el.getAttribute('name');
      if (name) {
        if (seenGroups.has(name)) continue;
        seenGroups.add(name);
        out.push(groupDescriptor(el, name, controlType, root, `group:${name}`));
        continue;
      }
    }

    const { label, source } = resolveLabel(el);
    const descriptor: FieldDescriptor = {
      id: el.getAttribute('id') || `f${idx}`,
      selector: selectorFor(el),
      controlType,
      label,
      labelSource: source,
      required: isRequired(el),
    };

    if (controlType === 'select') descriptor.options = selectOptions(el as HTMLSelectElement);

    const maxLength = el.getAttribute('maxlength');
    if (maxLength) descriptor.maxLength = Number(maxLength);

    const current = (el as HTMLInputElement).value;
    if (current) descriptor.currentValue = current;

    out.push(descriptor);
    idx++;
  }

  return out;
}
