# ApplyPilot — Technical Design Document

AI-powered Chrome Extension that cuts a 10–15 min job application down to under 2 min.
Assists while the user browses job pages. **Never auto-submits. Human review always required.**

---

## 0. Thesis

The real bottleneck is **mechanical form-filling on ~6 known ATS platforms**, not intelligence.
~80% of value = deterministic field mapping (name/email/phone/links). Only ~20% needs an LLM
(freeform questions, cover letter, match score).

**Thin AI, fat deterministic core.** One batched structured LLM call per task. Everything local.
No backend. BYO API key. Side panel UI. Never click submit.

---

## 1. Extension Architecture

**Side Panel is primary UI; popup is secondary.** Popup closes on blur — user clicks page form,
popup dies, review flow breaks. `chrome.sidePanel` (Chrome 114+) stays open beside the page.
Popup = launcher + status only.

**Manifest V3.** Service worker background (not persistent).

```
TAB
├── JOB PAGE
│   └── CONTENT SCRIPT: site detect, JD extract, form scan, fill + highlight
│                        (DOM read/write only — no AI, no key, no submit click)
└── SIDE PANEL (React): match score, JD summary, "Fill Application", per-field review,
                         cover letter   (no page DOM, no AI key)

   content <—chrome.runtime—> BACKGROUND SERVICE WORKER (hub) <—chrome.runtime—> side panel
                              - AI provider calls (holds key, CORS-free)
                              - storage orchestration
                              - message router
                                   │
                    ┌─────────────┴─────────────┐
            chrome.storage.local           IndexedDB (Dexie)
            profile, key, settings         history, answer-bank, resume blob
```

| Layer | Owns | Never does |
|---|---|---|
| Popup | launch panel, on/off, profile % | heavy logic |
| Side panel | all review UI, user actions, render results | page DOM, AI key |
| Content script | DOM read/write (extract, scan, fill, highlight) | AI calls, key, submit click |
| Background SW | AI calls, storage, routing, owns key | page DOM access |

**Messaging:** one-shot `sendMessage` for commands; long-lived `connect` port for AI streaming.
Content↔panel never talk direct — background is hub. Single discriminated-union contract,
Zod-validated both ends.

```typescript
type Msg =
  | { kind: 'DETECT_SITE'; tabId: number }
  | { kind: 'SITE_RESULT'; site: SiteMatch }
  | { kind: 'EXTRACT_JD'; tabId: number }
  | { kind: 'JD_RESULT'; jd: JobDescription }
  | { kind: 'SCAN_FORM'; tabId: number }
  | { kind: 'FORM_RESULT'; fields: FieldDescriptor[] }
  | { kind: 'GENERATE'; jd: JobDescription; fields: FieldDescriptor[] }
  | { kind: 'FILL'; tabId: number; map: FieldFill[] }
  | { kind: 'FILL_RESULT'; filled: string[]; failed: FillFailure[] }
  | { kind: 'ERROR'; code: ErrorCode; detail: string };
```

**Permissions (minimize install warnings):**

```jsonc
{
  "permissions": ["storage", "sidePanel", "scripting", "activeTab"],
  "host_permissions": [
    "https://*.greenhouse.io/*", "https://*.lever.co/*",
    "https://*.ashbyhq.com/*", "https://*.myworkdayjobs.com/*",
    "https://*.smartrecruiters.com/*", "https://*.linkedin.com/*"
  ],
  "optional_host_permissions": ["https://*/*"]  // generic pages: request on demand
}
```

- Known ATS: static `content_scripts`.
- Generic pages: `activeTab` + `scripting.executeScript` on click (no broad `<all_urls>` warning).
- AI endpoint host: `optional` → request when key saved.

---

## 2. Site Detection

Two signals → weighted confidence. URL strong, DOM confirms.

```
score = 0.6 * urlMatch + 0.4 * domMatch     // detected if >= 0.6
```

