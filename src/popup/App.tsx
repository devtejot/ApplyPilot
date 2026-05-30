// Popup = launcher + status only (DESIGN.md §1). Heavy UI lives in the side panel,
// which stays open while the user interacts with the page form.
import { ArrowRight, Settings } from 'lucide-react';
import { Button, ThemeToggle, useTheme } from '@/ui';

export function App() {
  useTheme();

  async function openPanel() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.windowId !== undefined) {
      await chrome.sidePanel.open({ windowId: tab.windowId });
      window.close();
    }
  }

  return (
    <div className="flex flex-col gap-3 bg-bg p-4 text-fg">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-base font-semibold">ApplyPilot</h1>
          <p className="text-xs text-fg-muted">AI-assisted autofill</p>
        </div>
        <ThemeToggle />
      </div>

      <Button onClick={openPanel} iconRight={<ArrowRight className="h-4 w-4" />} className="w-full">
        Open side panel
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => chrome.runtime.openOptionsPage()}
        iconLeft={<Settings className="h-3.5 w-3.5" />}
        className="self-start"
      >
        Edit profile
      </Button>
    </div>
  );
}
