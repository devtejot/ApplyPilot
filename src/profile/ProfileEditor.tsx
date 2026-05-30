// Shared profile + AI-settings editor. Used full-width by the options page and
// as a "Profile" view inside the side panel. Self-contained: loads, edits, saves.
// Grid is responsive so it lays out single-column in the narrow side panel.
import { useEffect, useState, type ReactNode } from 'react';
import type { CandidateProfile, WorkItem, EducationItem, ProjectItem, CertItem } from '@/shared/types';
import { loadProfile, saveProfile, emptyProfile } from '@/shared/profile';
import { profileSchema, isProfileComplete } from '@/shared/profileSchema';
import { extractPdfText } from '@/profile/pdf';
import { loadSettings, saveSettings, defaultSettings, modelsFor, defaultModelFor, type Settings, type Provider } from '@/shared/settings';
import { exportBackup, importBackup, clearAllData } from '@/shared/dataAdmin';

export function ProfileEditor({ onSaved, onClose }: { onSaved?: () => void; onClose?: () => void }) {
  const [profile, setProfile] = useState<CandidateProfile>(emptyProfile);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState('');
  const [resumeStatus, setResumeStatus] = useState('');
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [settingsStatus, setSettingsStatus] = useState('');
  const [dataStatus, setDataStatus] = useState('');

  useEffect(() => {
    loadProfile().then((p) => {
      if (p) setProfile(p);
      setLoaded(true);
    });
    loadSettings().then(setSettings);
  }, []);

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
      onSaved?.();
    });
  }

  function saveAiSettings() {
    saveSettings(settings).then(() => {
      setSettingsStatus('Saved.');
      onSaved?.();
    });
  }

  async function downloadBackup() {
    const url = URL.createObjectURL(new Blob([await exportBackup()], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'applypilot-backup.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onImport(file: File | undefined) {
    if (!file) return;
    const res = await importBackup(await file.text());
    if (res.ok) {
      const p = await loadProfile();
      if (p) setProfile(p);
      setDataStatus('Backup imported.');
    } else {
      setDataStatus(res.error);
    }
  }

  async function onClear() {
    if (!window.confirm('Delete your profile, API key, history, and saved answers from this device? This cannot be undone.')) return;
    await clearAllData();
    setProfile(emptyProfile());
    setSettings(defaultSettings());
    setDataStatus('All local data cleared.');
  }

  if (!loaded) return <div className="p-6 text-sm text-neutral-500">Loading…</div>;

  const complete = isProfileComplete(profile);

  return (
    <div className="text-neutral-900">
      <header className="mb-4">
        {onClose && (
          <button onClick={onClose} className="mb-2 text-sm font-medium text-blue-600 hover:underline">
            ← Back
          </button>
        )}
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Profile</h1>
          <span
            className={`rounded px-2 py-0.5 text-xs font-medium ${
              complete ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
            }`}
          >
            {complete ? 'Complete' : 'Incomplete'}
          </span>
        </div>
        <p className="mt-1 text-xs text-neutral-500">Stored only on this device. Used to autofill applications.</p>
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
        {profile.resume.fileName && <p className="mt-1 text-xs text-neutral-500">Current: {profile.resume.fileName}</p>}
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
        <Field label="Comma-separated" value={profile.skills.join(', ')} onChange={(v) => setProfile((p) => ({ ...p, skills: splitList(v) }))} />
      </Section>

      <Section title="Work history">
        <WorkHistory items={profile.workHistory} onChange={(workHistory) => setProfile((p) => ({ ...p, workHistory }))} />
      </Section>

      <Section title="Education">
        <EducationList items={profile.education} onChange={(education) => setProfile((p) => ({ ...p, education }))} />
      </Section>

      <Section title="Projects">
        <ProjectList items={profile.projects} onChange={(projects) => setProfile((p) => ({ ...p, projects }))} />
      </Section>

      <Section title="Certifications">
        <CertList items={profile.certifications} onChange={(certifications) => setProfile((p) => ({ ...p, certifications }))} />
      </Section>

      <Section title="AI provider">
        <p className="mb-3 text-xs text-neutral-500">
          Bring your own API key — stored only on this device, sent only to the provider you pick. AI features are optional;
          autofill works without a key.
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
              ? 'Get a free key at aistudio.google.com/apikey →'
              : 'Get a key at console.anthropic.com →'}
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

      <Section title="Data">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={downloadBackup} className="rounded bg-neutral-100 px-2 py-1 text-xs font-medium hover:bg-neutral-200">
              Export backup
            </button>
            <label className="cursor-pointer rounded bg-neutral-100 px-2 py-1 text-xs font-medium hover:bg-neutral-200">
              Import backup
              <input type="file" accept="application/json" className="hidden" onChange={(e) => onImport(e.target.files?.[0])} />
            </label>
            <button onClick={onClear} className="rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100">
              Clear all data
            </button>
          </div>
          {dataStatus && <span className="text-xs text-neutral-600">{dataStatus}</span>}
          <p className="text-[11px] text-neutral-400">
            Backup includes your profile + saved answers (never your API key). Clear removes everything stored on this device.
          </p>
        </div>
      </Section>

      <div className="sticky bottom-0 mt-4 flex items-center gap-3 border-t border-neutral-200 bg-neutral-50 py-3">
        <button onClick={save} className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700">
          Save profile
        </button>
        {status && <span className="text-xs text-neutral-600">{status}</span>}
      </div>
    </div>
  );
}

