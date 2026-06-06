# JD-Tailored Resume Builder — Design

## Context

ApplyPilot is a privacy-first MV3 extension that autofills job applications from a local profile and drafts AI answers (BYO key). Users already upload a resume — but only its **text** is kept (extracted via pdf.js in `extractPdfText`); the original PDF and its layout are discarded.

Need: generate a **JD-tailored resume from the user's existing content**, rendered into a clean template, exported as PDF — grounded only in real facts (no fabrication) and without weakening the privacy posture.

Decisions reached in brainstorming:
- **Optimize the existing resume** (anchored to the user's real content), not build from scratch.
- **One fixed template** — the approved look: single-column, sans-serif, **navy uppercase section headers with a rule**, company/location + role/date split, labeled skills, projects with right-aligned links. (User: "use this template only.")
- **PDF export only.**

## Goals

- Tailor the user's existing resume content to the active job description — reorder/emphasize, keyword-align — grounded only in profile + resume facts. **No fabrication.**
- Render into the single approved ATS-friendly template.
- Export to PDF via the browser print engine.
- Let the user lightly edit the generated content before export.
- Preserve privacy: only resume text + JD + compact profile context leave the device, to the user's chosen provider (same as existing answer/cover-letter features).

## Non-goals (YAGNI)

- Multiple templates / template switching — one template only.
- Parametric layout-profile inference (auto-detect columns/font/accent) — **dropped**; the single fixed template makes it unnecessary.
- Pixel-cloning the original PDF or vision-model layout clone.
- DOCX or other export formats — PDF only.
- Editing the original PDF in place.

## Approach

Chosen: **A (simplified)**. Tailor content with the existing AI provider into a **structured resume object**, render that object into the one fixed React template, print to PDF. No layout detection.

## Architecture / Components

**New**
- `src/ai/contracts.ts` → `resumeResponseSchema`: `{ summary, experience:[{company, location?, title, dates, stack?, bullets[]}], skills:[{label, items}], projects?:[{name, stack?, link?, bullets[]}], education:[{school, location?, degree, dates, coursework?}] }`.
- `src/ai/prompts.ts` → `SYSTEM_RESUME` (frozen) + `buildResumeUser(profileContext, jd, resumeText)`: rewrite/reorder to match the JD, ATS-keyword align, **facts only** from profile + resume text, keep the section set, concise bullets. JD and resume text go in clearly-delimited blocks with a guard line stating they are reference data, never instructions (prompt-injection defense).
- `src/ai/tasks.ts` → `tailorResume(provider, { jd, profileContext, resumeText, signal })`.
- `src/resume/` →
  - `ResumeTemplate.tsx` — pure render of the structured resume into the approved template (print-oriented CSS).
  - `index.html` + `main.tsx` + `App.tsx` — preview/print page in its own tab: reads the draft, renders the template with inline-editable fields, **Download PDF** + **Regenerate**.
  - `exportPdf.ts` — `window.print()` with `@media print` sized to A4/Letter, zeroed margins, page-break-aware.
- `src/shared/messages.ts` → `TAILOR_RESUME` (jd) → `RESUME_RESULT` (structured resume), plus the existing `ERROR` path.

**Changed**
- `src/background/index.ts` — `TAILOR_RESUME` handler reusing `prepare()` / `withRetry` / `withTimeout`; calls `tailorResume`, returns `RESUME_RESULT`.
- `src/sidepanel/App.tsx` — "Tailor resume" button (shown when JD + resume + AI key present). On click → `TAILOR_RESUME` → write structured draft to `chrome.storage.session['resumeDraft']` → open `src/resume/index.html` in a new tab.
- `manifest.config.ts` + `vite.config.ts` — register the resume page as a build entry / web-accessible extension page.

**Reused as-is**: `makeProvider`, `AIProvider.generateStructured`, `prepare()`, `withRetry`/`withTimeout`, the prompt/contract pattern, design tokens/UI, and the existing `profile.resume.text`.

## Data flow

1. Side panel: user on a JD page with a stored resume + AI key clicks **Tailor resume**.
2. `TAILOR_RESUME` → background: `prepare()` (key + profile) → `tailorResume(provider, { jd, profileContext, resumeText: profile.resume.text })` → validated by `resumeResponseSchema` → `RESUME_RESULT`.
3. Side panel writes the structured resume to `chrome.storage.session['resumeDraft']` and opens `src/resume/index.html`.
4. Resume page reads the draft → renders `ResumeTemplate` (editable) → user tweaks → **Download PDF** (`window.print()`).

Why session storage for handoff: the structured object is too large for a query string; `chrome.storage.session` is memory-only (privacy-consistent), shared across extension pages, cleared on browser close.

## Error handling

- No resume text → button disabled with hint "Add your resume in profile".
- No AI key / locked → reuse existing `INVALID_KEY` / `LOCKED` flow (panel unlock prompt).
- AI timeout / bad JSON / network → existing `ErrorCode` toasts.
- Bad result → **Regenerate** on the resume page re-asks the model.

## Privacy / safety

- Leaves device: resume text + JD + compact profile context → the user's chosen provider only — identical posture to existing answer/cover-letter calls.
- Prompt-injection: JD + resume wrapped in delimited data blocks; system prompt states they are reference data, never instructions.
- No new secret storage; the draft is session-only.

## Testing

- **Unit**: `resumeResponseSchema` (valid/invalid), `buildResumeUser` (contains profile/JD/resume blocks + guard line), `tailorResume` (mock provider returns schema-valid output), `ResumeTemplate` render (RTL: sections present, correct order, links rendered).
- **Manual**: upload resume → open a Greenhouse/Lever JD → **Tailor resume** → preview matches the approved template → edit a bullet → **Download PDF** → open the PDF, verify layout + content + no fabrication.

## Open questions

None — scoped to one template, PDF export, content tailoring.
