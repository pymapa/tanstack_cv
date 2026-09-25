import { Link } from '@tanstack/react-router'
import type { PersonHit } from '~/cv/search'
import { formatLastChange } from '~/lib/format'
import { Snippet } from './snippet'

export function ResultList({ people }: { people: readonly PersonHit[] }) {
  return (
    <ul aria-label="Search results" className="flex flex-col gap-3">
      {people.map((person) => (
        <li key={person.personId}>
          <ResultCard person={person} />
        </li>
      ))}
    </ul>
  )
}

function ResultCard({ person }: { person: PersonHit }) {
  const primary = person.cvs[0]
  return (
    <article className="rounded-card border border-line bg-white p-6 transition-colors hover:border-ink/40">
      <div className="flex items-start gap-6">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl">
            <Link
              to="/people/$personId"
              params={{ personId: person.personId }}
              className="text-ink no-underline hover:underline"
              data-testid="result-person-link"
            >
              {person.personName}
            </Link>
          </h2>
          <p className="mt-1 text-[0.95rem]">{person.label}</p>
          {person.experienceSummary !== undefined && (
            <p className="mt-1 text-sm text-muted">{person.experienceSummary}</p>
          )}
          {primary !== undefined && <Snippet segments={primary.snippet} />}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="eyebrow mr-1">{person.cvs.length === 1 ? '1 CV' : `${person.cvs.length} CVs`}</span>
        {person.cvs.map((cv) => (
          <Link
            key={cv.cvId}
            to="/cvs/$cvId"
            params={{ cvId: cv.cvId }}
            className="group inline-flex items-center gap-2 rounded-full border border-line bg-mist px-3 py-1 text-sm text-ink no-underline hover:border-ink"
            data-testid="result-cv-link"
          >
            <span className="font-medium">{cv.variant}</span>
            {cv.isPrimary && <span className="rounded-full bg-lime px-1.5 text-xs font-semibold">Primary</span>}
            <span className="text-muted">· {formatLastChange(cv.updatedAt, cv.cvYear)}</span>
          </Link>
        ))}
      </div>
    </article>
  )
}
