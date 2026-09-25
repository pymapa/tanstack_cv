import type { Project } from '~/cv/schema'
import { formatPeriod } from '~/lib/format'
import { Entry, InlineList, Section } from './common'

const periodOf = (p: Project): string | undefined => formatPeriod(p.startDate, p.endDate) ?? p['x-duration']

function ProjectItem({ project, highlight }: { project: Project; highlight: boolean }) {
  const roles = project.roles ?? []
  return (
    <Entry aside={periodOf(project)}>
      <div className={highlight ? 'project project--highlight' : 'project'}>
        <h3>{project.name}</h3>
        <p className="project__meta">
          <strong>{project.entity}</strong>
          {project['x-industry'] !== undefined && <span>{project['x-industry']}</span>}
          {roles.length > 0 && <span>{roles.join(', ')}</span>}
        </p>
        {project.description !== undefined && <p>{project.description}</p>}
        <InlineList items={project.keywords ?? []} />
      </div>
    </Entry>
  )
}

export function ProjectHighlights({ projects }: { projects: readonly Project[] }) {
  if (projects.length === 0) return null
  return (
    <Section title="Project highlights">
      <ul className="entries">
        {projects.map((p) => (
          <ProjectItem key={`${p.name}-${p.entity}`} project={p} highlight />
        ))}
      </ul>
    </Section>
  )
}

export function ProjectHistory({
  projects,
  afterHighlights,
}: {
  projects: readonly Project[]
  afterHighlights: boolean
}) {
  if (projects.length === 0) return null
  return (
    <Section title={afterHighlights ? 'More projects' : 'Projects'} className="compact">
      <ul className="entries">
        {projects.map((p) => (
          <ProjectItem key={`${p.name}-${p.entity}-${p.startDate ?? ''}`} project={p} highlight={false} />
        ))}
      </ul>
    </Section>
  )
}
