// Content script — DOM read/write only. No AI, no key, NEVER clicks submit.
// Injected on supported ATS hosts. JD/form reads wait for SPA hydration first.
import { parseMsg, type Msg } from '@/shared/messages';
import { detectSite } from '@/detect/detectSite';
import { greenhouseAdapter } from '@/adapters/greenhouse';
import { leverAdapter } from '@/adapters/lever';
import { ashbyAdapter } from '@/adapters/ashby';
import { genericAdapter } from '@/adapters/generic';
import { applyFills, clearFills } from '@/forms/fill';
import { waitForSelector } from '@/dom/waitForSelector';
import type { SiteAdapter } from '@/adapters/types';

// Generic is last — specific ATS adapters win on score; generic catches the rest.
const ADAPTERS: SiteAdapter[] = [greenhouseAdapter, leverAdapter, ashbyAdapter, genericAdapter];
const RENDER_TIMEOUT_MS = 8000;

console.info('[ApplyPilot] content script active on', location.host);

function currentAdapter(): SiteAdapter | null {
  const match = detectSite(location.href, document, ADAPTERS);
  return ADAPTERS.find((a) => a.id === match.site) ?? null;
}

// Tell the background to badge the toolbar icon when this is a recognized ATS.
{
  const match = detectSite(location.href, document, ADAPTERS);
  if (match.site !== 'generic') {
    chrome.runtime.sendMessage({ kind: 'SITE_DETECTED', site: match.site } satisfies Msg).catch(() => {});
  }
}

chrome.runtime.onMessage.addListener((raw, _sender, sendResponse) => {
  const msg = parseMsg(raw);
  if (!msg) return false;

  switch (msg.kind) {
    case 'PING':
      sendResponse({ kind: 'PONG', from: `content:${location.host}` } satisfies Msg);
      return false;

    case 'DETECT_SITE':
      sendResponse({ kind: 'SITE_RESULT', site: detectSite(location.href, document, ADAPTERS) } satisfies Msg);
      return false;

    case 'GET_SELECTION':
      sendResponse({ kind: 'SELECTION_RESULT', text: window.getSelection()?.toString() ?? '' } satisfies Msg);
      return false;

    case 'EXTRACT_JD': {
      void (async () => {
        const adapter = currentAdapter();
        if (adapter) await waitForSelector(document, adapter.readySelector, RENDER_TIMEOUT_MS);
        const jd = adapter?.extractJD(document, location.href) ?? null;
        sendResponse(
          (jd
            ? { kind: 'JD_RESULT', jd }
            : { kind: 'ERROR', code: 'NO_JD', detail: 'No job description found on this page.' }) satisfies Msg,
        );
      })();
      return true; // async sendResponse
    }

    case 'SCAN_FORM': {
      void (async () => {
        const adapter = currentAdapter();
        if (adapter) await waitForSelector(document, adapter.readySelector, RENDER_TIMEOUT_MS);
        sendResponse({ kind: 'FORM_RESULT', fields: adapter?.scanForm(document) ?? [] } satisfies Msg);
      })();
      return true;
    }

    case 'FILL': {
      const { filled, failed } = applyFills(document, msg.map);
      sendResponse({ kind: 'FILL_RESULT', filled, failed } satisfies Msg);
      return false;
    }

    case 'CLEAR': {
      sendResponse({ kind: 'CLEAR_RESULT', cleared: clearFills(document, msg.targets) } satisfies Msg);
      return false;
    }

    default:
      return false;
  }
});

export {};
