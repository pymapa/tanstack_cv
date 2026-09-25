import type { Project } from '~/cv/schema'
import { formatPeriod } from '~/lib/format'
import { Chips, Section, present } from './common'

const periodOf = (p: Project): string | undefined => formatPeriod(p.startDate, p.endDate) ?? p['x-duration']

function ProjectItem({ project, highlight }: { project: Project; highlight: boolean }) {
  const period = periodOf(project)
  const roles = project.roles ?? []
  return (
    <li className={highlight ? 'project project--highlight' : 'project'}>
      <h3>{project.name}</h3>
      <p className="project__meta">
        <strong>{project.entity}</strong>
        {project['x-industry'] !== undefined && <span>{project['x-industry']}</span>}
        {period !== undefined && <span>{period}</span>}
        {roles.length > 0 && <span>{roles.join(', ')}</span>}
      </p>
      {project.description !== undefined && <p>{project.description}</p>}
      {highlight && <Chips items={project.keywords ?? []} tint />}
      {!highlight && (project.keywords ?? []).length > 0 && (
        <p className="muted" style={{ marginTop: '1.5mm' }}>
          {present(project.keywords ?? []).join(' · ')}
        </p>
      )}
    </li>
  )
}

export function ProjectHighlights({ projects }: { projects: readonly Project[] }) {
  if (projects.length === 0) return null
  return (
    <Section title="Project highlights">
      <ul>
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
      <ul>
        {projects.map((p) => (
          <ProjectItem key={`${p.name}-${p.entity}-${p.startDate ?? ''}`} project={p} highlight={false} />
        ))}
      </ul>
    </Section>
  )
}
