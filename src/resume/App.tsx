// Resume preview page. Reads the draft handed off by the side panel via
// chrome.storage.session, renders the template inside a contentEditable surface
// (light edits go straight into the print output), and prints to PDF. Regenerate
// re-asks the model with the same JD.
import { useEffect, useState } from 'react';
import type { JobDescription } from '@/shared/types';
import type { ResumeResponse } from '@/ai/contracts';
import { parseMsg, type Msg } from '@/shared/messages';
import { ResumeTemplate } from './ResumeTemplate';

interface Draft {
  jd: JobDescription;
  resume: ResumeResponse;
}

export function App() {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    chrome.storage.session.get('resumeDraft').then((r) => setDraft((r.resumeDraft as Draft | undefined) ?? null));
  }, []);

  async function regenerate() {
    if (!draft) return;
    setBusy(true);
    try {
      const raw = await chrome.runtime.sendMessage({ kind: 'TAILOR_RESUME', jd: draft.jd } satisfies Msg);
      const res = parseMsg(raw);
      if (res?.kind === 'RESUME_RESULT') {
        const next: Draft = { jd: draft.jd, resume: res.resume };
        await chrome.storage.session.set({ resumeDraft: next });
        setDraft(next);
      }
    } finally {
      setBusy(false);
    }
  }

  if (!draft) {
    return <div className="empty">No resume draft. Open a job page, then click "Tailor resume" in the side panel.</div>;
  }

  return (
    <div>
      <div className="toolbar">
        <button onClick={regenerate} disabled={busy}>
          {busy ? 'Regenerating…' : 'Regenerate'}
        </button>
        <button className="primary" onClick={() => window.print()}>
          Download PDF
        </button>
      </div>
      <div className="paper" contentEditable suppressContentEditableWarning>
        <ResumeTemplate data={draft.resume} />
      </div>
    </div>
  );
}
