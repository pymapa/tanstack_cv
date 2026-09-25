import type { CvDocument } from '~/cv/schema'
import { formatPartialDate, formatPeriod } from '~/lib/format'
import { Entry, Section, present } from './common'

export function WorkHistory({ work }: { work: NonNullable<CvDocument['work']> }) {
  if (work.length === 0) return null
  return (
    <Section title="Work history" className="compact">
      <ul className="entries">
        {work.map((w) => (
          <Entry
            key={`${w.name}-${w.position ?? ''}-${w.startDate ?? ''}`}
            aside={formatPeriod(w.startDate, w.endDate)}
          >
            <div className="project">
              <h3>{present([w.position, w.name]).join(', ')}</h3>
              {w.summary !== undefined && <p>{w.summary}</p>}
            </div>
          </Entry>
        ))}
      </ul>
    </Section>
  )
}

export function EducationAndCertificates({ cv }: { cv: CvDocument }) {
  const education = cv.education ?? []
  const certificates = cv.certificates ?? []
  return (
    <>
      {education.length > 0 && (
        <Section title="Education" className="compact">
          <ul className="entries">
            {education.map((e) => (
              <Entry
                key={`${e.institution ?? ''}-${e.area ?? ''}-${e.startDate ?? ''}`}
                aside={formatPeriod(e.startDate, e.endDate)}
              >
                <p>
                  <strong>{present([e.studyType, e.area]).join(', ') || e.institution}</strong>
                  {e.institution !== undefined && <span className="muted"> · {e.institution}</span>}
                </p>
              </Entry>
            ))}
          </ul>
        </Section>
      )}
      {certificates.length > 0 && (
        <Section title="Certificates" className="compact">
          <ul className="entries">
            {certificates.map((c) => (
              <Entry key={`${c.name}-${c.date ?? ''}`} aside={formatPartialDate(c.date) ?? c['x-dateText']}>
                <p>
                  <strong>{c.name}</strong>
                  {c.issuer !== undefined && <span className="muted"> · {c.issuer}</span>}
                </p>
              </Entry>
            ))}
          </ul>
        </Section>
      )}
    </>
  )
}

export function Languages({ languages }: { languages: NonNullable<CvDocument['languages']> }) {
  const items = languages.filter((l) => l.language !== undefined)
  if (items.length === 0) return null
  return (
    <Section title="Languages" className="compact">
      <ul className="pairs">
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
