# ApplyPilot — Privacy Policy

_Last updated: 2026-05-30_

ApplyPilot is a browser extension that helps you fill out job-application forms
using a profile you save and, optionally, an AI provider you choose. This policy
explains exactly what the extension does and does not do with your data.

## Summary

- **All your data stays on your device.** ApplyPilot has no servers and no backend.
- **No tracking, no analytics, no advertising, no data selling.**
- The only network requests ApplyPilot makes are **to the AI provider you choose
  (Anthropic or Google), using your own API key**, and only when you trigger an
  AI feature.

## What data ApplyPilot stores (locally only)

Stored in your browser via `chrome.storage.local` and IndexedDB on your device:

- **Profile** — the information you enter: name, contact details, address,
  links, work history, education, skills, projects, certifications, eligibility,
  compensation, availability, and any optional self-identification fields.
- **Resume text** — text extracted from a PDF you upload (used as context). The
  original PDF file is not retained.
- **AI settings** — your chosen provider, model, and **API key**.
- **Application history & saved answers** — records of forms you've drafted and
  answers you choose to save for reuse.
- **Preferences** — e.g. light/dark theme.

ApplyPilot never transmits this data to us — we have no way to receive it.

## When ApplyPilot accesses a web page

- On supported job sites (Greenhouse, Lever, Ashby), and on other pages **only
  after you explicitly enable it for that page**, ApplyPilot reads the page's
  form fields and job description so it can fill the form and, if you ask,
  provide AI assistance. This reading happens locally in your browser.
- ApplyPilot **never submits forms for you.** Filled fields are highlighted for
  your review; you submit manually.

## What is sent over the network, and to whom

- Only when you click an AI action (analyze fit, generate answers, cover
  letter), ApplyPilot sends the relevant job description and your profile
  context **directly to the AI provider you selected** (Anthropic's API or
  Google's Gemini API), authenticated with **your own API key**, which is stored
  only on your device.
- Your API key and data are sent **only to that provider**, governed by that
  provider's privacy policy. ApplyPilot adds no intermediary.
- If you do not configure an API key, no AI requests are made, and autofill
  still works.

## Permissions

- `storage` — save your profile, settings, and history on your device.
- `sidePanel` — show the ApplyPilot side panel (the main interface).
- `activeTab` / `scripting` — read and fill the job form on the tab you're
  viewing, and inject the helper into a page only when you enable it there.
- Host access to `greenhouse.io`, `lever.co`, `ashbyhq.com` — detect and fill
  on these supported job sites.
- Host access to `api.anthropic.com`, `generativelanguage.googleapis.com` —
  send AI requests to the provider you choose.
- Optional host access (requested on demand) for other job sites and, if you
  choose, any site — used only when you click "Enable ApplyPilot on this page."

## Data retention and deletion

- Data persists locally until you delete it. Use **Settings → Data → Clear all
  data** to erase your profile, API key, history, and saved answers, or remove
  the extension to delete everything it stored.

## Children

ApplyPilot is intended for job seekers and is not directed at children under 13.

## Changes

We may update this policy; the "Last updated" date will change accordingly.

## Contact

Questions: **devtejot@gmail.com**
