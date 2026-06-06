// Fill engine (DESIGN.md §7). Writes values into controls safely, marks each
// filled field for review, and NEVER touches submit buttons. Refuses file inputs
// and ARIA comboboxes (suggest-only).
import type { FieldFill, FillFailure } from '@/shared/types';

export type FillResult = { ok: true } | { ok: false; reason: string };

// Outline colors for filled fields, injected inline into the host page. Kept as
// literal hex — the content script runs in the page's world and can't read the
// extension's CSS variables — and aligned with the --success / --warning tokens.
// High-contrast on unknown page backgrounds; intentionally not theme-following.
const OUTLINE_AUTO = '#16a34a'; // matches token --success (high-confidence)
const OUTLINE_REVIEW = '#ca8a04'; // matches token --warning (needs review)

/**
 * Set a value the React-safe way: call the native value setter on the prototype
 * (controlled inputs ignore a plain `el.value =`), then dispatch input + change.
 */
export function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function mark(el: Element, f: FieldFill): void {
  el.setAttribute('data-applypilot', f.needsReview ? 'review' : 'auto');
  (el as HTMLElement).style?.setProperty('outline', `2px solid ${f.needsReview ? OUTLINE_REVIEW : OUTLINE_AUTO}`);
}

function unmark(el: Element): void {
  el.removeAttribute('data-applypilot');
  (el as HTMLElement).style?.removeProperty('outline');
}

export function applyFill(root: ParentNode, f: FieldFill): FillResult {
  const el = root.querySelector(f.selector);
  if (!el) return { ok: false, reason: 'element not found' };

  const tag = el.tagName.toLowerCase();
  const type = (el.getAttribute('type') || '').toLowerCase();
  const role = el.getAttribute('role');

  if (type === 'file') return { ok: false, reason: 'file inputs cannot be set programmatically' };
  if (role === 'combobox' || role === 'listbox') return fillCombobox(el, f);

  if (tag === 'select') {
    const sel = el as HTMLSelectElement;
    if (![...sel.options].some((o) => o.value === f.value)) {
      return { ok: false, reason: 'option not found' };
    }
    sel.value = f.value;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    mark(sel, f);
    return { ok: true };
  }

  if (type === 'radio' || type === 'checkbox') {
    const members = [...root.querySelectorAll(f.selector)] as HTMLInputElement[];
    const target = members.find((m) => (m.getAttribute('value') ?? '') === f.value);
    if (!target) return { ok: false, reason: 'option not found' };
    target.click();
    mark(target, f);
    return { ok: true };
  }

  if (tag === 'input' || tag === 'textarea') {
    const input = el as HTMLInputElement;
    const prev = input.value;
    setNativeValue(input, f.value);
    const after = input.value;
    // Accept an exact match OR a non-empty change — widgets (phone, currency)
    // legitimately reformat the value on input. Only a value that stayed put
    // (rejected) counts as a failure.
    const stuck = after === f.value || (after.trim() !== '' && after !== prev);
    if (!stuck) return { ok: false, reason: 'value did not stick' };
    mark(input, f);
    return { ok: true };
  }

  return { ok: false, reason: `unsupported control: ${tag}` };
}

// Best-effort ARIA combobox fill: open it, resolve its listbox, click the option
// whose text matches. Frameworks vary wildly — if the listbox doesn't resolve
// synchronously, we report failure so the value shows for manual review instead.
function fillCombobox(el: Element, f: FieldFill): FillResult {
  const norm = (s: string) => s.trim().toLowerCase();
  (el as HTMLElement).click?.();

  const doc = el.ownerDocument;
  const ownsId = el.getAttribute('aria-controls') || el.getAttribute('aria-owns');
  const listbox = (ownsId && doc.getElementById(ownsId)) || doc.querySelector('[role="listbox"]');
  if (!listbox) return { ok: false, reason: 'combobox listbox not found' };

  const want = norm(f.value);
  const option = [...listbox.querySelectorAll('[role="option"], li, option')].find(
    (o) => norm(o.textContent ?? '').includes(want) || norm(o.getAttribute('data-value') ?? '') === want,
  );
  if (!option) return { ok: false, reason: 'option not found in combobox' };

  (option as HTMLElement).click?.();
  mark(el, f);
  return { ok: true };
}

// Undo a fill: blank the control and remove the review outline. Mirrors applyFill
// across input/textarea/select/radio/checkbox. Never touches submit.
export function clearField(root: ParentNode, selector: string): boolean {
  const els = [...root.querySelectorAll(selector)];
  if (els.length === 0) return false;
  for (const el of els) {
    const tag = el.tagName.toLowerCase();
    const type = (el.getAttribute('type') || '').toLowerCase();
    if (tag === 'input' && (type === 'radio' || type === 'checkbox')) {
      const m = el as HTMLInputElement;
      if (m.checked) {
        m.checked = false;
        m.dispatchEvent(new Event('change', { bubbles: true }));
      }
    } else if (tag === 'input' || tag === 'textarea') {
      setNativeValue(el as HTMLInputElement, '');
    } else if (tag === 'select') {
      (el as HTMLSelectElement).value = '';
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    unmark(el);
  }
  return true;
}

export function clearFills(root: ParentNode, targets: { fieldId: string; selector: string }[]): string[] {
  const cleared: string[] = [];
  for (const t of targets) if (clearField(root, t.selector)) cleared.push(t.fieldId);
  return cleared;
}

export function applyFills(
  root: ParentNode,
  fills: FieldFill[],
): { filled: string[]; failed: FillFailure[] } {
  const filled: string[] = [];
  const failed: FillFailure[] = [];
  for (const f of fills) {
    const res = applyFill(root, f);
    if (res.ok) filled.push(f.fieldId);
    else failed.push({ fieldId: f.fieldId, reason: res.reason });
  }
  return { filled, failed };
}
