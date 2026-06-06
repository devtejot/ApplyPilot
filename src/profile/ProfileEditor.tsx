// Shared profile + AI-settings editor. Used full-width by the options page and
// as a "Profile" view inside the side panel. Self-contained: loads, edits, saves.
// Grid is responsive so it lays out single-column in the narrow side panel.
import { useEffect, useId, useState, type ReactNode } from 'react';
import { ArrowLeft, Download, Trash2, Upload } from 'lucide-react';
import type { CandidateProfile, WorkItem, EducationItem, ProjectItem, CertItem } from '@/shared/types';
import { loadProfile, saveProfile, emptyProfile } from '@/shared/profile';
import { profileSchema, isProfileComplete } from '@/shared/profileSchema';
import { profileScore } from '@/shared/profileScore';
import { extractPdfText } from '@/profile/pdf';
import {
  loadSettings,
  saveSettings,
  defaultSettings,
  modelsFor,
  defaultModelFor,
  setSessionKey,
  clearSessionKey,
  type Settings,
  type Provider,
} from '@/shared/settings';
import { encryptKey } from '@/shared/keyCrypto';
import { exportBackup, importBackup, clearAllData } from '@/shared/dataAdmin';
import { localeFor, COUNTRIES } from '@/shared/locale';
import {
  Badge,
  Button,
  Card,
  Dialog,
  Field as FieldWrap,
  Input,
  Meter,
  PrivacyBadge,
  PrivacyDialog,
  Select,
  Switch,
  Textarea,
  ThemeToggle,
  useToast,
} from '@/ui';

