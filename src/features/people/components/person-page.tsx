import { Link } from '@tanstack/react-router'
import { Container } from '~/components/container'
import { PixelGrid } from '~/components/pixel-grid'
import { formatLastChange } from '~/lib/format'
import type { PersonView } from '~/server/repositories/cv-repository'

export function PersonPage({ person }: { person: PersonView }) {
  const primary = person.cvs.find((cv) => cv.isPrimary) ?? person.cvs[0]
  return (
    <Container className="pt-10">
      <header className="flex items-end justify-between gap-8 border-b border-line pb-8">
        <div>
          <p className="eyebrow">{person.employmentType === 'employee' ? 'Kipinä employee' : 'Subcontractor'}</p>
          {primary !== undefined && <p className="mt-2 text-2xl font-light tracking-tight">{primary.label}</p>}
        </div>
        {primary !== undefined && (
          <Link
            to="/cvs/$cvId"
            params={{ cvId: primary.id }}
            className="rounded-card bg-ink px-5 py-3 text-sm font-medium text-white no-underline hover:bg-black"
            data-testid="open-primary-cv"
          >
            Open primary CV
          </Link>
        )}
      </header>

      <section aria-labelledby="versions-heading" className="mt-10">
        <div className="flex items-center gap-3">
          <PixelGrid size={14} />
          <h2 id="versions-heading" className="text-2xl">
            CV versions
          </h2>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Each version is tailored for a role or a client. Start from the closest one and adjust it.
        </p>
        <ul className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
          {person.cvs.map((cv) => (
            <li key={cv.id}>
              <Link
                to="/cvs/$cvId"
                params={{ cvId: cv.id }}
                className="flex h-full flex-col rounded-card border border-line bg-white p-5 text-ink no-underline hover:border-ink"
                data-testid="person-cv-link"
              >
                <span className="flex items-center gap-2">
                  <span className="text-xl font-light tracking-tight">{cv.variant}</span>
                  {cv.isPrimary && <span className="rounded-full bg-lime px-2 text-xs font-semibold">Primary</span>}
                </span>
                <span className="mt-2 text-sm">{cv.label}</span>
                <span className="mt-auto pt-4 text-xs text-muted">
                  Revision {cv.revisionNumber} · {formatLastChange(cv.updatedAt, cv.cvYear)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </Container>
  )
}
