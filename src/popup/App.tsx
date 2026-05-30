// Popup = launcher + status only (DESIGN.md §1). Heavy UI lives in the side panel,
// which stays open while the user interacts with the page form.
export function App() {
  async function openPanel() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.windowId !== undefined) {
      await chrome.sidePanel.open({ windowId: tab.windowId });
      window.close();
    }
  }

  return (
    <div className="flex flex-col gap-3 p-4 text-neutral-900">
      <div>
        <h1 className="text-base font-semibold">ApplyPilot</h1>
        <p className="text-xs text-neutral-500">AI-assisted autofill</p>
      </div>

      <button
        onClick={openPanel}
        className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-700"
      >
        Open Side Panel →
      </button>

      <button
        onClick={() => chrome.runtime.openOptionsPage()}
        className="text-left text-sm font-medium text-blue-600 hover:underline"
      >
        Edit profile →
      </button>

      <p className="text-[11px] text-neutral-400">Slice 2</p>
    </div>
  );
}
