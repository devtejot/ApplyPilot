import { useEffect, useRef, useState, type ReactNode } from 'react';
import { usePanelStore } from './store';
import { parseMsg, type Msg } from '@/shared/messages';
import { mapDeterministic } from '@/mapping/mapProfile';
import { selectAiQuestions, type AiQuestion } from '@/ai/context';
import { loadProfile } from '@/shared/profile';
import { isProfileComplete } from '@/shared/profileSchema';
import { loadSettings, isConfigured } from '@/shared/settings';
import {
  saveApplication,
  findApplicationByUrl,
  recentApplications,
  hashText,
  deleteApplication,
  pruneApplications,
} from '@/history/historyRepo';
import { saveAnswer } from '@/reuse/answerBank';
import { ProfileEditor } from '@/profile/ProfileEditor';
import type { ApplicationRecord } from '@/shared/db';
import type { FieldDescriptor, FieldFill, JobDescription, SiteMatch } from '@/shared/types';
import type { JobAnalysis, MatchScore } from '@/ai/contracts';

async function activeTabId(): Promise<number | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id ?? null;
}
async function sendToTab(tabId: number, msg: Msg): Promise<Msg | null> {
  try {
    return parseMsg(await chrome.tabs.sendMessage(tabId, msg));
  } catch {
    return null;
  }
}
async function sendToBackground(msg: Msg): Promise<Msg | null> {
  try {
    return parseMsg(await chrome.runtime.sendMessage(msg));
  } catch {
    return null;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function App() {
  const { status, setStatus, setError, error, reset } = usePanelStore();
  const [site, setSite] = useState<SiteMatch | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [profileComplete, setProfileComplete] = useState(false);
  const [aiConfigured, setAiConfigured] = useState(false);
  const [needsEnable, setNeedsEnable] = useState(false);

  const [jd, setJd] = useState<JobDescription | null>(null);
  const [fields, setFields] = useState<FieldDescriptor[]>([]);
  const [fills, setFills] = useState<FieldFill[]>([]);
  const [result, setResult] = useState<{ filled: string[]; failed: { fieldId: string; reason: string }[] } | null>(null);
  const [aiQuestions, setAiQuestions] = useState<AiQuestion[]>([]);
  const [match, setMatch] = useState<{ analysis: JobAnalysis; match: MatchScore } | null>(null);
  const [coverLetter, setCoverLetter] = useState<string | null>(null);
  const [priorApp, setPriorApp] = useState<ApplicationRecord | null>(null);
  const [history, setHistory] = useState<ApplicationRecord[]>([]);

  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState<'analyze' | 'answers' | 'cover' | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [onOwnPage, setOnOwnPage] = useState(false);
  const [view, setView] = useState<'main' | 'profile'>('main');
  const lastKeyRef = useRef<string>('');

  // Clear everything tied to a specific page (run when the tab/URL changes).
  function resetPageState() {
    setJd(null);
    setFields([]);
    setFills([]);
    setResult(null);
    setMatch(null);
    setCoverLetter(null);
    setAiQuestions([]);
    setEdits({});
    setPriorApp(null);
    setNeedsEnable(false);
    setOnOwnPage(false);
    reset(); // store: status → idle, error → null
  }

  async function detect() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    // Reset only when the page actually changed — not on spurious same-tab events.
    const key = `${tab.id}|${tab.url ?? ''}`;
    if (key !== lastKeyRef.current) {
      resetPageState();
      lastKeyRef.current = key;
    }
    setStatus('detecting');
    const r = await sendToTab(tab.id, { kind: 'DETECT_SITE', tabId: tab.id });
    if (r?.kind === 'SITE_RESULT') {
      setSite(r.site);
      setNeedsEnable(false);
      setPriorApp((await findApplicationByUrl(r.site.url)) ?? null);
    } else {
      const url = tab.url ?? '';
      const injectable = /^https?:/.test(url);
      const own = url.startsWith(`chrome-extension://${chrome.runtime.id}/`);
      setSite(null);
      setNeedsEnable(injectable);
      setOnOwnPage(own);
      // Close on truly non-actionable pages (chrome://, new tab, PDF, other
      // extensions), but stay open on our own pages so the panel survives the
      // Edit-profile round-trip and re-shows the job tab on return.
      if (!injectable && !own) {
        window.close();
        return;
      }
    }
    setStatus('detected');
  }

  async function refreshProfile() {
    const p = await loadProfile();
    setProfileName(p?.personal.firstName ? `${p.personal.firstName} ${p.personal.lastName}`.trim() : null);
    setProfileComplete(p ? isProfileComplete(p) : false);
    setAiConfigured(isConfigured(await loadSettings()));
  }

  useEffect(() => {
    detect();
    refreshProfile();
    pruneApplications().then(() => recentApplications(8).then(setHistory));

    const onFocus = () => {
      detect();
      refreshProfile();
    };
    const onStorage = (changes: Record<string, unknown>, area: string) => {
      if (area === 'local' && ('profile' in changes || 'settings' in changes)) refreshProfile();
    };
    const onUpdated = (_id: number, info: { status?: string }) => {
      if (info.status === 'complete') detect(); // SPA / page navigation
    };
    const onActivated = () => detect(); // switched tabs

    window.addEventListener('focus', onFocus);
    chrome.storage.onChanged.addListener(onStorage);
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.onActivated.addListener(onActivated);
    return () => {
      window.removeEventListener('focus', onFocus);
      chrome.storage.onChanged.removeListener(onStorage);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.tabs.onActivated.removeListener(onActivated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canFill = !!site && profileComplete && !busy;
  const coverField = fields.find((f) => /cover letter/i.test(f.label) && (f.controlType === 'textarea' || f.controlType === 'text'));

  // Inject the content script into a non-ATS page after the user grants this origin.
  async function enableOnPage() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url) return;
    let origin: string;
    try {
      origin = `${new URL(tab.url).origin}/*`;
    } catch {
      return;
    }
    const granted = await chrome.permissions.request({ origins: [origin] });
    if (!granted) {
      setError('UNKNOWN', 'Permission denied for this page.');
      return;
    }
    const file = chrome.runtime.getManifest().content_scripts?.[0]?.js?.[0];
    if (!file) {
      setError('UNKNOWN', 'Could not locate the content script.');
      return;
    }
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files: [file] });
    } catch (e) {
      setError('UNKNOWN', `Injection failed: ${(e as Error).message}`);
      return;
    }
    // The loader dynamic-imports its chunk — poll until the script answers.
    for (let i = 0; i < 12; i++) {
      const r = await sendToTab(tab.id, { kind: 'DETECT_SITE', tabId: tab.id });
      if (r?.kind === 'SITE_RESULT') {
        setSite(r.site);
        setNeedsEnable(false);
        setPriorApp((await findApplicationByUrl(r.site.url)) ?? null);
        return;
      }
      await sleep(150);
    }
    setError('UNKNOWN', 'Enabled, but no application form was detected on this page.');
  }

  // Merge a patch into the history record for this job URL (upsert by URL).
  async function upsertHistory(jdv: JobDescription, sitev: SiteMatch, patch: Partial<ApplicationRecord>) {
    const existing = await findApplicationByUrl(jdv.url);
    const rec: ApplicationRecord = {
      id: jdv.url,
      company: jdv.company,
      role: jdv.title,
      jobUrl: jdv.url,
      site: sitev.site,
      jobDescriptionHash: existing?.jobDescriptionHash ?? (await hashText(jdv.text)),
      jobDescription: jdv.text,
      matchScore: existing?.matchScore ?? 0,
      generatedAnswers: existing?.generatedAnswers ?? [],
      coverLetter: existing?.coverLetter,
      status: 'filled',
      appliedAt: existing?.appliedAt ?? Date.now(),
      updatedAt: Date.now(),
      ...patch,
    };
    await saveApplication(rec);
    setHistory(await recentApplications(8));
  }

  async function fillApplication() {
    setBusy(true);
    setResult(null);
    setMatch(null);
    setCoverLetter(null);
    setJd(null);
    setAiQuestions([]);
    const tabId = await activeTabId();
    const profile = await loadProfile();
    if (!tabId || !profile) {
      setError('UNKNOWN', 'Missing active tab or profile.');
      setBusy(false);
      return;
    }

    setStatus('extracting');
    const jdMsg = await sendToTab(tabId, { kind: 'EXTRACT_JD', tabId });
    const extracted = jdMsg?.kind === 'JD_RESULT' ? jdMsg.jd : null;
    setJd(extracted);

    setStatus('analyzed');
    const formMsg = await sendToTab(tabId, { kind: 'SCAN_FORM', tabId });
    if (formMsg?.kind !== 'FORM_RESULT' || formMsg.fields.length === 0) {
      setError('UNSUPPORTED_FORM', 'No fillable form found on this page.');
      setBusy(false);
      return;
    }
    setFields(formMsg.fields);

    const determ = mapDeterministic(formMsg.fields, profile);
    setFills(determ);
    setAiQuestions(selectAiQuestions(formMsg.fields, determ.map((f) => f.fieldId)));
    setStatus('filled');

    if (determ.length > 0) {
      const fillMsg = await sendToTab(tabId, { kind: 'FILL', tabId, map: determ });
      if (fillMsg?.kind === 'FILL_RESULT') setResult(fillMsg);
    } else {
      setResult({ filled: [], failed: [] });
    }
    if (extracted && site) await upsertHistory(extracted, site, {});
    setStatus('done');
    setBusy(false);
  }

  async function analyzeFit() {
    if (!jd) return;
    setAiBusy('analyze');
    const res = await sendToBackground({ kind: 'ANALYZE', jd });
    if (res?.kind === 'ANALYSIS_RESULT') {
      setMatch({ analysis: res.analysis, match: res.match });
      if (site) await upsertHistory(jd, site, { matchScore: res.match.score });
    } else if (res?.kind === 'ERROR') setError(res.code, res.detail);
    setAiBusy(null);
  }

  async function generateAiAnswers() {
    if (!jd || aiQuestions.length === 0) return;
    setAiBusy('answers');
    const tabId = await activeTabId();
    const res = await sendToBackground({ kind: 'GENERATE_ANSWERS', jd, questions: aiQuestions });
    if (res?.kind === 'ANSWERS_RESULT' && tabId) {
      const aiFills: FieldFill[] = [];
      for (const a of res.answers) {
        const f = fields.find((x) => x.id === a.id);
        if (!f) continue;
        aiFills.push({
          fieldId: a.id,
          selector: f.selector,
          value: a.answer,
          confidence: a.confidence,
          source: a.reused ? 'reuse' : 'ai',
          needsReview: true,
        });
      }
      const fillMsg = await sendToTab(tabId, { kind: 'FILL', tabId, map: aiFills });
      setFills((prev) => [...prev, ...aiFills]);
      if (fillMsg?.kind === 'FILL_RESULT') {
        setResult((prev) => ({
          filled: [...(prev?.filled ?? []), ...fillMsg.filled],
          failed: [...(prev?.failed ?? []), ...fillMsg.failed],
        }));
      }
      if (site) {
        const generatedAnswers = aiFills.map((f) => ({ question: labelFor(f.fieldId), answer: f.value }));
        await upsertHistory(jd, site, { generatedAnswers });
      }
    } else if (res?.kind === 'ERROR') setError(res.code, res.detail);
    setAiBusy(null);
  }

  async function makeCoverLetter() {
    if (!jd) return;
    setAiBusy('cover');
    const res = await sendToBackground({ kind: 'GENERATE_COVER_LETTER', jd });
    if (res?.kind === 'COVER_LETTER_RESULT') {
      setCoverLetter(res.coverLetter);
      if (site) await upsertHistory(jd, site, { coverLetter: res.coverLetter });
    } else if (res?.kind === 'ERROR') setError(res.code, res.detail);
    setAiBusy(null);
  }

  async function insertCoverLetter() {
    const tabId = await activeTabId();
    if (!tabId || !coverField || !coverLetter) return;
    await sendToTab(tabId, {
      kind: 'FILL',
      tabId,
      map: [{ fieldId: coverField.id, selector: coverField.selector, value: coverLetter, confidence: 1, source: 'ai', needsReview: true }],
    });
  }

  // Fallback when JD extraction grabs the wrong block (or nothing): use the
  // user's on-page text selection as the job description.
  async function useSelectionAsJd() {
    const tabId = await activeTabId();
    if (!tabId) return;
    const r = await sendToTab(tabId, { kind: 'GET_SELECTION', tabId });
    const text = r?.kind === 'SELECTION_RESULT' ? r.text.trim() : '';
    if (text.length < 40) {
      setError('NO_JD', 'Select at least a paragraph of the job description on the page, then try again.');
      return;
    }
    setJd({
      title: jd?.title || 'Selected role',
      company: jd?.company || '',
      text: text.slice(0, 6000),
      url: site?.url ?? '',
      extractedBy: 'manual',
    });
  }

  // Re-fill the field with the user's edited text and save the edit to the reuse
  // bank, so future applications reuse the improved version (not the raw AI output).
  async function saveEditedAnswer(f: FieldFill) {
    const text = (edits[f.fieldId] ?? f.value).trim();
    if (!text) return;
    const tabId = await activeTabId();
    if (tabId) await sendToTab(tabId, { kind: 'FILL', tabId, map: [{ ...f, value: text, needsReview: true }] });
    await saveAnswer(labelFor(f.fieldId), text, jd?.company);
    setFills((prev) => prev.map((x) => (x.fieldId === f.fieldId ? { ...x, value: text } : x)));
  }

  const labelFor = (id: string) => fields.find((f) => f.id === id)?.label ?? id;
  const fillFor = (id: string) => fills.find((f) => f.fieldId === id);
  const aiFills = fills.filter((f) => f.source === 'ai' || f.source === 'reuse');

  if (view === 'profile') {
    return (
      <div className="h-full overflow-y-auto bg-neutral-50 p-4">
        <ProfileEditor onClose={() => setView('main')} onSaved={() => setView('main')} />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto bg-neutral-50 p-4 text-neutral-900">
      <header>
        <h1 className="text-lg font-semibold">ApplyPilot</h1>
        <p className="text-xs text-neutral-500">AI-assisted autofill · never auto-submits</p>
      </header>

      <Card label="Page">
        {site ? (
          <div className="flex items-center justify-between">
            <span className="font-medium capitalize">{site.site}</span>
            <span className="text-xs text-neutral-500">{Math.round(site.confidence * 100)}%</span>
          </div>
        ) : onOwnPage ? (
          <span className="text-sm text-neutral-500">ApplyPilot settings open here — switch to a job page to fill.</span>
        ) : needsEnable ? (
          <div>
            <span className="text-sm text-neutral-500">Not a recognized ATS.</span>
            <button onClick={enableOnPage} className="mt-1 block text-sm font-medium text-blue-600 hover:underline">
              Enable ApplyPilot on this page →
            </button>
          </div>
        ) : (
          <span className="text-sm text-neutral-500">{status === 'detecting' ? 'detecting…' : 'no page detected'}</span>
        )}
        <button onClick={detect} className="mt-1 text-[11px] text-neutral-400 hover:underline">Rescan</button>
        {priorApp && (
          <p className="mt-1 text-xs text-amber-700">
            Drafted before on {new Date(priorApp.appliedAt).toLocaleDateString()}.
          </p>
        )}
      </Card>

      <Card label="Profile">
        {profileComplete ? (
          <div className="flex items-center justify-between">
            <span className="font-medium">{profileName}</span>
            <button onClick={() => setView('profile')} className="text-xs font-medium text-blue-600 hover:underline">Edit</button>
          </div>
        ) : (
          <button onClick={() => setView('profile')} className="text-sm font-medium text-blue-600 hover:underline">
            {profileName ? 'Finish profile setup →' : 'Set up your profile →'}
          </button>
        )}
      </Card>

      <button
        onClick={fillApplication}
        disabled={!canFill}
        className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white enabled:hover:bg-neutral-700 disabled:opacity-40"
      >
        {busy ? 'Filling…' : 'Fill Application'}
      </button>

      {jd && (
        <Card label="Job">
          <div className="font-medium">{jd.title || 'Untitled role'}</div>
          {jd.company && <div className="text-xs text-neutral-500">{jd.company}</div>}
          <button onClick={useSelectionAsJd} className="mt-0.5 text-[11px] text-neutral-400 hover:underline">
            JD wrong? Select text on the page → use it
          </button>
          {!aiConfigured && (
            <button onClick={() => setView('profile')} className="mt-2 block text-xs font-medium text-blue-600 hover:underline">
              Add an API key to enable AI →
            </button>
          )}
          {aiConfigured && (
            <div className="mt-2 flex flex-wrap gap-2">
              <Pill onClick={analyzeFit} disabled={aiBusy !== null} label={aiBusy === 'analyze' ? 'Analyzing…' : 'Analyze fit'} />
              {aiQuestions.length > 0 && (
                <Pill onClick={generateAiAnswers} disabled={aiBusy !== null} label={aiBusy === 'answers' ? 'Writing…' : `Generate ${aiQuestions.length} answer${aiQuestions.length === 1 ? '' : 's'}`} />
              )}
              <Pill onClick={makeCoverLetter} disabled={aiBusy !== null} label={aiBusy === 'cover' ? 'Drafting…' : 'Cover letter'} />
            </div>
          )}
        </Card>
      )}

      {!jd && result && (
        <Card label="Job">
          <span className="text-sm text-neutral-500">Couldn&apos;t read the job description.</span>
          <button onClick={useSelectionAsJd} className="mt-1 block text-sm font-medium text-blue-600 hover:underline">
            Select it on the page → use as JD
          </button>
        </Card>
      )}

      {aiBusy && (
        <Card label={aiBusy === 'analyze' ? 'Analyzing…' : aiBusy === 'answers' ? 'Writing answers…' : 'Drafting cover letter…'}>
          <div className="flex flex-col gap-1.5">
            <div className="h-2 w-3/4 animate-pulse rounded bg-neutral-200" />
            <div className="h-2 w-1/2 animate-pulse rounded bg-neutral-200" />
          </div>
        </Card>
      )}

      {match && <MatchCard analysis={match.analysis} match={match.match} />}

      {coverLetter && (
        <Card label="Cover letter">
          <p className="whitespace-pre-wrap text-xs text-neutral-700">{coverLetter}</p>
          <div className="mt-2 flex gap-2">
            <Pill onClick={() => navigator.clipboard.writeText(coverLetter)} label="Copy" />
            {coverField && <Pill onClick={insertCoverLetter} label="Insert into form" />}
          </div>
        </Card>
      )}

      {error && (
        <Card label="Error"><span className="text-sm text-red-600">{error.detail}</span></Card>
      )}

      {result && (
        <Card label={`Filled ${result.filled.length} field${result.filled.length === 1 ? '' : 's'}`}>
          <ul className="flex flex-col gap-1">
            {result.filled.map((id) => (
              <li key={id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{labelFor(id)}</span>
                <Badge fill={fillFor(id)} />
              </li>
            ))}
            {result.filled.length === 0 && <li className="text-sm text-neutral-500">No deterministic matches.</li>}
          </ul>
          {result.failed.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1 border-t border-neutral-200 pt-2">
              {result.failed.map((f) => (
                <li key={f.fieldId} className="text-xs text-neutral-500">{labelFor(f.fieldId)} — {f.reason}</li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {aiFills.length > 0 && (
        <Card label="AI answers — edit & save">
          <div className="flex flex-col gap-3">
            {aiFills.map((f) => (
              <div key={f.fieldId}>
                <div className="truncate text-xs font-medium text-neutral-600">{labelFor(f.fieldId)}</div>
                <textarea
                  className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 text-xs"
                  rows={3}
                  value={edits[f.fieldId] ?? f.value}
                  onChange={(e) => setEdits((prev) => ({ ...prev, [f.fieldId]: e.target.value }))}
                />
                <button onClick={() => saveEditedAnswer(f)} className="mt-0.5 text-[11px] font-medium text-blue-600 hover:underline">
                  Save &amp; refill (remembers for next time)
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {history.length > 0 && (
        <Card label="Recent applications">
          <ul className="flex flex-col gap-1.5">
            {history.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate">
                  <span className="font-medium">{a.company || '—'}</span> · {a.role || 'role'}
                </span>
                <span className="flex shrink-0 items-center gap-2 text-neutral-400">
                  <span>
                    {a.matchScore ? `${a.matchScore} · ` : ''}
                    {new Date(a.appliedAt).toLocaleDateString()}
                  </span>
                  <button
                    aria-label="Delete"
                    onClick={async () => {
                      await deleteApplication(a.id);
                      setHistory(await recentApplications(8));
                    }}
                    className="text-neutral-300 hover:text-red-500"
                  >
                    ×
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <footer className="mt-auto text-[11px] text-neutral-400">Review highlighted fields on the page, then submit yourself.</footer>
    </div>
  );
}

function MatchCard({ analysis, match }: { analysis: JobAnalysis; match: MatchScore }) {
  const color =
    match.verdict === 'strong' ? 'bg-green-100 text-green-800' : match.verdict === 'moderate' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800';
  return (
    <Card label="Match">
      <div className="flex items-center gap-2">
        <span className={`rounded px-2 py-1 text-sm font-bold ${color}`}>{match.score}</span>
        <span className="text-sm font-medium capitalize">{match.verdict} fit</span>
        <span className="ml-auto text-xs text-neutral-400">{analysis.seniority}</span>
      </div>
      {match.strengths.length > 0 && (
        <ul className="mt-2 flex flex-col gap-0.5 text-xs text-green-700">{match.strengths.slice(0, 4).map((s, i) => <li key={i}>✓ {s}</li>)}</ul>
      )}
      {match.gaps.length > 0 && (
        <ul className="mt-1 flex flex-col gap-0.5 text-xs text-yellow-700">{match.gaps.slice(0, 4).map((g, i) => <li key={i}>⚠ {g}</li>)}</ul>
      )}
      {match.recommendation && <p className="mt-2 text-xs text-neutral-600">{match.recommendation}</p>}
    </Card>
  );
}

function Card({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-3">
      <div className="mb-1 text-[11px] uppercase tracking-wide text-neutral-400">{label}</div>
      {children}
    </section>
  );
}

function Pill({ onClick, label, disabled }: { onClick: () => void; label: string; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className="rounded bg-neutral-100 px-2 py-1 text-xs font-medium hover:bg-neutral-200 disabled:opacity-40">
      {label}
    </button>
  );
}

function Badge({ fill }: { fill?: FieldFill }) {
  if (fill?.source === 'reuse') return <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[11px] font-medium text-indigo-800">reused · review</span>;
  if (fill?.source === 'ai') return <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[11px] font-medium text-blue-800">AI · review</span>;
  return fill?.needsReview ? (
    <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-[11px] font-medium text-yellow-800">review</span>
  ) : (
    <span className="rounded bg-green-100 px-1.5 py-0.5 text-[11px] font-medium text-green-800">auto</span>
  );
}
