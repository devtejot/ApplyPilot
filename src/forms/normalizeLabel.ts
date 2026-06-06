// Normalize a form-field label so matching (deterministic regex + fuzzy alias)
// sees a clean phrase. Portals decorate labels with required-markers, colons,
// and stray punctuation that otherwise defeat matching ("LinkedIn URL *",
// "Email (required):"). Keep this conservative — only strip known noise.

const NOISE = /\b(required|optional|mandatory|please)\b/g;

/** Lowercased, de-noised label: no asterisks, required/optional markers, or trailing colons. */
export function normalizeLabel(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[*•]/g, ' ')
    .replace(/\(\s*(required|optional|mandatory)\s*\)/g, ' ')
    .replace(NOISE, ' ')
    .replace(/[：:]\s*$/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Glue words dropped before token comparison so word order / filler don't block
// a match ("URL for LinkedIn" → {url, linkedin}; alias "linkedin url" → same set).
const TOKEN_STOP = new Set([
  'a', 'an', 'the', 'of', 'for', 'to', 'your', 'you', 'is', 'are', 'in', 'on', 'at', 'and', 'or',
]);

/** Significant tokens of a label (normalized, stopwords removed). */
export function tokenizeLabel(raw: string): string[] {
  return normalizeLabel(raw)
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !TOKEN_STOP.has(w));
}
