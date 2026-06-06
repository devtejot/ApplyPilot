import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Copy,
  CornerDownLeft,
  Eraser,
  FileText,
  Lock,
  Pencil,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react';
import { PRIVACY_SUMMARY } from '@/shared/privacy';
import { usePanelStore } from './store';
import { parseMsg, type Msg } from '@/shared/messages';
import { mapDeterministic } from '@/mapping/mapProfile';
import { selectAiQuestions, type AiQuestion } from '@/ai/context';
import { loadProfile } from '@/shared/profile';
import { isProfileComplete } from '@/shared/profileSchema';
import { profileScore } from '@/shared/profileScore';
import { loadSettings, isConfigured, setSessionKey } from '@/shared/settings';
import { decryptKey } from '@/shared/keyCrypto';
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
import {
  Badge,
  Button,
  Card,
  cn,
  Dialog,
  IconButton,
  Input,
  Meter,
  PrivacyDialog,
  ProgressSteps,
  Select,
  Skeleton,
  Textarea,
  ThemeToggle,
  useTheme,
  useToast,
} from '@/ui';
import type { AnswerTone } from '@/ai/prompts';
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

const FILL_STEPS = ['Detect', 'Job', 'Scan', 'Fill', 'Done'];
function fillStep(status: string): number {
  switch (status) {
    case 'extracting':
      return 1;
    case 'analyzed':
    case 'generating':
      return 2;
    case 'filled':
      return 3;
    case 'done':
      return 4;
    default:
      return 0;
  }
}