| Site | URL | DOM signature |
|---|---|---|
| LinkedIn | linkedin.com/jobs, Easy Apply modal | `.jobs-easy-apply-modal`, `[data-job-id]` |
| Greenhouse | *.greenhouse.io, job-boards.greenhouse.io, embed iframe boards.greenhouse.io | `#application_form`, `input[id^="job_application"]` |
| Lever | jobs.lever.co/{co}/{id} | `.application-form`, `input[name="resume"]` |
| Ashby | jobs.ashbyhq.com | `[class*="ashby"]`, `[id^="_systemfield"]` |
| Workday | *.myworkdayjobs.com, /wday/ | `[data-automation-id]` everywhere |
| SmartRecruiters | *.smartrecruiters.com | `.js-application`, `[data-test]` |
| Generic | none above | `<form>` w/ file input + ≥2 app-keyword fields |

URL alone fails on embeds + tenant subdomains; DOM alone fails on SPA pre-hydration → combine.
Each site = an **adapter** implementing one interface. New site = one file.

```typescript
interface SiteAdapter {
  id: SiteId;
  matchUrl(url: string): number;        // 0..1
  matchDom(doc: Document): number;       // 0..1
  extractJD(doc: Document): Promise<JobDescription | null>;
  scanForm(doc: Document): FieldDescriptor[];
}
```

---

## 3. Job Description Extraction

Reliability ladder, degrade gracefully:

```
1. Adapter selector (per-ATS DOM path)          highest reliability
2. Wait-for-render (MutationObserver, SPA)      Workday/Ashby/LinkedIn
3. Mozilla Readability fallback                 generic main-content
4. Largest-text-block heuristic                 last resort
5. Manual: user selects text -> "use this"      never blocks user
```

SPA handling: `waitForSelector` via MutationObserver (event-driven, no polling), debounce 300ms
after last mutation, auto-scroll once for lazy sections. Embedded Greenhouse iframe:
`all_frames: true`, extract JD from parent, form from iframe, background stitches by tabId.
Output normalized + trimmed to ~6k chars (drop benefits/EEO/legal boilerplate) before AI.

---

## 4. Candidate Profile

Single source of truth in `chrome.storage.local`. Resume = extracted text + optional blob (IndexedDB).

```typescript
interface CandidateProfile {
  version: 1;
  personal: {
    firstName: string; lastName: string; email: string;
    phone: string;                         // E.164, formatted on fill
    location: { city: string; state: string; country: string; postalCode?: string };
    links: { linkedin?: string; github?: string; portfolio?: string; other?: string[] };
  };
  eligibility: {                           // common ATS yes/no -> deterministic, never AI
    workAuthorized: boolean; requiresSponsorship: boolean; willingToRelocate: boolean;
    remoteOnly?: boolean; noticePeriodDays?: number; desiredSalary?: string;
    veteranStatus?: string; disabilityStatus?: string; gender?: string; ethnicity?: string;
  };
  resume: { fileName: string; text: string; blobId?: string; updatedAt: number };
  workHistory: WorkItem[];
  education: EducationItem[];
  skills: string[];
  projects: ProjectItem[];
  certifications: CertItem[];
  summary?: string;                        // 2-3 line pitch, AI context
}

interface WorkItem {
  company: string; title: string; startDate: string; endDate: string | 'present';
  location?: string; bullets: string[];
}
interface EducationItem {
  school: string; degree: string; field: string; startDate?: string; endDate?: string; gpa?: string;
}
interface ProjectItem { name: string; description: string; url?: string; tech?: string[]; }
interface CertItem { name: string; issuer: string; date?: string; }
```

