import type { CvDocument } from '~/cv/schema'
import { formatPartialDate, formatPeriod } from '~/lib/format'
import { Section, present } from './common'

export function WorkHistory({ work }: { work: NonNullable<CvDocument['work']> }) {
  if (work.length === 0) return null
  return (
    <Section title="Work history" className="compact">
      <ul>
        {work.map((w) => {
          const period = formatPeriod(w.startDate, w.endDate)
          return (
            <li key={`${w.name}-${w.position ?? ''}-${w.startDate ?? ''}`} className="project">
              <h3>{present([w.position, w.name]).join(', ')}</h3>
              {period !== undefined && <p className="project__meta">{period}</p>}
              {w.summary !== undefined && <p>{w.summary}</p>}
            </li>
          )
        })}
      </ul>
    </Section>
  )
}

export function EducationAndCertificates({ cv }: { cv: CvDocument }) {
  const education = cv.education ?? []
  const certificates = cv.certificates ?? []
  if (education.length === 0 && certificates.length === 0) return null
  return (
    <div className="two-col section">
      {education.length > 0 && (
        <Section title="Education">
          <ul className="item-list">
            {education.map((e) => (
              <li key={`${e.institution ?? ''}-${e.area ?? ''}-${e.startDate ?? ''}`}>
                <strong>{present([e.studyType, e.area]).join(', ') || e.institution}</strong>
                <span className="muted">
                  {' · '}
                  {present([e.institution, formatPeriod(e.startDate, e.endDate)]).join(' · ')}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {certificates.length > 0 && (
        <Section title="Certificates">
          <ul className="item-list">
            {certificates.map((c) => {
              const meta = present([c.issuer, formatPartialDate(c.date) ?? c['x-dateText']])
              return (
                <li key={`${c.name}-${c.date ?? ''}`}>
                  <strong>{c.name}</strong>
                  {meta.length > 0 && <span className="muted"> · {meta.join(' · ')}</span>}
                </li>
              )
            })}
          </ul>
        </Section>
      )}
    </div>
  )
}

export function Languages({ languages }: { languages: NonNullable<CvDocument['languages']> }) {
  const items = languages.filter((l) => l.language !== undefined)
  if (items.length === 0) return null
  return (
    <Section title="Languages">
      <ul className="item-list">
        {items.map((l) => (
          <li key={l.language}>
            <strong>{l.language}</strong>
            {l.fluency !== undefined && <span className="muted"> · {l.fluency}</span>}
          </li>
        ))}
      </ul>
    </Section>
  )
}