export function App() {
  useTheme();
  const { toast } = useToast();
  const { status, setStatus, setError, error, reset } = usePanelStore();
  const [site, setSite] = useState<SiteMatch | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [profileComplete, setProfileComplete] = useState(false);
  const [profilePct, setProfilePct] = useState(0);
  const [profileMissing, setProfileMissing] = useState<string[]>([]);
  const [aiConfigured, setAiConfigured] = useState(false);
  const [hasResume, setHasResume] = useState(false);
  const [needsEnable, setNeedsEnable] = useState(false);

  const [jd, setJd] = useState<JobDescription | null>(null);
  const [fields, setFields] = useState<FieldDescriptor[]>([]);
  const [fills, setFills] = useState<FieldFill[]>([]);
  const [result, setResult] = useState<{ filled: string[]; failed: { fieldId: string; reason: string }[] } | null>(null);
  const [aiQuestions, setAiQuestions] = useState<AiQuestion[]>([]);
  const [selectedQ, setSelectedQ] = useState<Set<string>>(new Set());
  const [tone, setTone] = useState<AnswerTone>('balanced');
  const [regenId, setRegenId] = useState<string | null>(null);
  const [match, setMatch] = useState<{ analysis: JobAnalysis; match: MatchScore } | null>(null);
  const [coverLetter, setCoverLetter] = useState<string | null>(null);
  const [priorApp, setPriorApp] = useState<ApplicationRecord | null>(null);
  const [history, setHistory] = useState<ApplicationRecord[]>([]);

  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState<'analyze' | 'answers' | 'cover' | 'resume' | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [onOwnPage, setOnOwnPage] = useState(false);
  const [view, setView] = useState<'main' | 'profile'>('main');
  const [pendingDelete, setPendingDelete] = useState<ApplicationRecord | null>(null);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [needsUnlock, setNeedsUnlock] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const lastKeyRef = useRef<string>('');

  // Surface store errors as toasts (replaces the old inline error card).
  useEffect(() => {
    if (error) toast(error.detail, 'error');
  }, [error, toast]);

  // Clear everything tied to a specific page (run when the tab/URL changes).
  function resetPageState() {
    setJd(null);
    setFields([]);
    setFills([]);
    setResult(null);
    setMatch(null);
    setCoverLetter(null);
    setAiQuestions([]);
    setSelectedQ(new Set());
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
    const score = p ? profileScore(p) : { percent: 0, missing: [] };
    setProfilePct(score.percent);
    setProfileMissing(score.missing);
    setAiConfigured(isConfigured(await loadSettings()));
    setHasResume(!!p?.resume.text?.trim());
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
    setSelectedQ(new Set());
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
    const questions = selectAiQuestions(formMsg.fields, determ.map((f) => f.fieldId));
    setAiQuestions(questions);
    setSelectedQ(new Set(questions.map((q) => q.id))); // all preselected
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

  // Route AI errors: a LOCKED key opens the unlock prompt instead of a toast.
  function aiError(res: Extract<Msg, { kind: 'ERROR' }>) {
    if (res.code === 'LOCKED') setNeedsUnlock(true);
    else setError(res.code, res.detail);
  }

  // Decrypt the stored key with the user's passphrase and cache it for this
  // browser session (memory only). On success the user re-runs the AI action.
  async function unlockKey() {
    const settings = await loadSettings();
    if (!settings.apiKeyEnc) return;
    try {
      const key = await decryptKey(settings.apiKeyEnc, passphrase);
      await setSessionKey(key);
      setNeedsUnlock(false);
      setPassphrase('');
      toast('Unlocked for this browser session.', 'success');
    } catch {
      toast('Wrong passphrase — try again.', 'error');
    }
  }

  async function analyzeFit() {
    if (!jd) return;
    setAiBusy('analyze');
    const res = await sendToBackground({ kind: 'ANALYZE', jd });
    if (res?.kind === 'ANALYSIS_RESULT') {
      setMatch({ analysis: res.analysis, match: res.match });
      if (site) await upsertHistory(jd, site, { matchScore: res.match.score });
    } else if (res?.kind === 'ERROR') aiError(res);
    setAiBusy(null);
  }

  async function generateAiAnswers() {
    const chosen = aiQuestions.filter((q) => selectedQ.has(q.id));
    if (!jd || chosen.length === 0) return;
    setAiBusy('answers');
    setStatus('generating');
    const tabId = await activeTabId();
    const res = await sendToBackground({ kind: 'GENERATE_ANSWERS', jd, questions: chosen, tone });
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
    } else if (res?.kind === 'ERROR') aiError(res);
    setStatus('done');
    setAiBusy(null);
  }

  // Re-ask the model for a single answer, forcing a fresh call (skip reuse) and
  // honoring the current tone. Replaces just that field's fill.
  async function regenerateAnswer(fieldId: string) {
    const q = aiQuestions.find((x) => x.id === fieldId);
    if (!jd || !q) return;
    setRegenId(fieldId);
    const tabId = await activeTabId();
    const res = await sendToBackground({ kind: 'GENERATE_ANSWERS', jd, questions: [q], tone, skipReuse: true });
    if (res?.kind === 'ANSWERS_RESULT' && res.answers[0] && tabId) {
      const a = res.answers[0];
      const f = fields.find((x) => x.id === a.id);
      if (f) {
        const newFill: FieldFill = {
          fieldId: a.id,
          selector: f.selector,
          value: a.answer,
          confidence: a.confidence,
          source: 'ai',
          needsReview: true,
        };
        await sendToTab(tabId, { kind: 'FILL', tabId, map: [newFill] });
        setFills((prev) => prev.map((x) => (x.fieldId === a.id ? newFill : x)));
        setEdits((prev) => {
          const next = { ...prev };
          delete next[a.id];
          return next;
        });
      }
    } else if (res?.kind === 'ERROR') aiError(res);
    setRegenId(null);
  }

  async function makeCoverLetter() {
    if (!jd) return;
    setAiBusy('cover');
    setStatus('generating');
    const res = await sendToBackground({ kind: 'GENERATE_COVER_LETTER', jd });
    if (res?.kind === 'COVER_LETTER_RESULT') {
      setCoverLetter(res.coverLetter);
      if (site) await upsertHistory(jd, site, { coverLetter: res.coverLetter });
    } else if (res?.kind === 'ERROR') aiError(res);
    setStatus('done');
    setAiBusy(null);
  }

  async function tailorResumeForJd() {
    if (!jd) return;
    setAiBusy('resume');
    const res = await sendToBackground({ kind: 'TAILOR_RESUME', jd });
    if (res?.kind === 'RESUME_RESULT') {
      await chrome.storage.session.set({ resumeDraft: { jd, resume: res.resume } });
      await chrome.tabs.create({ url: chrome.runtime.getURL('src/resume/index.html') });
    } else if (res?.kind === 'ERROR') aiError(res);
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
    toast('Saved — ApplyPilot will reuse this next time.', 'success');
  }

  // Undo every field ApplyPilot filled on the page and drop the local fill state.
  async function clearFilled() {
    const tabId = await activeTabId();
    if (!tabId || fills.length === 0) return;
    const targets = fills.map((f) => ({ fieldId: f.fieldId, selector: f.selector }));
    await sendToTab(tabId, { kind: 'CLEAR', tabId, targets });
    setFills([]);
    setResult(null);
    setEdits({});
    toast('Cleared the fields ApplyPilot filled.', 'success');
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    await deleteApplication(pendingDelete.id);
    setHistory(await recentApplications(8));
    setPendingDelete(null);
  }

  const labelFor = (id: string) => fields.find((f) => f.id === id)?.label ?? id;
  const fillFor = (id: string) => fills.find((f) => f.fieldId === id);
  const aiFills = fills.filter((f) => f.source === 'ai' || f.source === 'reuse');

  const toggleQ = (id: string) =>
    setSelectedQ((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allQSelected = aiQuestions.length > 0 && selectedQ.size === aiQuestions.length;
  const toggleAllQ = () => setSelectedQ(allQSelected ? new Set() : new Set(aiQuestions.map((q) => q.id)));

  if (view === 'profile') {
    return (
      <div className="h-full overflow-y-auto bg-surface-muted p-4">
        <ProfileEditor onClose={() => setView('main')} onSaved={() => setView('main')} />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto bg-bg p-4 text-fg">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">ApplyPilot</h1>
          <p className="text-xs text-fg-muted">AI-assisted autofill · never auto-submits</p>
        </div>
        <div className="flex items-center gap-1">
          <IconButton label="Privacy & your data" onClick={() => setShowPrivacy(true)}>
            <ShieldCheck className="h-4 w-4 text-success" />
          </IconButton>
          <ThemeToggle />
        </div>
      </header>

      <Card
        label="Page"
        action={
          <IconButton label="Rescan" onClick={detect}>
            <RefreshCw className="h-3.5 w-3.5" />
          </IconButton>
        }
      >
        {site ? (
          <div className="flex items-center justify-between">
            <span className="font-medium capitalize">{site.site}</span>
            <span className="text-xs text-fg-muted">{Math.round(site.confidence * 100)}%</span>
          </div>
        ) : onOwnPage ? (
          <span className="text-sm text-fg-muted">ApplyPilot settings open here — switch to a job page to fill.</span>
        ) : needsEnable ? (
          <div className="flex flex-col items-start gap-1.5">
            <span className="text-sm text-fg-muted">Not a recognized ATS.</span>
            <Button variant="secondary" size="sm" onClick={enableOnPage} iconRight={<ArrowRight className="h-3.5 w-3.5" />}>
              Enable ApplyPilot here
            </Button>
          </div>
        ) : (
          <span className="text-sm text-fg-muted">{status === 'detecting' ? 'detecting…' : 'no page detected'}</span>
        )}
        {priorApp && (
          <p className="mt-1.5 text-xs text-warning">Drafted before on {new Date(priorApp.appliedAt).toLocaleDateString()}.</p>
        )}
      </Card>

      <Card
        label="Profile"
        action={
          profileComplete ? (
            <Button variant="ghost" size="sm" onClick={() => setView('profile')} iconRight={<Pencil className="h-3 w-3" />}>
              Edit
            </Button>
          ) : undefined
        }
      >
        {profileComplete ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{profileName}</span>
            <Meter percent={profilePct} />
            <span className="text-[11px] text-fg-subtle">
              {profilePct}% complete
              {profileMissing.length > 0 && ` · add ${profileMissing.slice(0, 3).join(', ').toLowerCase()}`}
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {profileName && <Meter percent={profilePct} />}
            <Button variant="secondary" size="sm" onClick={() => setView('profile')} iconRight={<ArrowRight className="h-3.5 w-3.5" />}>
              {profileName ? 'Finish profile setup' : 'Set up your profile'}
            </Button>
          </div>
        )}
      </Card>

      <div className="flex flex-col gap-2">
        <Button onClick={fillApplication} disabled={!canFill} loading={busy} className="w-full">
          {busy ? 'Filling…' : 'Fill Application'}
        </Button>
        {busy && <ProgressSteps steps={FILL_STEPS} current={fillStep(status)} />}
      </div>

      {jd && (
        <Card label="Job">
          <div className="font-medium">{jd.title || 'Untitled role'}</div>
          {jd.company && <div className="text-xs text-fg-muted">{jd.company}</div>}
          <button onClick={useSelectionAsJd} className="mt-1 text-[11px] text-fg-subtle hover:text-fg hover:underline">
            JD wrong? Select text on the page → use it
          </button>
          {!aiConfigured && (
            <Button variant="ghost" size="sm" onClick={() => setView('profile')} className="mt-2" iconRight={<ArrowRight className="h-3.5 w-3.5" />}>
              Add an API key to enable AI
            </Button>
          )}
          {aiConfigured && (
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={analyzeFit}
                disabled={aiBusy !== null}
                loading={aiBusy === 'analyze'}
                iconLeft={<Sparkles className="h-3.5 w-3.5" />}
              >
                {aiBusy === 'analyze' ? 'Analyzing…' : 'Analyze fit'}
              </Button>
              {aiQuestions.length > 0 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={generateAiAnswers}
                  disabled={aiBusy !== null || selectedQ.size === 0}
                  loading={aiBusy === 'answers'}
                  iconLeft={<Wand2 className="h-3.5 w-3.5" />}
                >
                  {aiBusy === 'answers' ? 'Writing…' : `Generate ${selectedQ.size} answer${selectedQ.size === 1 ? '' : 's'}`}
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={makeCoverLetter}
                disabled={aiBusy !== null}
                loading={aiBusy === 'cover'}
                iconLeft={<FileText className="h-3.5 w-3.5" />}
              >
                {aiBusy === 'cover' ? 'Drafting…' : 'Cover letter'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={tailorResumeForJd}
                disabled={aiBusy !== null || !hasResume}
                loading={aiBusy === 'resume'}
                iconLeft={<FileText className="h-3.5 w-3.5" />}
              >
                {aiBusy === 'resume' ? 'Tailoring…' : 'Tailor resume'}
              </Button>
            </div>
          )}
        </Card>
      )}

      {aiConfigured && aiQuestions.length > 0 && (
        <Card
          label={`Questions to answer · ${selectedQ.size}/${aiQuestions.length}`}
          action={
            <button onClick={toggleAllQ} className="text-[11px] font-medium text-info hover:underline">
              {allQSelected ? 'Clear all' : 'Select all'}
            </button>
          }
        >
          <p className="mb-2 text-[11px] text-fg-subtle">Pick which open-ended questions the AI should answer.</p>
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <span className="text-[11px] text-fg-subtle">Answer length</span>
            <div className="w-32">
              <Select value={tone} onChange={(e) => setTone(e.target.value as AnswerTone)} className="h-8 text-xs">
                <option value="concise">Concise</option>
                <option value="balanced">Balanced</option>
                <option value="detailed">Detailed</option>
              </Select>
            </div>
          </div>
          <ul className="flex flex-col gap-1.5">
            {aiQuestions.map((q) => (
              <li key={q.id}>
                <label className="flex cursor-pointer items-start gap-2 text-xs text-fg-muted">
                  <input
                    type="checkbox"
                    checked={selectedQ.has(q.id)}
                    onChange={() => toggleQ(q.id)}
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-accent"
                  />
                  <span className="leading-snug">{q.text}</span>
                </label>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {!jd && result && (
        <Card label="Job">
          <span className="text-sm text-fg-muted">Couldn&apos;t read the job description.</span>
          <Button variant="secondary" size="sm" onClick={useSelectionAsJd} className="mt-1.5" iconRight={<ArrowRight className="h-3.5 w-3.5" />}>
            Select it on the page → use as JD
          </Button>
        </Card>
      )}

      {aiBusy && (
        <Card label={aiBusy === 'analyze' ? 'Analyzing…' : aiBusy === 'answers' ? 'Writing answers…' : aiBusy === 'resume' ? 'Tailoring resume…' : 'Drafting cover letter…'}>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </Card>
      )}

      {match && <MatchCard analysis={match.analysis} match={match.match} />}

      {coverLetter && (
        <Card label="Cover letter">
          <p className="whitespace-pre-wrap text-xs text-fg-muted">{coverLetter}</p>
          <div className="mt-2 flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(coverLetter);
                toast('Cover letter copied.', 'success');
              }}
              iconLeft={<Copy className="h-3.5 w-3.5" />}
            >
              Copy
            </Button>
            {coverField && (
              <Button variant="secondary" size="sm" onClick={insertCoverLetter} iconLeft={<CornerDownLeft className="h-3.5 w-3.5" />}>
                Insert into form
              </Button>
            )}
          </div>
        </Card>
      )}

      {result && (
        <Card
          label={`Filled ${result.filled.length} field${result.filled.length === 1 ? '' : 's'}`}
          action={
            fills.length > 0 ? (
              <button
                onClick={clearFilled}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-fg-subtle hover:text-danger"
              >
                <Eraser className="h-3 w-3" /> Clear
              </button>
            ) : undefined
          }
        >
          <ul className="flex flex-col gap-1">
            {result.filled.map((id) => (
              <li key={id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{labelFor(id)}</span>
                <FillBadge fill={fillFor(id)} />
              </li>
            ))}
            {result.filled.length === 0 && <li className="text-sm text-fg-muted">No deterministic matches.</li>}
          </ul>
          {result.failed.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1 border-t border-border pt-2">
              {result.failed.map((f) => (
                <li key={f.fieldId} className="text-xs text-fg-subtle">
                  {labelFor(f.fieldId)} — {f.reason}
                </li>
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
                <div className="truncate text-xs font-medium text-fg-muted">{labelFor(f.fieldId)}</div>
                <Textarea
                  className="mt-1 text-xs"
                  rows={3}
                  value={edits[f.fieldId] ?? f.value}
                  onChange={(e) => setEdits((prev) => ({ ...prev, [f.fieldId]: e.target.value }))}
                />
                <div className="mt-1 flex items-center gap-3">
                  <button onClick={() => saveEditedAnswer(f)} className="text-[11px] font-medium text-info hover:underline">
                    Save &amp; refill
                  </button>
                  <button
                    onClick={() => regenerateAnswer(f.fieldId)}
                    disabled={regenId !== null}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-fg-subtle hover:text-fg disabled:opacity-50"
                  >
                    <RefreshCw className={cn('h-3 w-3', regenId === f.fieldId && 'animate-spin')} /> Regenerate
                  </button>
                </div>
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
                <span className="flex shrink-0 items-center gap-1.5 text-fg-subtle">
                  <span>
                    {a.matchScore ? `${a.matchScore} · ` : ''}
                    {new Date(a.appliedAt).toLocaleDateString()}
                  </span>
                  <IconButton label="Delete application" onClick={() => setPendingDelete(a)} className="h-6 w-6 hover:text-danger">
                    <Trash2 className="h-3.5 w-3.5" />
                  </IconButton>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <footer className="mt-auto flex flex-col gap-1.5 pt-1 text-[11px] text-fg-subtle">
        <span>Review highlighted fields on the page, then submit yourself.</span>
        <button
          type="button"
          onClick={() => setShowPrivacy(true)}
          className="inline-flex items-center gap-1 self-start hover:text-fg hover:underline"
        >
          <Lock className="h-3 w-3" /> {PRIVACY_SUMMARY}
        </button>
      </footer>

      <PrivacyDialog open={showPrivacy} onClose={() => setShowPrivacy(false)} />

      <Dialog
        open={needsUnlock}
        onClose={() => {
          setNeedsUnlock(false);
          setPassphrase('');
        }}
        title="Unlock your API key"
        description="Your key is encrypted. Enter your passphrase to use AI this browser session."
        confirmLabel="Unlock"
        onConfirm={unlockKey}
      >
        <Input
          type="password"
          value={passphrase}
          placeholder="Passphrase"
          autoFocus
          onChange={(e) => setPassphrase(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && unlockKey()}
          className="mt-3"
        />
      </Dialog>

      <Dialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        title="Delete this application?"
        description={pendingDelete ? `${pendingDelete.company || '—'} · ${pendingDelete.role || 'role'}` : ''}
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function MatchCard({ analysis, match }: { analysis: JobAnalysis; match: MatchScore }) {
  const variant = match.verdict === 'strong' ? 'success' : match.verdict === 'moderate' ? 'warning' : 'danger';
  return (
    <Card label="Match">
      <div className="flex items-center gap-2">
        <Badge variant={variant} className="text-sm">
          {match.score}
        </Badge>
        <span className="text-sm font-medium capitalize">{match.verdict} fit</span>
        <span className="ml-auto text-xs text-fg-subtle">{analysis.seniority}</span>
      </div>
      {match.strengths.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1 text-xs text-fg-muted">
          {match.strengths.slice(0, 4).map((s, i) => (
            <li key={i} className="flex gap-1.5">
              <Check className="mt-0.5 h-3 w-3 shrink-0 text-success" />
              <span>{s}</span>
            </li>
          ))}
        </ul>
      )}
      {match.gaps.length > 0 && (
        <ul className="mt-1.5 flex flex-col gap-1 text-xs text-fg-muted">
          {match.gaps.slice(0, 4).map((g, i) => (
            <li key={i} className="flex gap-1.5">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-warning" />
              <span>{g}</span>
            </li>
          ))}
        </ul>
      )}
      {match.recommendation && <p className="mt-2 text-xs text-fg-muted">{match.recommendation}</p>}
    </Card>
  );
}

function FillBadge({ fill }: { fill?: FieldFill }) {
  if (fill?.source === 'reuse') return <Badge variant="reuse">reused · review</Badge>;
  if (fill?.source === 'ai') return <Badge variant="ai">AI · review</Badge>;
  return fill?.needsReview ? <Badge variant="review">review</Badge> : <Badge variant="auto">auto</Badge>;
}
