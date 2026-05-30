import { useEffect, useState, type ReactNode } from 'react';
import type { CandidateProfile, WorkItem } from '@/shared/types';
import { loadProfile, saveProfile, emptyProfile } from '@/shared/profile';
import { profileSchema, isProfileComplete } from '@/shared/profileSchema';
import { extractPdfText } from '@/profile/pdf';
import { loadSettings, saveSettings, defaultSettings, modelsFor, defaultModelFor, type Settings, type Provider } from '@/shared/settings';

export function App() {
  const [profile, setProfile] = useState<CandidateProfile>(emptyProfile);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState('');
  const [resumeStatus, setResumeStatus] = useState('');
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [settingsStatus, setSettingsStatus] = useState('');

  useEffect(() => {
    loadProfile().then((p) => {
      if (p) setProfile(p);
      setLoaded(true);
    });
    loadSettings().then(setSettings);
  }, []);

  function saveAiSettings() {
    saveSettings(settings).then(() => setSettingsStatus('Saved.'));
  }

  // Targeted nested updaters keep render logic readable.
  const setPersonal = (patch: Partial<CandidateProfile['personal']>) =>
    setProfile((p) => ({ ...p, personal: { ...p.personal, ...patch } }));
  const setLinks = (patch: Partial<CandidateProfile['personal']['links']>) =>
    setProfile((p) => ({ ...p, personal: { ...p.personal, links: { ...p.personal.links, ...patch } } }));
  const setLocation = (patch: Partial<CandidateProfile['personal']['location']>) =>
    setProfile((p) => ({ ...p, personal: { ...p.personal, location: { ...p.personal.location, ...patch } } }));
  const setEligibility = (patch: Partial<CandidateProfile['eligibility']>) =>
    setProfile((p) => ({ ...p, eligibility: { ...p.eligibility, ...patch } }));

  async function onResume(file: File | undefined) {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setResumeStatus('PDF only for now (.doc/.docx coming later).');
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

  function save() {
    const parsed = profileSchema.safeParse(profile);
    if (!parsed.success) {
      setStatus(`Could not save: ${parsed.error.issues[0]?.message ?? 'invalid data'}`);
      return;
    }
    saveProfile(profile).then(() => {
      setStatus(
        isProfileComplete(profile)
          ? 'Saved. Profile is complete and ready to fill.'
          : 'Saved. Add first name, last name, and a valid email to complete it.',
      );
    });
  }

  if (!loaded) return <div className="p-8 text-neutral-500">Loading…</div>;

  const complete = isProfileComplete(profile);

  return (
    <div className="mx-auto max-w-2xl px-6 py-10 text-neutral-900">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">ApplyPilot — Profile</h1>
        <p className="text-sm text-neutral-500">
          Stored only on this device (chrome.storage.local). Used to autofill applications.
        </p>
        <span
          className={`mt-2 inline-block rounded px-2 py-0.5 text-xs font-medium ${
            complete ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
          }`}
        >
          {complete ? 'Complete' : 'Incomplete'}
        </span>
      </header>

      <Section title="Personal">
        <Grid>
          <Field label="First name" value={profile.personal.firstName} onChange={(v) => setPersonal({ firstName: v })} />
          <Field label="Last name" value={profile.personal.lastName} onChange={(v) => setPersonal({ lastName: v })} />
          <Field label="Email" type="email" value={profile.personal.email} onChange={(v) => setPersonal({ email: v })} />
          <Field label="Phone" type="tel" value={profile.personal.phone} onChange={(v) => setPersonal({ phone: v })} />
          <Field label="City" value={profile.personal.location.city} onChange={(v) => setLocation({ city: v })} />
          <Field label="State" value={profile.personal.location.state} onChange={(v) => setLocation({ state: v })} />
          <Field label="Country" value={profile.personal.location.country} onChange={(v) => setLocation({ country: v })} />
          <Field label="Postal code" value={profile.personal.location.postalCode ?? ''} onChange={(v) => setLocation({ postalCode: v })} />
        </Grid>
      </Section>

      <Section title="Links">
        <Grid>
          <Field label="LinkedIn" value={profile.personal.links.linkedin ?? ''} onChange={(v) => setLinks({ linkedin: v })} />
          <Field label="GitHub" value={profile.personal.links.github ?? ''} onChange={(v) => setLinks({ github: v })} />
          <Field label="Portfolio" value={profile.personal.links.portfolio ?? ''} onChange={(v) => setLinks({ portfolio: v })} />
        </Grid>
      </Section>

      <Section title="Eligibility">
        <div className="flex flex-col gap-2">
          <Check label="Authorized to work" checked={profile.eligibility.workAuthorized} onChange={(v) => setEligibility({ workAuthorized: v })} />
          <Check label="Requires visa sponsorship" checked={profile.eligibility.requiresSponsorship} onChange={(v) => setEligibility({ requiresSponsorship: v })} />
          <Check label="Willing to relocate" checked={profile.eligibility.willingToRelocate} onChange={(v) => setEligibility({ willingToRelocate: v })} />
        </div>
        <div className="mt-3">
          <Field label="Desired salary" value={profile.eligibility.desiredSalary ?? ''} onChange={(v) => setEligibility({ desiredSalary: v })} />
        </div>
      </Section>

      <Section title="Resume">
        <input type="file" accept="application/pdf" onChange={(e) => onResume(e.target.files?.[0])} className="text-sm" />
        {profile.resume.fileName && (
          <p className="mt-1 text-xs text-neutral-500">Current: {profile.resume.fileName}</p>
        )}
        {resumeStatus && <p className="mt-1 text-xs text-neutral-600">{resumeStatus}</p>}
      </Section>

      <Section title="Summary">
        <textarea
          className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          rows={3}
          value={profile.summary ?? ''}
          placeholder="2–3 line elevator pitch — used as AI context."
          onChange={(e) => setProfile((p) => ({ ...p, summary: e.target.value }))}
        />
      </Section>

      <Section title="Skills">
        <Field
          label="Comma-separated"
          value={profile.skills.join(', ')}
          onChange={(v) => setProfile((p) => ({ ...p, skills: splitList(v) }))}
        />
      </Section>

      <Section title="Work history">
        <WorkHistory items={profile.workHistory} onChange={(workHistory) => setProfile((p) => ({ ...p, workHistory }))} />
      </Section>

      <Section title="AI provider">
        <p className="mb-3 text-xs text-neutral-500">
          Bring your own API key — stored only on this device, sent only to the provider you pick.
          AI features (match score, generated answers) are optional; autofill works without a key.
        </p>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-neutral-600">Provider</span>
            <select
              className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
              value={settings.provider}
              onChange={(e) => {
                const provider = e.target.value as Provider;
                setSettings((s) => ({ ...s, provider, model: defaultModelFor(provider) }));
              }}
            >
              <option value="gemini">Google Gemini (free tier)</option>
              <option value="claude">Anthropic Claude (paid)</option>
            </select>
          </label>

          <Field
            label={settings.provider === 'gemini' ? 'Google AI API key' : 'Anthropic API key'}
            type="password"
            value={settings.apiKey}
            placeholder={settings.provider === 'gemini' ? 'AIza…' : 'sk-ant-…'}
            onChange={(v) => setSettings((s) => ({ ...s, apiKey: v }))}
          />
          <a
            className="-mt-1 text-xs font-medium text-blue-600 hover:underline"
            href={settings.provider === 'gemini' ? 'https://aistudio.google.com/apikey' : 'https://console.anthropic.com/settings/keys'}
            target="_blank"
            rel="noreferrer"
          >
            {settings.provider === 'gemini'
              ? 'Get a free key at aistudio.google.com/apikey (no billing) →'
              : 'Get a key at console.anthropic.com (requires billing) →'}
          </a>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-neutral-600">Model</span>
            <select
              className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
              value={settings.model}
              onChange={(e) => setSettings((s) => ({ ...s, model: e.target.value }))}
            >
              {modelsFor(settings.provider).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-center gap-3">
            <button onClick={saveAiSettings} className="self-start rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700">
              Save AI settings
            </button>
            {settingsStatus && <span className="text-sm text-neutral-600">{settingsStatus}</span>}
          </div>
        </div>
      </Section>

      <div className="sticky bottom-0 mt-6 flex items-center gap-3 border-t border-neutral-200 bg-neutral-100 py-3">
        <button onClick={save} className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700">
          Save profile
        </button>
        {status && <span className="text-sm text-neutral-600">{status}</span>}
      </div>
    </div>
  );
}

function splitList(v: string): string[] {
  return v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function WorkHistory({ items, onChange }: { items: WorkItem[]; onChange: (items: WorkItem[]) => void }) {
  const update = (i: number, patch: Partial<WorkItem>) =>
    onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const add = () =>
    onChange([...items, { company: '', title: '', startDate: '', endDate: '', bullets: [] }]);
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));

  return (
    <div className="flex flex-col gap-4">
      {items.map((it, i) => (
        <div key={i} className="rounded border border-neutral-200 bg-neutral-50 p-3">
          <Grid>
            <Field label="Company" value={it.company} onChange={(v) => update(i, { company: v })} />
            <Field label="Title" value={it.title} onChange={(v) => update(i, { title: v })} />
            <Field label="Start" value={it.startDate} onChange={(v) => update(i, { startDate: v })} placeholder="2021-03" />
            <Field label="End" value={it.endDate} onChange={(v) => update(i, { endDate: v })} placeholder="present" />
          </Grid>
          <label className="mt-2 flex flex-col gap-1">
            <span className="text-xs font-medium text-neutral-600">Achievements (one per line)</span>
            <textarea
              className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
              rows={2}
              value={it.bullets.join('\n')}
              onChange={(e) => update(i, { bullets: e.target.value.split('\n').filter(Boolean) })}
            />
          </label>
          <button onClick={() => remove(i)} className="mt-2 text-xs text-red-600 hover:underline">
            Remove
          </button>
        </div>
      ))}
      <button onClick={add} className="self-start text-sm font-medium text-blue-600 hover:underline">
        + Add role
      </button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-5 rounded-lg border border-neutral-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">{title}</h2>
      {children}
    </section>
  );
}

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

function Field({
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
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-neutral-600">{label}</span>
      <input
        className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
