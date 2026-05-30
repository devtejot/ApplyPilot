import { useEffect, useState, type ReactNode } from 'react';
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
} from '@/history/historyRepo';
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

export function App() {
  const { status, setStatus, setError, error } = usePanelStore();
  const [site, setSite] = useState<SiteMatch | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [profileComplete, setProfileComplete] = useState(false);
  const [aiConfigured, setAiConfigured] = useState(false);

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

  useEffect(() => {
    (async () => {
      const tabId = await activeTabId();
      if (tabId) {
        setStatus('detecting');
        const r = await sendToTab(tabId, { kind: 'DETECT_SITE', tabId });
        if (r?.kind === 'SITE_RESULT') {
          setSite(r.site);
          setStatus('detected');
          setPriorApp((await findApplicationByUrl(r.site.url)) ?? null);
        } else setStatus('idle');
      }
      setHistory(await recentApplications(8));
    })();
    const refresh = async () => {
      const p = await loadProfile();
      setProfileName(p?.personal.firstName ? `${p.personal.firstName} ${p.personal.lastName}`.trim() : null);
      setProfileComplete(p ? isProfileComplete(p) : false);
      setAiConfigured(isConfigured(await loadSettings()));
    };
    refresh();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isGreenhouse = site?.site === 'greenhouse';
  const canFill = isGreenhouse && profileComplete && !busy;
  const coverField = fields.find((f) => /cover letter/i.test(f.label) && (f.controlType === 'textarea' || f.controlType === 'text'));

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

  const labelFor = (id: string) => fields.find((f) => f.id === id)?.label ?? id;
  const fillFor = (id: string) => fills.find((f) => f.fieldId === id);

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
        ) : (
          <span className="text-sm text-neutral-500">{status === 'detecting' ? 'detecting…' : 'no page detected'}</span>
        )}
        {priorApp && (
          <p className="mt-1 text-xs text-amber-700">
            Drafted before on {new Date(priorApp.appliedAt).toLocaleDateString()}.
          </p>
        )}
        {!isGreenhouse && <p className="mt-1 text-xs text-neutral-500">Open a Greenhouse application page to fill.</p>}
      </Card>

      <Card label="Profile">
        {profileComplete ? (
          <div className="flex items-center justify-between">
            <span className="font-medium">{profileName}</span>
            <button onClick={() => chrome.runtime.openOptionsPage()} className="text-xs font-medium text-blue-600 hover:underline">Edit</button>
          </div>
        ) : (
          <button onClick={() => chrome.runtime.openOptionsPage()} className="text-sm font-medium text-blue-600 hover:underline">
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
          {!aiConfigured && (
            <button onClick={() => chrome.runtime.openOptionsPage()} className="mt-2 block text-xs font-medium text-blue-600 hover:underline">
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

      {history.length > 0 && (
        <Card label="Recent applications">
          <ul className="flex flex-col gap-1.5">
            {history.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate">
                  <span className="font-medium">{a.company || '—'}</span> · {a.role || 'role'}
                </span>
                <span className="shrink-0 text-neutral-400">
                  {a.matchScore ? `${a.matchScore} · ` : ''}{new Date(a.appliedAt).toLocaleDateString()}
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
