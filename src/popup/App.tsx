// Popup = launcher + status only (DESIGN.md §1). Heavy UI lives in the side panel,
// which stays open while the user interacts with the page form. Privacy is an
// inline disclosure here — a modal is wrong in a 320px popup.
import { useState } from 'react';
import { ArrowRight, Check, ChevronDown, Send, Settings, ShieldCheck } from 'lucide-react';
import { PRIVACY_SUMMARY, privacyPoints } from '@/shared/privacy';
import { Button, ThemeToggle, cn, useTheme } from '@/ui';

export function App() {
  useTheme();
  const [showPrivacy, setShowPrivacy] = useState(false);

  async function openPanel() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.windowId !== undefined) {
      await chrome.sidePanel.open({ windowId: tab.windowId });
      window.close();
    }
  }

  return (
    <div className="flex w-80 flex-col bg-bg text-fg">
      <header className="flex items-center justify-between gap-2 px-4 pb-3 pt-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-fg">
            <Send className="h-4 w-4" />
          </span>
          <div className="leading-tight">
            <h1 className="text-sm font-semibold">ApplyPilot</h1>
            <p className="text-[11px] text-fg-muted">AI-assisted autofill</p>
          </div>
        </div>
        <ThemeToggle />
      </header>

      <div className="flex flex-col gap-2 px-4 pb-4">
        <Button onClick={openPanel} iconRight={<ArrowRight className="h-4 w-4" />} className="w-full">
          Open side panel
        </Button>
        <Button
          variant="secondary"
          onClick={() => chrome.runtime.openOptionsPage()}
          iconLeft={<Settings className="h-4 w-4" />}
          className="w-full"
        >
          Edit profile
        </Button>
      </div>

      <div className="border-t border-border">
        <button
          type="button"
          onClick={() => setShowPrivacy((v) => !v)}
          aria-expanded={showPrivacy}
          className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-surface-muted"
        >
          <ShieldCheck className="h-4 w-4 shrink-0 text-success" />
          <span className="flex-1 text-xs text-fg-muted">{PRIVACY_SUMMARY}</span>
          <ChevronDown className={cn('h-4 w-4 shrink-0 text-fg-subtle transition-transform', showPrivacy && 'rotate-180')} />
        </button>
        {showPrivacy && (
          <ul className="flex flex-col gap-2.5 px-4 pb-4">
            {privacyPoints().map((p) => (
              <li key={p.title} className="flex gap-2">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                <p className="text-[11px] leading-snug text-fg-muted">
                  <span className="font-medium text-fg">{p.title}.</span> {p.detail}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
