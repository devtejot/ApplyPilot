// Wait for a selector to appear (DESIGN.md §3) — handles SPA pages (Ashby, Lever)
// where the JD/form hydrates after document_idle. Event-driven via
// MutationObserver; resolves null on timeout so callers can fall back.
export function waitForSelector(
  root: Document | Element,
  selector: string,
  timeoutMs = 8000,
): Promise<Element | null> {
  const present = root.querySelector(selector);
  if (present) return Promise.resolve(present);

  return new Promise((resolve) => {
    const target = root instanceof Document ? root.documentElement : root;
    const observer = new MutationObserver(() => {
      const el = root.querySelector(selector);
      if (el) {
        observer.disconnect();
        clearTimeout(timer);
        resolve(el);
      }
    });
    const timer = setTimeout(() => {
      observer.disconnect();
      resolve(root.querySelector(selector));
    }, timeoutMs);
    observer.observe(target, { childList: true, subtree: true });
  });
}
