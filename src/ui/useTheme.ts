import { useCallback, useEffect, useRef, useState } from 'react';
import { loadSettings, saveSettings, type ThemePref } from '@/shared/settings';

function systemPrefersDark(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

function resolve(pref: ThemePref): 'light' | 'dark' {
  return pref === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : pref;
}

function applyClass(resolved: 'light' | 'dark') {
  document.documentElement.classList.toggle('dark', resolved === 'dark');
}

/**
 * Resolves the user's theme preference, toggles the `dark` class on <html>, and
 * keeps every surface in sync:
 *  - live OS appearance changes (matchMedia) while preference is 'system'
 *  - cross-surface changes (chrome.storage.onChanged) — e.g. toggling in options
 *    updates an open side panel instantly.
 * Mount once near the root of each surface's <App>.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<ThemePref>('system');
  const prefRef = useRef<ThemePref>('system');

  const setPref = useCallback((pref: ThemePref) => {
    prefRef.current = pref;
    setThemeState(pref);
    applyClass(resolve(pref));
  }, []);

  useEffect(() => {
    let active = true;
    loadSettings().then((s) => {
      if (active) setPref(s.theme);
    });

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onMq = () => {
      if (prefRef.current === 'system') applyClass(resolve('system'));
    };
    mq.addEventListener('change', onMq);

    const onStorage = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'local' && changes.settings) {
        const next = (changes.settings.newValue as { theme?: ThemePref } | undefined)?.theme ?? 'system';
        setPref(next);
      }
    };
    chrome.storage?.onChanged.addListener(onStorage);

    return () => {
      active = false;
      mq.removeEventListener('change', onMq);
      chrome.storage?.onChanged.removeListener(onStorage);
    };
  }, [setPref]);

  const setTheme = useCallback(
    async (next: ThemePref) => {
      setPref(next);
      const s = await loadSettings();
      await saveSettings({ ...s, theme: next });
    },
    [setPref],
  );

  return { theme, resolvedTheme: resolve(theme), setTheme };
}