export function ProfileEditor({ onSaved, onClose }: { onSaved?: () => void; onClose?: () => void }) {
  const { toast } = useToast();
  const [profile, setProfile] = useState<CandidateProfile>(emptyProfile);
  const [loaded, setLoaded] = useState(false);
  const [resumeStatus, setResumeStatus] = useState('');
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [confirmClear, setConfirmClear] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [passphrase, setPassphrase] = useState('');

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
  const setDemographics = (patch: Partial<NonNullable<CandidateProfile['demographics']>>) =>
    setProfile((p) => ({ ...p, demographics: { ...p.demographics, ...patch } }));

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
      toast(`Could not save: ${parsed.error.issues[0]?.message ?? 'invalid data'}`, 'error');
      return;
    }
    const complete = isProfileComplete(profile);
    saveProfile(profile).then(() => {
      toast(
        complete ? 'Profile saved — ready to fill.' : 'Saved. Add first name, last name, and a valid email to complete it.',
        complete ? 'success' : 'info',
      );
      onSaved?.();
    });
  }

  async function saveAiSettings() {
    let toSave: Settings = { ...settings };
    if (settings.keyEncrypted) {
      const plaintext = settings.apiKey.trim();
      if (plaintext) {
        if (!passphrase.trim()) {
          toast('Enter a passphrase to encrypt your key.', 'error');
          return;
        }
        toSave = { ...toSave, apiKeyEnc: await encryptKey(plaintext, passphrase), apiKey: '' };
        await setSessionKey(plaintext); // usable immediately this session
      } else if (!settings.apiKeyEnc) {
        toast('Enter your API key, then a passphrase to encrypt it.', 'error');
        return;
      }
      // else: no new key typed — keep the existing ciphertext as-is
    } else {
      // Plaintext mode — drop any stale ciphertext + unlocked session copy.
      toSave = { ...toSave, apiKeyEnc: undefined };
      await clearSessionKey();
    }
    await saveSettings(toSave);
    setSettings(toSave);
    setPassphrase('');
    toast('AI settings saved.', 'success');
    onSaved?.();
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
      toast('Backup imported.', 'success');
    } else {
      toast(res.error, 'error');
    }
  }

  async function doClear() {
    await clearAllData();
    setProfile(emptyProfile());
    setSettings(defaultSettings());
    setConfirmClear(false);
    toast('All local data cleared.', 'success');
  }

  if (!loaded) return <div className="p-6 text-sm text-fg-muted">Loading…</div>;

  const complete = isProfileComplete(profile);
  const score = profileScore(profile);
  const loc = localeFor(profile.personal.location.country);
  const countryOptions = COUNTRIES.includes(profile.personal.location.country)
    ? COUNTRIES
    : [profile.personal.location.country, ...COUNTRIES].filter(Boolean);
  const salaryPlaceholder = `e.g. ${loc.currency}${loc.salaryTerm === 'CTC' ? '18,00,000' : '120,000'}`;

  return (
    <div className="text-fg">
      <header className="mb-4">
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose} iconLeft={<ArrowLeft className="h-3.5 w-3.5" />} className="-ml-2 mb-2">
            Back
          </Button>
        )}
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Profile</h1>
          <Badge variant={complete ? 'success' : 'warning'}>{complete ? 'Complete' : 'Incomplete'}</Badge>
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <PrivacyBadge onClick={() => setShowPrivacy(true)} />
          <span className="text-xs text-fg-muted">Used to autofill applications.</span>
        </div>
        <div className="mt-2.5 flex items-center gap-2">
          <Meter percent={score.percent} className="max-w-[180px]" />
          <span className="shrink-0 text-[11px] text-fg-subtle">
            {score.percent}% complete
            {score.missing.length > 0 && ` · add ${score.missing.slice(0, 3).join(', ').toLowerCase()}`}
          </span>
        </div>
      </header>
      <PrivacyDialog open={showPrivacy} onClose={() => setShowPrivacy(false)} keyEncrypted={settings.keyEncrypted} />

      <Section title="Personal">
        <Grid>
          <Field label="First name" placeholder="Jane" value={profile.personal.firstName} onChange={(v) => setPersonal({ firstName: v })} />
          <Field label="Last name" placeholder="Doe" value={profile.personal.lastName} onChange={(v) => setPersonal({ lastName: v })} />
          <Field label="Middle name" placeholder="Kumar" value={profile.personal.middleName ?? ''} onChange={(v) => setPersonal({ middleName: v })} />
          <Field label="Preferred name" placeholder="Jane" value={profile.personal.preferredName ?? ''} onChange={(v) => setPersonal({ preferredName: v })} />
          <Field label="Email" type="email" placeholder="jane.doe@example.com" value={profile.personal.email} onChange={(v) => setPersonal({ email: v })} />
          <Field label="Phone" type="tel" placeholder={loc.phonePlaceholder} value={profile.personal.phone} onChange={(v) => setPersonal({ phone: v })} />
          <Field label="Pronouns" placeholder="she/her" value={profile.personal.pronouns ?? ''} onChange={(v) => setPersonal({ pronouns: v })} />
          <Field label="Date of birth" placeholder="1995-04-12" value={profile.personal.dateOfBirth ?? ''} onChange={(v) => setPersonal({ dateOfBirth: v })} />
        </Grid>
        <div className="mt-3">
          <Field label="Address" placeholder="12 MG Road" value={profile.personal.location.line1 ?? ''} onChange={(v) => setLocation({ line1: v })} />
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="City" placeholder="Bengaluru" value={profile.personal.location.city} onChange={(v) => setLocation({ city: v })} />
          {loc.states ? (
            <FieldWrap label="State">
              <Select value={profile.personal.location.state} onChange={(e) => setLocation({ state: e.target.value })}>
                <option value="">Select…</option>
                {loc.states.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </FieldWrap>
          ) : (
            <Field label="State / Province" placeholder="State" value={profile.personal.location.state} onChange={(v) => setLocation({ state: v })} />
          )}
          <FieldWrap label="Country">
            <Select value={profile.personal.location.country} onChange={(e) => setLocation({ country: e.target.value })}>
              {countryOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </FieldWrap>
          <Field label="Postal code" placeholder="560001" value={profile.personal.location.postalCode ?? ''} onChange={(v) => setLocation({ postalCode: v })} />
        </div>
      </Section>

      <Section title="Links">
        <Grid>
          <Field label="LinkedIn" placeholder="https://linkedin.com/in/janedoe" value={profile.personal.links.linkedin ?? ''} onChange={(v) => setLinks({ linkedin: v })} />
          <Field label="GitHub" placeholder="https://github.com/janedoe" value={profile.personal.links.github ?? ''} onChange={(v) => setLinks({ github: v })} />
          <Field label="Portfolio" placeholder="https://janedoe.dev" value={profile.personal.links.portfolio ?? ''} onChange={(v) => setLinks({ portfolio: v })} />
          <Field label="Twitter / X" placeholder="https://x.com/janedoe" value={profile.personal.links.twitter ?? ''} onChange={(v) => setLinks({ twitter: v })} />
        </Grid>
      </Section>

      <Section title="Work eligibility">
        <div className="flex flex-col gap-2.5">
          <Check
            label={`Authorized to work in ${loc.country}`}
            checked={profile.eligibility.workAuthorized}
            onChange={(v) => setEligibility({ workAuthorized: v })}
          />
          <Check label="Requires visa sponsorship" checked={profile.eligibility.requiresSponsorship} onChange={(v) => setEligibility({ requiresSponsorship: v })} />
          <Check label="Willing to relocate" checked={profile.eligibility.willingToRelocate} onChange={(v) => setEligibility({ willingToRelocate: v })} />
          <Check label="Open to remote only" checked={profile.eligibility.remoteOnly ?? false} onChange={(v) => setEligibility({ remoteOnly: v })} />
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Citizenship / nationality" placeholder="Indian" value={profile.eligibility.citizenship ?? ''} onChange={(v) => setEligibility({ citizenship: v })} />
          <Field label="Work authorization country" placeholder={loc.country} value={profile.eligibility.workAuthCountry ?? ''} onChange={(v) => setEligibility({ workAuthCountry: v })} />
        </div>
      </Section>

      <Section title="Compensation">
        <Grid>
          <Field label={`Current ${loc.salaryTerm}`} placeholder={salaryPlaceholder} value={profile.eligibility.currentSalary ?? ''} onChange={(v) => setEligibility({ currentSalary: v })} />
          <Field label={`Expected ${loc.salaryTerm}`} placeholder={salaryPlaceholder} value={profile.eligibility.expectedSalary ?? ''} onChange={(v) => setEligibility({ expectedSalary: v })} />
          <Field label="Notice period" placeholder="30 days" value={profile.eligibility.noticePeriod ?? ''} onChange={(v) => setEligibility({ noticePeriod: v })} />
        </Grid>
      </Section>

      <Section title="Availability">
        <Grid>
          <Field label="Available start date" placeholder="2026-07-01" value={profile.eligibility.availableStartDate ?? ''} onChange={(v) => setEligibility({ availableStartDate: v })} />
          <Field label="Years of experience" placeholder="7" value={profile.eligibility.yearsExperience ?? ''} onChange={(v) => setEligibility({ yearsExperience: v })} />
        </Grid>
      </Section>

      <Section title="Resume">
        <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-border bg-surface px-3.5 text-sm font-medium text-fg transition-colors hover:bg-surface-muted">
          <Upload className="h-4 w-4" />
          {profile.resume.fileName ? 'Replace PDF' : 'Choose PDF'}
          <input type="file" accept="application/pdf" className="hidden" onChange={(e) => onResume(e.target.files?.[0])} />
        </label>
        {profile.resume.fileName && <p className="mt-1.5 text-xs text-fg-muted">Current: {profile.resume.fileName}</p>}
        {resumeStatus && <p className="mt-1 text-xs text-fg-muted">{resumeStatus}</p>}
      </Section>

      <Section title="Summary">
        <Textarea
          rows={3}
          value={profile.summary ?? ''}
          placeholder="2–3 line elevator pitch — used as AI context."
          onChange={(e) => setProfile((p) => ({ ...p, summary: e.target.value }))}
        />
      </Section>

      <Section title="Skills">
        <Field label="Comma-separated" placeholder="React, TypeScript, Node.js" value={profile.skills.join(', ')} onChange={(v) => setProfile((p) => ({ ...p, skills: splitList(v) }))} />
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

      <Section title="Additional">
        <div className="flex flex-col gap-3">
          <Field
            label="Languages (comma-separated)"
            placeholder="English, Hindi"
            value={(profile.personal.languages ?? []).join(', ')}
            onChange={(v) => setProfile((p) => ({ ...p, personal: { ...p.personal, languages: splitList(v) } }))}
          />
          <Field
            label="How did you hear about us"
            placeholder="Referral, LinkedIn, Naukri…"
            value={profile.howHeard ?? ''}
            onChange={(v) => setProfile((p) => ({ ...p, howHeard: v }))}
          />
        </div>
      </Section>

      <Section title="Self-identification (optional)">
        <p className="mb-3 text-xs text-fg-muted">
          Optional. Left blank, ApplyPilot selects “Prefer not to say” / “Decline to self-identify” on these fields — and
          always flags them for your review. Never invented.
        </p>
        <Grid>
          <Field label="Gender" placeholder="e.g. Female" value={profile.demographics?.gender ?? ''} onChange={(v) => setDemographics({ gender: v })} />
          <Field label="Race / ethnicity" placeholder="e.g. Asian" value={profile.demographics?.raceEthnicity ?? ''} onChange={(v) => setDemographics({ raceEthnicity: v })} />
          <Field label="Veteran status" placeholder="e.g. Not a veteran" value={profile.demographics?.veteranStatus ?? ''} onChange={(v) => setDemographics({ veteranStatus: v })} />
          <Field label="Disability status" placeholder="e.g. No" value={profile.demographics?.disabilityStatus ?? ''} onChange={(v) => setDemographics({ disabilityStatus: v })} />
        </Grid>
      </Section>

      <Section title="AI provider">
        <p className="mb-3 text-xs text-fg-muted">
          Bring your own API key — stored only on this device, sent only to the provider you pick. AI features are optional;
          autofill works without a key.
        </p>
        <div className="flex flex-col gap-3">
          <FieldWrap label="Provider">
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
          </FieldWrap>

          <Field
            label={settings.provider === 'gemini' ? 'Google AI API key' : 'Anthropic API key'}
            type="password"
            value={settings.apiKey}
            placeholder={
              settings.keyEncrypted && settings.apiKeyEnc && !settings.apiKey
                ? '•••••• encrypted — type to replace'
                : settings.provider === 'gemini'
                  ? 'AIza…'
                  : 'sk-ant-…'
            }
            onChange={(v) => setSettings((s) => ({ ...s, apiKey: v }))}
          />
          <a
            className="-mt-1 text-xs font-medium text-info hover:underline"
            href={settings.provider === 'gemini' ? 'https://aistudio.google.com/apikey' : 'https://console.anthropic.com/settings/keys'}
            target="_blank"
            rel="noreferrer"
          >
            {settings.provider === 'gemini'
              ? 'Get a free key at aistudio.google.com/apikey →'
              : 'Get a key at console.anthropic.com →'}
          </a>

          <div className="rounded-md border border-border bg-surface-muted p-3">
            <Switch
              checked={settings.keyEncrypted}
              onChange={(v) => setSettings((s) => ({ ...s, keyEncrypted: v }))}
              label="Encrypt my API key with a passphrase"
            />
            {settings.keyEncrypted && (
              <div className="mt-2.5 flex flex-col gap-2">
                <p className="text-[11px] text-fg-subtle">
                  Stored encrypted (AES-GCM); unlocked in memory each browser session. We never store the passphrase — if
                  you forget it, just re-enter your key.
                </p>
                <Field label="Passphrase" type="password" value={passphrase} placeholder="Choose a passphrase" onChange={setPassphrase} />
                {settings.apiKeyEnc && !settings.apiKey && (
                  <p className="text-[11px] text-fg-subtle">A key is already encrypted. Type a new key above to replace it.</p>
                )}
              </div>
            )}
          </div>

          <FieldWrap label="Model">
            <Select value={settings.model} onChange={(e) => setSettings((s) => ({ ...s, model: e.target.value }))}>
              {modelsFor(settings.provider).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          </FieldWrap>

          <Button variant="secondary" size="sm" onClick={saveAiSettings} className="self-start">
            Save AI settings
          </Button>
        </div>
      </Section>

      <Section title="Appearance">
        <div className="flex items-center justify-between">
          <span className="text-sm text-fg-muted">Theme</span>
          <ThemeToggle />
        </div>
      </Section>

      <Section title="Data">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={downloadBackup} iconLeft={<Download className="h-3.5 w-3.5" />}>
              Export backup
            </Button>
            <label className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 text-xs font-medium text-fg transition-colors hover:bg-surface-muted">
              <Upload className="h-3.5 w-3.5" />
              Import backup
              <input type="file" accept="application/json" className="hidden" onChange={(e) => onImport(e.target.files?.[0])} />
            </label>
            <Button variant="danger" size="sm" onClick={() => setConfirmClear(true)} iconLeft={<Trash2 className="h-3.5 w-3.5" />}>
              Clear all data
            </Button>
          </div>
          <p className="text-[11px] text-fg-subtle">
            Backup includes your profile + saved answers (never your API key). Clear removes everything stored on this device.
          </p>
        </div>
      </Section>

      <div className="sticky bottom-0 mt-4 flex items-center gap-3 border-t border-border bg-surface-muted py-3">
        <Button onClick={save}>Save profile</Button>
      </div>

      <Dialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Clear all local data?"
        description="Deletes your profile, API key, history, and saved answers from this device. This cannot be undone."
        confirmLabel="Clear everything"
        destructive
        onConfirm={doClear}
      />
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
            <Field label="Company" placeholder="Acme Inc" value={it.company} onChange={(v) => update(i, { company: v })} />
            <Field label="Title" placeholder="Senior Software Engineer" value={it.title} onChange={(v) => update(i, { title: v })} />
            <Field label="Start" value={it.startDate} onChange={(v) => update(i, { startDate: v })} placeholder="2021-03" />
            <Field label="End" value={it.endDate} onChange={(v) => update(i, { endDate: v })} placeholder="present" />
          </Grid>
          <FieldWrap label="Achievements (one per line)" className="mt-2">
            <Textarea
              rows={2}
              value={it.bullets.join('\n')}
              onChange={(e) => update(i, { bullets: e.target.value.split('\n').filter(Boolean) })}
            />
          </FieldWrap>
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
          <Field label="School" placeholder="UC Berkeley" value={it.school} onChange={(v) => update(i, { school: v })} />
          <Field label="Degree" placeholder="B.S." value={it.degree} onChange={(v) => update(i, { degree: v })} />
          <Field label="Field" placeholder="Computer Science" value={it.field} onChange={(v) => update(i, { field: v })} />
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
            <Field label="Name" placeholder="Personal portfolio" value={it.name} onChange={(v) => update(i, { name: v })} />
            <Field label="URL" placeholder="https://github.com/janedoe/portfolio" value={it.url ?? ''} onChange={(v) => update(i, { url: v })} />
          </Grid>
          <FieldWrap label="Description" className="mt-2">
            <Textarea rows={2} value={it.description} onChange={(e) => update(i, { description: e.target.value })} />
          </FieldWrap>
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
          <Field label="Name" placeholder="AWS Solutions Architect" value={it.name} onChange={(v) => update(i, { name: v })} />
          <Field label="Issuer" placeholder="Amazon Web Services" value={it.issuer} onChange={(v) => update(i, { issuer: v })} />
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
        <div key={i} className="rounded-md border border-border bg-surface-muted p-3">
          {render(it, i)}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange(items.filter((_, idx) => idx !== i))}
            iconLeft={<Trash2 className="h-3 w-3" />}
            className="mt-2 text-danger hover:bg-danger/10"
          >
            Remove
          </Button>
        </div>
      ))}
      <Button variant="secondary" size="sm" onClick={() => onChange([...items, { ...empty }])} className="self-start">
        {addLabel}
      </Button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card label={title} className="mb-4">
      {children}
    </Card>
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
  const id = useId();
  return (
    <FieldWrap label={label} htmlFor={id}>
      <Input id={id} type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </FieldWrap>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <Switch checked={checked} onChange={onChange} label={label} />;
}