function splitList(v: string): string[] {
  return v.split(',').map((s) => s.trim()).filter(Boolean);
}

function WorkHistory({ items, onChange }: { items: WorkItem[]; onChange: (items: WorkItem[]) => void }) {
  const update = (i: number, patch: Partial<WorkItem>) => onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  return (
    <ListEditor
      items={items}
      onChange={onChange}
      empty={{ company: '', title: '', startDate: '', endDate: '', bullets: [] }}
      addLabel="+ Add role"
      render={(it, i) => (
        <>
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
        </>
      )}
    />
  );
}

function EducationList({ items, onChange }: { items: EducationItem[]; onChange: (i: EducationItem[]) => void }) {
  const update = (i: number, patch: Partial<EducationItem>) => onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  return (
    <ListEditor
      items={items}
      onChange={onChange}
      empty={{ school: '', degree: '', field: '' }}
      addLabel="+ Add education"
      render={(it, i) => (
        <Grid>
          <Field label="School" value={it.school} onChange={(v) => update(i, { school: v })} />
          <Field label="Degree" value={it.degree} onChange={(v) => update(i, { degree: v })} />
          <Field label="Field" value={it.field} onChange={(v) => update(i, { field: v })} />
          <Field label="End year" value={it.endDate ?? ''} onChange={(v) => update(i, { endDate: v })} placeholder="2018" />
        </Grid>
      )}
    />
  );
}

function ProjectList({ items, onChange }: { items: ProjectItem[]; onChange: (i: ProjectItem[]) => void }) {
  const update = (i: number, patch: Partial<ProjectItem>) => onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  return (
    <ListEditor
      items={items}
      onChange={onChange}
      empty={{ name: '', description: '' }}
      addLabel="+ Add project"
      render={(it, i) => (
        <>
          <Grid>
            <Field label="Name" value={it.name} onChange={(v) => update(i, { name: v })} />
            <Field label="URL" value={it.url ?? ''} onChange={(v) => update(i, { url: v })} />
          </Grid>
          <label className="mt-2 flex flex-col gap-1">
            <span className="text-xs font-medium text-neutral-600">Description</span>
            <textarea
              className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
              rows={2}
              value={it.description}
              onChange={(e) => update(i, { description: e.target.value })}
            />
          </label>
        </>
      )}
    />
  );
}

function CertList({ items, onChange }: { items: CertItem[]; onChange: (i: CertItem[]) => void }) {
  const update = (i: number, patch: Partial<CertItem>) => onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  return (
    <ListEditor
      items={items}
      onChange={onChange}
      empty={{ name: '', issuer: '' }}
      addLabel="+ Add certification"
      render={(it, i) => (
        <Grid>
          <Field label="Name" value={it.name} onChange={(v) => update(i, { name: v })} />
          <Field label="Issuer" value={it.issuer} onChange={(v) => update(i, { issuer: v })} />
          <Field label="Date" value={it.date ?? ''} onChange={(v) => update(i, { date: v })} placeholder="2023" />
        </Grid>
      )}
    />
  );
}

function ListEditor<T>({
  items,
  onChange,
  empty,
  addLabel,
  render,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  empty: T;
  addLabel: string;
  render: (item: T, index: number) => ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      {items.map((it, i) => (
        <div key={i} className="rounded border border-neutral-200 bg-neutral-50 p-3">
          {render(it, i)}
          <button onClick={() => onChange(items.filter((_, idx) => idx !== i))} className="mt-2 text-xs text-red-600 hover:underline">
            Remove
          </button>
        </div>
      ))}
      <button onClick={() => onChange([...items, { ...empty }])} className="self-start text-sm font-medium text-blue-600 hover:underline">
        {addLabel}
      </button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-4 rounded-lg border border-neutral-200 bg-white p-3">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">{title}</h2>
      {children}
    </section>
  );
}

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>;
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
