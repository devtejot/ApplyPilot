// Label resolution ladder (DESIGN.md §6). Returns the best human label for a
// form control plus which rule matched — labelSource drives fill confidence.

export interface ResolvedLabel {
  label: string;
  source: string;
}

/** Collapse whitespace and strip a trailing required-marker asterisk. */
function clean(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\s*\*+\s*$/, '')
    .trim();
}

/** Turn a name/id token into words: job_application[first_name] -> "first name". */
function tokenize(raw: string): string {
  const brackets = [...raw.matchAll(/\[([^\]]+)\]/g)];
  const base = brackets.length ? brackets[brackets.length - 1][1] : raw;
  return base
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2') // camelCase -> camel Case
    .replace(/[_\-.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function refText(doc: Document, ids: string): string {
  return ids
    .split(/\s+/)
    .map((id) => doc.getElementById(id)?.textContent ?? '')
    .join(' ');
}

export function resolveLabel(el: Element): ResolvedLabel {
  const doc = el.ownerDocument;
  const id = el.getAttribute('id');

  // 1. <label for=id> — match by attribute to avoid selector-escaping pitfalls
  if (id) {
    for (const lab of doc.querySelectorAll('label[for]')) {
      if (lab.getAttribute('for') === id && lab.textContent?.trim()) {
        return { label: clean(lab.textContent), source: 'label-for' };
      }
    }
  }

  // 2. wrapping <label>
  const wrap = el.closest('label');
  if (wrap?.textContent?.trim()) {
    return { label: clean(wrap.textContent), source: 'label-wrap' };
  }

  // 3. aria-labelledby
  const labelledby = el.getAttribute('aria-labelledby');
  if (labelledby) {
    const text = clean(refText(doc, labelledby));
    if (text) return { label: text, source: 'aria-labelledby' };
  }

  // 4. aria-label
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel?.trim()) return { label: clean(ariaLabel), source: 'aria-label' };

  // 5. placeholder
  const placeholder = el.getAttribute('placeholder');
  if (placeholder?.trim()) return { label: clean(placeholder), source: 'placeholder' };

  // 6. tokenized name / id
  const token = el.getAttribute('name') || id;
  if (token) {
    const t = tokenize(token);
    if (t) return { label: t, source: 'name-token' };
  }

  return { label: '', source: 'none' };
}
