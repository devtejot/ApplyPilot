import { ProfileEditor } from '@/profile/ProfileEditor';

export function App() {
  // Close this options tab shortly after a save → focus returns to the prior tab.
  function closeSoon() {
    chrome.tabs.getCurrent().then((t) => {
      if (t?.id !== undefined) setTimeout(() => chrome.tabs.remove(t.id!), 800);
    });
  }

  return (
    <div className="mx-auto max-w-2xl bg-neutral-50 px-6 py-10">
      <ProfileEditor onSaved={closeSoon} />
    </div>
  );
}
