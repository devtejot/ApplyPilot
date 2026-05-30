// First-run onboarding wizard. Opened in a tab by the background worker on
// install (chrome.runtime.onInstalled, reason === 'install'). Reuses the same
// profile/settings storage as the rest of the app, then sets onboardingComplete.
import { useEffect, useId, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Rocket, Sparkles, Upload } from 'lucide-react';
import type { CandidateProfile } from '@/shared/types';
import { loadProfile, saveProfile, emptyProfile } from '@/shared/profile';
import { extractPdfText } from '@/profile/pdf';
import {
  loadSettings,
  saveSettings,
  defaultSettings,
  defaultModelFor,
  type Settings,
  type Provider,
} from '@/shared/settings';
import { localeFor, COUNTRIES } from '@/shared/locale';
import { Button, Card, Field, Input, ProgressSteps, Select, useTheme, useToast } from '@/ui';

const STEPS = ['Welcome', 'Profile', 'Resume', 'AI key', 'Done'];

export function App() {
  useTheme();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<CandidateProfile>(emptyProfile);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [resumeStatus, setResumeStatus] = useState('');
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    loadProfile().then((p) => p && setProfile(p));
    loadSettings().then(setSettings);
  }, []);

  const setPersonal = (patch: Partial<CandidateProfile['personal']>) =>
    setProfile((p) => ({ ...p, personal: { ...p.personal, ...patch } }));
  const setLocation = (patch: Partial<CandidateProfile['personal']['location']>) =>
    setProfile((p) => ({ ...p, personal: { ...p.personal, location: { ...p.personal.location, ...patch } } }));
  const loc = localeFor(profile.personal.location.country);
  const countryOptions = COUNTRIES.includes(profile.personal.location.country)
    ? COUNTRIES
    : [profile.personal.location.country, ...COUNTRIES].filter(Boolean);

  async function onResume(file: File | undefined) {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setResumeStatus('PDF only for now.');
      return;
    }
    setResumeStatus('Extracting…');
    try {
      const text = await extractPdfText(file);
      setProfile((p) => ({ ...p, resume: { fileName: file.name, text, updatedAt: Date.now() } }));
      setResumeStatus(`Parsed ${text.length.toLocaleString()} chars from ${file.name}.`);
    } catch {
      setResumeStatus('Could not read that PDF. Try another file.');
    }
  }

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  // Persist as the user advances so nothing is lost if they close the tab early.
  async function advanceFromProfile() {
    await saveProfile(profile);
    next();
  }
  async function advanceFromResume() {
    await saveProfile(profile);
    next();
  }
  async function advanceFromAi() {
    await saveSettings(settings);
    next();
  }

  async function finish() {
    setFinishing(true);
    await saveProfile(profile);
    await saveSettings({ ...settings, onboardingComplete: true });
    toast('You’re all set.', 'success');
    const t = await chrome.tabs.getCurrent();
    if (t?.id !== undefined) setTimeout(() => chrome.tabs.remove(t.id!), 700);
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-5 px-6 py-12 text-fg">
      <ProgressSteps steps={STEPS} current={step} labeled />

      {step === 0 && (
        <Card className="flex flex-col items-center gap-3 p-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-accent-fg">
            <Rocket className="h-6 w-6" />
          </span>
          <h1 className="text-xl font-semibold">Welcome to ApplyPilot</h1>
          <p className="text-sm text-fg-muted">
            ApplyPilot fills job applications for you from your profile — and never auto-submits. Let&apos;s set up the
            basics. Takes about a minute.
          </p>
          <Button onClick={next} iconRight={<ArrowRight className="h-4 w-4" />} className="mt-2">
            Get started
          </Button>
        </Card>
      )}

      {step === 1 && (
        <Card label="About you" className="p-6">
          <p className="mb-4 text-sm text-fg-muted">Stored only on this device. Used to autofill applications.</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Row label="First name" placeholder="Jane" value={profile.personal.firstName} onChange={(v) => setPersonal({ firstName: v })} />
            <Row label="Last name" placeholder="Doe" value={profile.personal.lastName} onChange={(v) => setPersonal({ lastName: v })} />
            <Row label="Email" type="email" placeholder="jane.doe@example.com" value={profile.personal.email} onChange={(v) => setPersonal({ email: v })} />
            <Field label="Country">
              <Select value={profile.personal.location.country} onChange={(e) => setLocation({ country: e.target.value })}>
                {countryOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
            <Row label="Phone" type="tel" placeholder={loc.phonePlaceholder} value={profile.personal.phone} onChange={(v) => setPersonal({ phone: v })} />
            <Row label="City" placeholder="Bengaluru" value={profile.personal.location.city} onChange={(v) => setLocation({ city: v })} />
          </div>
          <StepNav onBack={back} onNext={advanceFromProfile} />
        </Card>
      )}

      {step === 2 && (
        <Card label="Resume" className="p-6">
          <p className="mb-4 text-sm text-fg-muted">
            Upload your resume PDF — its text gives the AI context for tailored answers. Optional, you can add it later.
          </p>
          <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-border bg-surface px-3.5 text-sm font-medium text-fg transition-colors hover:bg-surface-muted">
            <Upload className="h-4 w-4" />
            {profile.resume.fileName ? 'Replace PDF' : 'Choose PDF'}
            <input type="file" accept="application/pdf" className="hidden" onChange={(e) => onResume(e.target.files?.[0])} />
          </label>
          {profile.resume.fileName && <p className="mt-1.5 text-xs text-fg-muted">Current: {profile.resume.fileName}</p>}
          {resumeStatus && <p className="mt-1 text-xs text-fg-muted">{resumeStatus}</p>}
          <StepNav onBack={back} onNext={advanceFromResume} nextLabel={profile.resume.fileName ? 'Continue' : 'Skip for now'} />
        </Card>
      )}

      {step === 3 && (
        <Card label="AI key (optional)" className="p-6">
          <p className="mb-4 text-sm text-fg-muted">
            Bring your own API key to unlock AI answers, fit analysis, and cover letters. Autofill works without one — you
            can skip this.
          </p>
          <div className="flex flex-col gap-3">
            <Field label="Provider">
              <Select
                value={settings.provider}
                onChange={(e) => {
                  const provider = e.target.value as Provider;
                  setSettings((s) => ({ ...s, provider, model: defaultModelFor(provider) }));
                }}
              >
                <option value="gemini">Google Gemini (free tier)</option>
                <option value="claude">Anthropic Claude (paid)</option>
              </Select>
            </Field>
            <Row
              label={settings.provider === 'gemini' ? 'Google AI API key' : 'Anthropic API key'}
              type="password"
              value={settings.apiKey}
              placeholder={settings.provider === 'gemini' ? 'AIza…' : 'sk-ant-…'}
              onChange={(v) => setSettings((s) => ({ ...s, apiKey: v }))}
            />
            <a
              className="-mt-1 text-xs font-medium text-info hover:underline"
              href={settings.provider === 'gemini' ? 'https://aistudio.google.com/apikey' : 'https://console.anthropic.com/settings/keys'}
              target="_blank"
              rel="noreferrer"
            >
              {settings.provider === 'gemini' ? 'Get a free key →' : 'Get a key →'}
            </a>
          </div>
          <StepNav onBack={back} onNext={advanceFromAi} nextLabel={settings.apiKey.trim() ? 'Continue' : 'Skip for now'} />
        </Card>
      )}

      {step === 4 && (
        <Card className="flex flex-col items-center gap-3 p-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/15 text-success">
            <Check className="h-6 w-6" />
          </span>
          <h1 className="text-xl font-semibold">You&apos;re all set</h1>
          <p className="text-sm text-fg-muted">
            Open a job posting on Greenhouse, Lever, or Ashby, then click the ApplyPilot icon (or press
            <span className="mx-1 rounded border border-border bg-surface-muted px-1.5 py-0.5 text-xs">Ctrl/Cmd+Shift+Y</span>)
            to open the side panel and fill it.
          </p>
          <Button onClick={finish} loading={finishing} iconLeft={<Sparkles className="h-4 w-4" />} className="mt-2">
            Finish setup
          </Button>
        </Card>
      )}
    </div>
  );
}

function StepNav({
  onBack,
  onNext,
  nextLabel = 'Continue',
}: {
  onBack: () => void;
  onNext: () => void;
  nextLabel?: string;
}) {
  return (
    <div className="mt-5 flex items-center justify-between">
      <Button variant="ghost" size="sm" onClick={onBack} iconLeft={<ArrowLeft className="h-3.5 w-3.5" />}>
        Back
      </Button>
      <Button onClick={onNext} iconRight={<ArrowRight className="h-4 w-4" />}>
        {nextLabel}
      </Button>
    </div>
  );
}

function Row({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id}>
      <Input id={id} type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}