Resume parse: pdf.js extract text on upload; optional one AI call to structure raw text → user edits.
Always store raw text (it's the AI context).

---

## 5. AI Layer

One batched structured call per task. No chains/agents. Validate with Zod. One repair retry. Deterministic fallback.

Context: `SYSTEM(role+rules+"output only valid JSON")` + `USER(<profile_compact><job_description><task>)`.
Compact the profile — top work items + skills + summary cover 95%.

Structured output: Claude tool-use; OpenAI `response_format: json_schema`; Gemini `responseSchema`.
Abstraction normalizes to "JSON matching this Zod schema."

**JSON contracts:**

```json
// Job analysis + match score (one call)
{
  "analysis": { "title": "...", "company": "...", "seniority": "senior",
    "keyRequirements": ["..."], "niceToHave": ["..."], "redFlags": ["..."] },
  "match": { "score": 78, "verdict": "strong",
    "strengths": ["..."], "gaps": ["..."], "recommendation": "..." }
}

// Question answering (batch all freeform in one call)
// IN: { "questions": [{ "id":"q1", "text":"Why us?", "maxLength":500 }] }
{ "answers": [{ "id":"q1", "answer":"...", "confidence":0.82, "usedProfileFields":["summary"] }] }

// Cover letter (streamed)
// IN: { "tone":"professional", "length":"short", "highlights":["k8s","Go"] }
{ "coverLetter": "..." }

// Autofill mapping — AI only for ambiguous fields
// IN: { "fields": [{ "id":"f7","label":"Years of Python","type":"text","options":[] }] }
{ "mappings": [{ "fieldId":"f7","value":"6","confidence":0.7,"source":"inferred","needsReview":true }] }
```

Recovery: parse → Zod validate → on fail, 1 repair retry (send error back) → deterministic fallback
(blank + flag). Confidence < threshold → `needsReview` (yellow), never auto-trusted.

---

## 6. Form Detection Engine

Hard part = **custom ARIA comboboxes** (Workday/Ashby/Lever), not native `<select>`. `.value=` does nothing on them.

```
1. Query: input[text|email|tel|url|number|date], textarea, select, [contenteditable],
   [role=combobox], [role=listbox], [role=radiogroup]
2. Skip: hidden, disabled, submit/button/password, readonly
3. Group radios/checkboxes by name + fieldset
4. Resolve label; detect required (attr | aria-required | "*")
```

Label priority (stop at first): `<label for>` → wrapping `<label>` → aria-labelledby → aria-label →
fieldset>legend → preceding heading/text → placeholder → tokenized name/id.

```typescript
interface FieldDescriptor {
  id: string; selector: string;
  controlType: 'text'|'email'|'tel'|'url'|'number'|'date'
             |'textarea'|'select'|'radio'|'checkbox'|'file'|'combobox';
  label: string; labelSource: string;   // labelSource drives confidence
  required: boolean;
  options?: { value: string; label: string }[];
  group?: string; maxLength?: number; currentValue?: string; frameId?: number;
}
```

---

## 7. Autofill Engine

Three-tier — keep AI out of the easy 80%:

```
TIER 1 DETERMINISTIC (no AI, conf ~1.0): label keyword -> canonical profile key
TIER 2 ANSWER BANK   (no AI):            normalized question matches stored answer
TIER 3 AI            (leftover freeform): batch unmapped -> one call
```

Confidence: `conf = labelSourceWeight * matchStrength`
(`<label for>`=1.0, aria-label=0.9, placeholder=0.6, id-token=0.4). Auto-fill if ≥0.85 else review.

**React/SPA trap (critical):** controlled inputs ignore `el.value = x`. Use native setter + dispatch:

```typescript
function setReactInput(el: HTMLInputElement, value: string) {
  const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')!.set!;
  setter.call(el, value);
  el.dispatchEvent(new Event('input',  { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}
```

| Control | Method |
|---|---|
| text/email/tel/url/number/date/textarea | native setter + input+change |
| native select | set value + dispatch change |
| radio/checkbox | `.click()` matching option |
| combobox (ARIA) | click open → wait listbox → match text → click. **High risk → suggest-only, user confirms** |
| file (resume) | cannot set programmatically. Highlight + offer stored blob via user gesture |

Prevent wrong/dupe/bad: one value per canonical key per form; format adapters (phone/date/url);
never fill below threshold without review. Fill in batch → highlight all (green=auto, yellow=review)
→ user reviews → user submits.

**Hard rule: content script has zero submit logic. Never `.click()` submit/apply. Ever.**

---

## 8. Application History

IndexedDB (Dexie) — grows unbounded, needs queries.

```typescript
interface ApplicationRecord {
  id: string; company: string; role: string; jobUrl: string; site: SiteId;
  jobDescriptionHash: string;   // sha256 of normalized JD = dedupe key
  jobDescription: string; matchScore: number;
  generatedAnswers: { question: string; answer: string }[];
  coverLetter?: string;
  status: 'drafted'|'filled'|'submitted_by_user';
  appliedAt: number; updatedAt: number;
}

db.version(1).stores({
  applications: 'id, company, jobUrl, jobDescriptionHash, appliedAt, status',
  answerBank:   'id, normalizedQuestion, intentTag, updatedAt'
});
```

Dedup: on page open, hash normalized JD + check jobUrl → "You drafted this on May 12" + load prior.

---

## 9. Previous Answer Reuse (no vectors)

String similarity + intent taxonomy. No embeddings.

```
1. Normalize: lowercase, strip punctuation, collapse whitespace, drop stopwords
2. Tag intent (fixed taxonomy): why_company, why_role, salary, years_experience,
   work_auth, sponsorship, relocate, notice_period, strength, weakness, ...
3. Lookup:
   a. exact normalized match           -> reuse verbatim (conf 1.0)
   b. same intentTag + Dice > 0.7       -> suggest reuse
   c. else                              -> AI generates, then SAVE to bank
```

Dice coefficient (bigram overlap, ~20 lines, no deps). App questions are highly repetitive → exact
hits common. Eligibility booleans live in profile = always deterministic. Guard company-name leak
before reuse ("excited to join Acme" on a Beta app). Reused answers shown editable.

---

## 10. Local Storage

| Need | Choice | Why |
|---|---|---|
| Profile, settings, API key | chrome.storage.local | small, structured, isolated |
| History, answer bank | IndexedDB (Dexie) | unbounded, indexed queries |
| Resume binary | IndexedDB blob | chrome.storage bad for binary |
| Resume text | chrome.storage.local | small, hot-path |
| chrome.storage.sync | avoid for MVP | 8KB/item, 100KB total — resume won't fit; sync = Phase 3 |

Add `"unlimitedStorage"` if storing resume blobs.

---

## 11. UI/UX

Popup = launcher (site detected, profile %, Open Side Panel, count).
Side panel = workhorse: match card → strengths/gaps → [Fill Application] → field list
(green auto / yellow review) → [Generate cover letter] → "Review on page, then submit yourself."

State machine: `idle → detecting → detected → extracting → analyzed → generating →
filled(review) → done`; any → `error(recoverable)` → prior state.

Loading = per-section skeletons; cover letter streams. Errors inline + retry, non-blocking.
Review state = product's soul: page badges mirror panel; nothing submitted by us.

---

## 12. Security & Privacy

Everything local. BYO key. User owns data. Full transparency.

| Concern | Approach | Tradeoff |
|---|---|---|
| Resume | text+blob local; leaves device only to chosen AI provider | trust provider |
| API key | chrome.storage.local, per-extension isolated | not encrypted at rest — be honest |
| Encryption | defer; real = passphrase + WebCrypto AES-GCM (Phase 5, opt-in) | obfuscation = theater |
| PII to AI | only chosen provider; show transparency panel (exact payload) | builds trust |
| Submit safety | code-level: no submit click anywhere | none |

Don't claim encryption you don't have. MVP pitch: "All data stays on your device. AI requests go
directly to your provider with your key. Nothing touches our servers (there are none)."

---

## 13. AI Provider Abstraction

```typescript
interface AIProvider {
  id: 'claude' | 'openai' | 'gemini';
  name: string;
  generateStructured<T>(args: {
    system: string; user: string; schema: ZodSchema<T>; signal?: AbortSignal;
  }): Promise<T>;
  generateStream(args: {
    system: string; user: string; onToken: (t: string) => void; signal?: AbortSignal;
  }): Promise<string>;
}

interface ProviderConfig {
  provider: AIProvider['id']; apiKey: string; model: string; maxTokens: number;
}

const providers: Record<string, () => AIProvider> = {
  claude: () => new ClaudeAdapter(),   // messages API, tool-use for JSON
  openai: () => new OpenAIAdapter(),   // response_format json_schema
  gemini: () => new GeminiAdapter(),   // responseSchema
};
```

Default Claude (best JSON adherence). New provider = new adapter, no core change.

---

## 14. Error Handling Matrix

| Failure | Detection | Recovery | UX |
|---|---|---|---|
| AI timeout | AbortController 30s | retry once → manual | "Taking long — [retry] or fill manually" |
| Missing JD | ladder exhausted | manual text-select | "[Select text on page]" |
| Unsupported form | 0 fillable fields | mark generic, manual | "Form not recognized — answers ready in panel" |
| Wrong mapping | conf < 0.85 | flag needsReview | yellow badge, user confirms |
| Dynamic page | waitForSelector timeout | re-scan + re-arm observer | "Still loading — [rescan]" |
| Rate limit 429 | provider status | exp backoff, queue | "Rate-limited — retrying in 10s" |
| Network fail | fetch throws | backoff, preserve draft | "Offline — saved as draft" |
| Bad AI JSON | Zod fail | 1 repair retry → fallback | field blank + review flag |
| Invalid key 401 | provider 401 | route to settings | "Key invalid — [update key]" |
| React input rejects | post-fill value mismatch | retry native-setter → flag | yellow, "type manually" |
| Combobox no match | option not found | suggest-only | dropdown stays, value in panel |

Principle: every failure degrades to "user does it manually with AI output visible." Never a dead end.

---

## 15. Tech Stack (opinionated)

| Layer | Pick | Why / rejected |
|---|---|---|
| Language | TypeScript strict | non-negotiable |
| UI | React 18 | panel + popup |
| Build | Vite + @crxjs/vite-plugin | MV3 HMR solved; reject Webpack |
| Styling | Tailwind | fast |
| State | Zustand | tiny, no boilerplate; reject Redux |
| Validation | Zod | one schema = TS type + runtime + AI-output guard. Keystone lib |
| Storage | chrome.storage.local + Dexie | §10 |
| PDF | pdf.js | client-side resume text |
| Manifest | MV3 | mandatory |
| Tests | Vitest + jsdom; manual ATS smoke matrix | parsers need DOM fixtures |

Zod is the keystone: AI contracts, messages, profile, storage records — one source of truth,
validated at every boundary. Makes "thin AI, fat deterministic" safe.

---

## 16. Scalability Roadmap

**Phase 1 — Core Extension.** Goals: detect 6 ATS, extract JD, scan+fill deterministic, match score,
manual review; under-2-min loop on Greenhouse/Lever/Ashby. Deliverables: MV3 shell, side panel,
profile setup, adapters, form engine, autofill (T1+AI), BYO key, Claude adapter, history.
Risks: combobox filling fragility, ATS DOM drift. Considerations: adapter pattern isolates breakage;
transparency panel from day 1.

**Phase 2 — Answer Reuse.** Goals: cut repeat typing. Deliverables: answer bank, normalization +
Dice similarity, company-leak guard, reuse-or-regenerate UI. Risks: stale answers, leaked company
name. Considerations: pure string-based, no embeddings.

**Phase 3 — Cloud Sync.** Goals: multi-device + optional proxy backend (hides keys, billing).
Deliverables: auth, encrypted sync, provider-proxy adapter. Risks: backend + PII custody + GDPR.
Considerations: E2E encryption with passphrase; monetization starts here.

**Phase 4 — Application Insights.** Goals: response rates by score, funnel. Deliverables: status
tracking, dashboards, score calibration. Risks: manual/noisy status. Considerations: opt-in.

**Phase 5 — AI Personalization.** Goals: learn user's voice, tailor per company, encryption GA.
Deliverables: tone profile from edits, feedback loop, at-rest encryption. Risks: over-personalization,
privacy surface. Considerations: few-shot from user's best answers beats RAG at this scale.

---

## TL;DR opinions

- Side panel, not popup. Popup-blur kills review flow.
- Thin AI: one batched structured call per task. 80% of fills are deterministic.
- Zod everywhere = safety backbone.
- React native-setter + combobox suggest-only = where naive autofills die. Get these right.
- No backend, BYO key, all local for MVP. Honest privacy > fake encryption.
- Adapter-per-site = ATS drift is a one-file fix.
- Never click submit. Code-level guarantee.
