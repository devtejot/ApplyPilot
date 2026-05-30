# ApplyPilot

AI-assisted Chrome extension that cuts online job applications to under 2 minutes.
Detects ATS pages, extracts the job description, scores fit, drafts tailored answers, and
autofills the form — then stops. **It never submits. A human always reviews and submits.**

See [DESIGN.md](DESIGN.md) for the full architecture.

## Stack

Vite + @crxjs/vite-plugin · React 18 + TypeScript (strict) · Tailwind · Zod · Zustand · Dexie · MV3.

## Develop

```bash
npm install
npm run dev      # HMR dev build → dist/
npm run build    # typecheck + production build → dist/
```

## Load in Chrome

1. `npm run build` (or `npm run dev`).
2. Visit `chrome://extensions`, enable **Developer mode**.
3. **Load unpacked** → select the `dist/` folder.
4. Open a Greenhouse job page, click the toolbar icon → **Open Side Panel**.

## Test

```bash
npm test          # vitest run (pure parsers/engines)
npm run test:watch
```

## Status

**Slice 1 — Greenhouse deterministic fill (no AI yet).**

- Site detection (URL + DOM confidence) — adapter pattern, Greenhouse adapter.
- Job-description extraction (Greenhouse selectors).
- Form scan engine (label-resolution ladder → `FieldDescriptor[]`).
- Tier-1 deterministic mapping (name / email / phone / LinkedIn / GitHub / location).
  Skips freeform questions (label ends in `?` or > 70 chars) so they're never wrong-filled.
- Fill engine (React-safe native setter; accepts widget reformatting; file + combobox refused).
- Side-panel flow: detect → extract → scan → map → fill, with green/yellow review badges.

**Slice 2 — Profile + resume.**

- Zod profile schema (`profileSchema`) + `isProfileComplete`.
- pdf.js resume text extraction (`extractPdfText`) — lazy-loaded worker.
- Full-page **options** profile editor (personal, links, eligibility, resume, summary,
  skills, work history). Saves to `chrome.storage.local` after validation.
- Side panel + popup link to the options page; fill is gated on a complete profile.

**Slice 3 — AI (BYO key).**

- Provider abstraction (`AIProvider`) + Claude adapter. Dependency-injected, so all
  validation/error logic is unit-tested without the network.
- Structured output via a direct `fetch` to the Messages API with forced tool-use; the
  tool schema comes from `z.toJSONSchema`, and responses validate against the same Zod
  contract. (The official SDK pulls Node-only modules that don't bundle into an MV3
  worker — raw HTTP is the portable fit.)
- Background worker owns the API key + makes the call (30s timeout). Panel/content never
  see the key.
- **Provider is user-selectable** — Google Gemini (free tier, default) or Anthropic Claude
  (paid). Shared `StructuredProvider` base + a per-provider adapter (`makeProvider` picks
  one from settings). Both derive their schema from `z.toJSONSchema` and validate the
  result against the same Zod contract.
- Match score + fit analysis card; AI answers for freeform questions (filled blue ·
  "review"). Options page picks provider + key + model.

**Slice 4 — History, answer reuse, cover letter.**

- Application history in IndexedDB (`historyRepo`) — upsert by job URL; recent list + a
  "drafted before" banner on revisit.
- Previous-answer reuse with no vectors (`reuse` + `answerBank`): normalize → intent tag →
  exact/Dice-fuzzy match. Reused answers skip the model; company-name leak guard prevents
  "excited to join Acme" landing on a Beta application. Reused fields badge indigo · review.
- Cover letter generation (AI) — shown in the panel with Copy + Insert-into-form.
- Background does reuse-then-ask: only un-reused questions hit the model, and new answers
  are saved to the bank.

**Widen — Lever + Ashby adapters.**

- Adapters for `jobs.lever.co` and `jobs.ashbyhq.com` (matchUrl/matchDom/extractJD/scanForm),
  registered alongside Greenhouse. Company is derived from the URL slug.
- `waitForSelector` (MutationObserver) render-wait — the content script waits for each
  adapter's `readySelector` before extracting/scanning, so React SPAs (Ashby) that hydrate
  after `document_idle` work. Falls back after an 8s timeout.
- Everything downstream (scan, fill, AI, history, reuse) is adapter-agnostic — new ATS = one
  file + register. Note: Lever/Ashby selectors are best-effort (Ashby's classes are hashed)
  and may need in-browser tuning; form fill is the robust core.

131 unit tests (Vitest + jsdom; Dexie via fake-indexeddb). Zod v4. Mapping runs in the side
panel; DOM commands go panel ↔ content directly; the background worker handles AI, the answer
bank, and holds the key.

Next: Workday / LinkedIn adapters (harder — custom comboboxes, multi-step modals), cloud sync
(Phase 3).
