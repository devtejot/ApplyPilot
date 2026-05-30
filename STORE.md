# Publishing ApplyPilot — Microsoft Edge Add-ons (free)

Edge Add-ons is the **free, no-fee** store and runs this exact build (Edge is
Chromium; `chrome.sidePanel` and all APIs work unchanged). The same `dist/`
zip also works on the Chrome Web Store later if you pay its one-time $5 fee.

## 0. One-time setup

1. Create a free Microsoft account (if needed).
2. Register at **Microsoft Partner Center → Microsoft Edge program**:
   https://partner.microsoft.com/dashboard/registration/marketplace?programId=Edge
   Registration for the Edge extensions program is **free** (no fee).
3. Host the privacy policy and grab its URL (required — the extension handles
   personal data). Easiest options:
   - Enable **GitHub Pages** on this repo and link `PRIVACY.md`, or
   - Use the raw file URL: `https://raw.githubusercontent.com/<you>/ApplyPilot/main/PRIVACY.md`

## 1. Build the upload package

```bash
npm run package      # builds dist/ and writes applypilot.zip
```

Upload `applypilot.zip` (it contains the contents of `dist/`, with
`manifest.json` at the zip root).

Before each release, bump `version` in `package.json` (Edge rejects re-uploads
with the same version). Suggested first public version: `1.0.0`.

## 2. Create the submission

In Partner Center → Edge → **Create new extension** → upload the zip, then fill:

### Listing — copy/paste

**Name:** ApplyPilot — AI job application autofill

**Summary (≤ ~132 chars):**
Autofill job applications from your saved profile, with optional AI answers and cover letters. Never auto-submits.

**Description:**
```
ApplyPilot fills out job-application forms for you from a profile you save once —
name, contact, work history, education, eligibility, compensation, and more —
so you stop retyping the same details on every portal.

• Works on Greenhouse, Lever, and Ashby out of the box, plus a generic mode you
  can enable on other job sites.
• Deterministic autofill maps your profile to form fields and highlights every
  filled field for your review.
• Optional AI (bring your own Anthropic or Google key) writes answers to
  open-ended questions, analyzes how well you fit a role, and drafts cover
  letters. AI is optional — autofill works without a key.
• Reuses answers you save, so repeated questions get easier over time.
• Country-aware: defaults to India (phone +91, Indian states, CTC) and adapts to
  the US, UK, and more.
• Light and dark themes.

Privacy first: all your data stays on your device. ApplyPilot has no servers, no
tracking, and no analytics. AI requests go directly to the provider you choose,
using your own key. And ApplyPilot NEVER submits a form for you — you always
review and submit yourself.
```

**Category:** Productivity

**Search terms:** job application, autofill, resume, ATS, cover letter, Greenhouse, Lever, Ashby

**Privacy policy URL:** _(the hosted PRIVACY.md URL from step 0)_

### Screenshots (1280×800 or 640×480, PNG/JPG, at least 1)

Capture from a loaded build (`npm run build`, load `dist/` unpacked in Edge):
1. Side panel on a job page — detected site + "Fill Application".
2. Side panel after fill — filled-fields list with auto/review badges.
3. Side panel AI — match analysis or generated answers.
4. Options/profile editor (show India locale: state dropdown + Current CTC).
5. Onboarding welcome step.
6. (Optional) dark mode.

## 3. Notes for certification (paste into the reviewer notes field)

```
Single purpose: ApplyPilot helps users fill job-application forms from a profile
they save locally, with optional AI assistance. It never submits forms.

Permission justifications:
- storage: persist the user's profile, settings, and history locally on device.
- sidePanel: the extension's main UI is a side panel.
- activeTab + scripting: read and fill the job form on the current tab when the
  user acts, and inject the content script into a non-listed page only after the
  user explicitly clicks "Enable ApplyPilot on this page."
- host_permissions greenhouse.io / lever.co / ashbyhq.com: detect and fill forms
  on these supported applicant-tracking systems.
- host_permissions api.anthropic.com / generativelanguage.googleapis.com: send
  AI requests to the provider the user selects, using the user's own API key.
- optional_host_permissions (other ATS hosts and, optionally, all sites):
  requested on demand only, when the user enables ApplyPilot on a specific page.

Data handling: all user data is stored locally (chrome.storage.local +
IndexedDB). No backend, no analytics, no remote code. AI requests are sent
directly to the user-selected provider with the user's own key.

How to test AI features (optional): AI is off until a key is entered. A reviewer
can test core autofill without any key. To test AI, paste a Google Gemini API
key (free tier) under Settings → AI provider; a key can be created at
https://aistudio.google.com/apikey.
```

## 4. Submit

Complete Availability (markets — select all/worldwide, free), then **Publish**.
Edge certification typically takes a few business days. You'll get email on
approval or required changes.

## 5. Updates

Bump `version`, run `npm run package`, upload the new zip to the existing
submission, update notes if permissions changed, resubmit.

---

### If you later want the Chrome Web Store too
Same `applypilot.zip`. Costs a one-time $5 developer fee at
https://chrome.google.com/webstore/devconsole — then the listing/justification
content above is reusable.
