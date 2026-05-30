# Roadmap — Resume file attachment

Status: **planned (not started).** Deferred — current behavior (resume text feeds AI + autofill; user attaches the file manually) is good enough for now.

## Goal

Let ApplyPilot attach the user's resume PDF to a job application's file input, best-effort, without ever auto-submitting.

## Why it doesn't work today

1. **No file is stored.** `onResume` in [src/profile/ProfileEditor.tsx](../../src/profile/ProfileEditor.tsx) runs `extractPdfText` and stores only `{ fileName, text }`. The original PDF bytes are discarded. `CandidateProfile.resume.blobId` is reserved but unused.
2. **File inputs are refused by design.** [src/forms/fill.ts](../../src/forms/fill.ts) returns `file inputs cannot be set programmatically`. Browsers block `input.value` assignment for `<input type=file>`.

## Approach

### 1. Persist the PDF blob
- Add a `resumeBlob` store in Dexie ([src/shared/db.ts](../../src/shared/db.ts)) keyed by an id (or single-row), holding `{ id, fileName, mime, blob: Blob, updatedAt }`.
- On upload, save the blob there **and** keep extracting text (text still needed for AI context). Set `profile.resume.blobId` to the row id.
- Backup/export ([src/shared/dataAdmin.ts](../../src/shared/dataAdmin.ts)): decide whether the blob is included (base64) or excluded like the API key — likely **exclude** to keep backups small; re-upload after import. Document it.
- Storage budget: IndexedDB handles multi-MB blobs fine; cap at ~10 MB and reject larger with a toast.

### 2. Attach path for file inputs
- New helper (e.g. `attachFile` in fill.ts or a sibling) that, for `type === 'file'`:
  - Builds a `File` from the stored blob (`new File([blob], fileName, { type: mime })`).
  - Uses `DataTransfer` to set `input.files`: `const dt = new DataTransfer(); dt.items.add(file); input.files = dt.files;`
  - Dispatches `input` + `change` (bubbling) so framework listeners pick it up.
  - Marks the fill `needsReview` (amber outline) — user must confirm the right file landed.
- Detect resume file inputs by label/name keywords (`resume`, `cv`, `upload`) in [src/forms/scanForm.ts](../../src/forms/scanForm.ts) / mapping, so only the resume input is targeted (never arbitrary file inputs).
- Message plumbing: the content script does the DOM write; the blob must reach the content script. Send bytes (ArrayBuffer) over `chrome.runtime` messaging from the side panel/background, or have the content script request the blob. Keep payload size in mind.

### 3. Wiring
- mapProfile / fill flow: emit a `FieldFill` for the resume file input pointing at the stored blob (special source, e.g. `source: 'file'`), and route it to `attachFile` instead of `applyFill`'s text path.
- Side-panel result card: show "Resume attached (review)" with the same review badge.

## Known limitations (call out in UI copy)

- Custom drag-and-drop uploaders and direct-to-S3 / signed-URL uploaders often ignore a programmatically-set `input.files`. Those stay manual.
- Some SPA validators re-check provenance and reject injected files.
- So this is **best-effort**: succeed on standard inputs (Greenhouse/Lever/Ashby usually OK), fall back to "attach manually" messaging otherwise.

## Out of scope

- Auto-submitting the form (never).
- Converting/editing the resume.
- Multiple resume variants per role (possible later phase).

## Test plan

- Unit: `attachFile` builds a File and sets `input.files` via a mocked `DataTransfer` in jsdom; `fill.test.ts` keeps asserting refusal for non-resume file inputs.
- Manual: real Greenhouse/Lever/Ashby forms — attach lands, shows review outline, never submits; verify a drag-drop uploader gracefully falls back.

## Rough sequencing

1. Blob storage + schema (`blobId`, Dexie store, upload wiring, export decision).
2. `attachFile` helper + content-script messaging for blob bytes.
3. Resume-input detection + fill routing + side-panel review UI.
4. Limitations copy + fallback messaging.
