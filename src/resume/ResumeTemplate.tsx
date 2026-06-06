// Pure render of a tailored resume into the approved template: single-column,
// sans-serif, navy uppercase section headers with a rule, company/location and
// role/date split, labeled skills, projects with right-aligned links. Styling is
// inline (literal hex) so it is self-contained and prints identically.
import type { ResumeResponse } from '@/ai/contracts';

const NAVY = '#1f5fa8';

function Heading({ children }: { children: string }) {
  return (
    <div
      style={{
        color: NAVY,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 1,
        borderBottom: '1px solid #c9d6e5',
        padding: '0 0 2px',
        margin: '14px 0 5px',
      }}
    >
      {children}
    </div>
  );
}

function Row({ left, right }: { left: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <span>{left}</span>
      {right != null && <span style={{ color: '#666', whiteSpace: 'nowrap' }}>{right}</span>}
    </div>
  );
}

export function ResumeTemplate({ data }: { data: ResumeResponse }) {
  const contact = [data.contact.phone, data.contact.email, ...(data.contact.links ?? []), data.contact.location]
    .filter(Boolean)
    .join('  |  ');
  return (
    <div style={{ fontFamily: "Calibri, Carlito, 'Segoe UI', sans-serif", color: '#222', fontSize: 11, lineHeight: 1.32 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 21, fontWeight: 700, letterSpacing: 1.5, color: '#111', textTransform: 'uppercase' }}>{data.name}</div>
        <div style={{ fontSize: 11, color: '#444', marginTop: 2 }}>{data.headline}</div>
        {contact && <div style={{ fontSize: 9, color: '#555', marginTop: 3 }}>{contact}</div>}
      </div>

      <Heading>SUMMARY</Heading>
      <div style={{ textAlign: 'justify', color: '#333' }}>{data.summary}</div>

      <Heading>EXPERIENCE</Heading>
      {data.experience.map((e, i) => (
        <div key={i} style={{ marginBottom: 6 }}>
          <Row left={<strong>{e.company}</strong>} right={e.location} />
          <Row left={<em>{e.title}</em>} right={e.dates} />
          {e.stack && <div style={{ fontStyle: 'italic', color: '#777', fontSize: 9.5 }}>{e.stack}</div>}
          <ul style={{ margin: '3px 0 0 16px', padding: 0, color: '#333' }}>
            {e.bullets.map((b, j) => (
              <li key={j}>{b}</li>
            ))}
          </ul>
        </div>
      ))}

      <Heading>TECHNICAL SKILLS</Heading>
      {data.skills.map((s, i) => (
        <div key={i} style={{ color: '#333' }}>
          <strong>{s.label}:</strong> {s.items}
        </div>
      ))}

      {data.projects && data.projects.length > 0 && (
        <>
          <Heading>PROJECTS</Heading>
          {data.projects.map((p, i) => (
            <div key={i} style={{ marginBottom: 4 }}>
              <Row
                left={
                  <span>
                    <strong>{p.name}</strong>
                    {p.stack && <span style={{ color: '#777', fontStyle: 'italic' }}> | {p.stack}</span>}
                  </span>
                }
                right={p.link && <span style={{ color: NAVY, textDecoration: 'underline' }}>{p.link}</span>}
              />
              <ul style={{ margin: '2px 0 0 16px', padding: 0, color: '#333' }}>
                {p.bullets.map((b, j) => (
                  <li key={j}>{b}</li>
                ))}
              </ul>
            </div>
          ))}
        </>
      )}

      <Heading>EDUCATION</Heading>
      {data.education.map((e, i) => (
        <div key={i}>
          <Row left={<strong>{e.school}</strong>} right={e.dates} />
          <div style={{ fontStyle: 'italic', color: '#333' }}>
            {e.degree}
            {e.location ? `  |  ${e.location}` : ''}
          </div>
          {e.coursework && (
            <div style={{ color: '#333' }}>
              <strong>Relevant Coursework:</strong> {e.coursework}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
