// Background service worker — the hub. Owns AI calls + the API key (DESIGN.md §1).
// Also owns the answer bank (reuse), since that's where answers are generated.
import { parseMsg, type Msg } from '@/shared/messages';
import { loadSettings, effectiveApiKey } from '@/shared/settings';
import { loadProfile } from '@/shared/profile';
import { makeProvider } from '@/ai/makeProvider';
import { buildProfileContext } from '@/ai/context';
import { analyzeJob, generateAnswers, generateCoverLetter } from '@/ai/tasks';
import { withRetry } from '@/ai/retry';
import { AIError } from '@/ai/provider';
import { findReusable, saveAnswer } from '@/reuse/answerBank';
import type { ErrorCode } from '@/shared/types';

const AI_TIMEOUT_MS = 30_000;

chrome.runtime.onInstalled.addListener((details) => {
  console.info('[ApplyPilot] installed');
  // Action click opens the popup (default_popup), not the panel.
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
  chrome.action.setBadgeBackgroundColor({ color: '#4F46E5' }).catch(() => {});
  // First install → open the onboarding wizard in a tab (not on update/reload).
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/onboarding/index.html') }).catch(() => {});
  }
});

// Keyboard shortcut → open the (window-global) panel. Panel content resets itself
// per active tab, so there's no stale-data bleed across tabs.
chrome.commands.onCommand.addListener((command) => {
  if (command !== 'open-panel') return;
  void (async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.windowId !== undefined) await chrome.sidePanel.open({ windowId: tab.windowId });
  })();
});

// Clear the toolbar badge on navigation; the content script re-sets it if the
// new page is a recognized ATS (see SITE_DETECTED below).
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status === 'loading') chrome.action.setBadgeText({ tabId, text: '' }).catch(() => {});
});

function errorReply(e: unknown): Msg {
  const code: ErrorCode = e instanceof AIError ? e.code : 'UNKNOWN';
  return { kind: 'ERROR', code, detail: e instanceof Error ? e.message : String(e) };
}

// Provider + profile context, or an ERROR Msg explaining what's missing.
async function prepare() {
  const settings = await loadSettings();
  const apiKey = await effectiveApiKey(settings);
  if (!apiKey) {
    // Encrypted-but-not-unlocked → LOCKED (panel prompts for passphrase); else missing.
    const locked = settings.keyEncrypted && !!settings.apiKeyEnc;
    return {
      error: {
        kind: 'ERROR',
        code: locked ? 'LOCKED' : 'INVALID_KEY',
        detail: locked ? 'Unlock your encrypted API key to use AI.' : 'Add your API key in settings.',
      } as Msg,
    };
  }
  const profile = await loadProfile();
  if (!profile) {
    return { error: { kind: 'ERROR', code: 'UNKNOWN', detail: 'Set up your profile first.' } as Msg };
  }
  return { provider: makeProvider({ ...settings, apiKey }), profileContext: buildProfileContext(profile) };
}

function withTimeout(): { signal: AbortSignal; clear: () => void } {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), AI_TIMEOUT_MS);
  return { signal: ctrl.signal, clear: () => clearTimeout(timer) };
}

chrome.runtime.onMessage.addListener((raw, sender, sendResponse) => {
  const msg = parseMsg(raw);
  if (!msg) {
    sendResponse({ kind: 'ERROR', code: 'UNKNOWN', detail: 'malformed message' } satisfies Msg);
    return false;
  }

  switch (msg.kind) {
    case 'PING':
      sendResponse({ kind: 'PONG', from: 'background' } satisfies Msg);
      return false;

    case 'SITE_DETECTED': {
      const tabId = sender.tab?.id;
      if (tabId !== undefined) chrome.action.setBadgeText({ tabId, text: '●' }).catch(() => {});
      return false;
    }

    case 'ANALYZE': {
      void (async () => {
        const prep = await prepare();
        if ('error' in prep) return sendResponse(prep.error);
        const t = withTimeout();
        try {
          const res = await withRetry(() =>
            analyzeJob(prep.provider, { jd: msg.jd, profileContext: prep.profileContext, signal: t.signal }),
          );
          sendResponse({ kind: 'ANALYSIS_RESULT', analysis: res.analysis, match: res.match } satisfies Msg);
        } catch (e) {
          sendResponse(errorReply(e));
        } finally {
          t.clear();
        }
      })();
      return true;
    }

    case 'GENERATE_ANSWERS': {
      void (async () => {
        const company = msg.jd.company;
        const answers: { id: string; answer: string; confidence: number; reused: boolean }[] = [];
        const toAsk: typeof msg.questions = [];

        // Reuse first (no key needed) — only the misses go to the model. A
        // regenerate request sets skipReuse to force a fresh answer.
        for (const q of msg.questions) {
          const reuse = msg.skipReuse ? null : await findReusable(q.text, company);
          if (reuse) {
            answers.push({ id: q.id, answer: reuse.record.answer, confidence: reuse.score, reused: true });
          } else {
            toAsk.push(q);
          }
        }

        if (toAsk.length > 0) {
          const prep = await prepare();
          if ('error' in prep) return sendResponse(prep.error);
          const t = withTimeout();
          try {
            const res = await withRetry(() =>
              generateAnswers(prep.provider, {
                jd: msg.jd,
                profileContext: prep.profileContext,
                questions: toAsk,
                tone: msg.tone,
                signal: t.signal,
              }),
            );
            for (const a of res.answers) {
              answers.push({ id: a.id, answer: a.answer, confidence: a.confidence, reused: false });
              const q = toAsk.find((x) => x.id === a.id);
              if (q) await saveAnswer(q.text, a.answer, company);
            }
          } catch (e) {
            return sendResponse(errorReply(e));
          } finally {
            t.clear();
          }
        }

        sendResponse({ kind: 'ANSWERS_RESULT', answers } satisfies Msg);
      })();
      return true;
    }

    case 'GENERATE_COVER_LETTER': {
      void (async () => {
        const prep = await prepare();
        if ('error' in prep) return sendResponse(prep.error);
        const t = withTimeout();
        try {
          const res = await withRetry(() =>
            generateCoverLetter(prep.provider, { jd: msg.jd, profileContext: prep.profileContext, signal: t.signal }),
          );
          sendResponse({ kind: 'COVER_LETTER_RESULT', coverLetter: res.coverLetter } satisfies Msg);
        } catch (e) {
          sendResponse(errorReply(e));
        } finally {
          t.clear();
        }
      })();
      return true;
    }

    default:
      return false;
  }
});

export {};
