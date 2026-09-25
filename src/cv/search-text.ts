import type { CvDocument } from './schema'
import { skillNames } from './skills'

/** Searchable columns, in ranking-weight order. Shared with the future Postgres full-text index (spec §7.2). */
export const SEARCH_FIELDS = [
  'name',
  'label',
  'variant',
  'keywords',
  'skills',
  'clients',
  'industries',
  'roles',
  'body',
] as const
export type SearchField = (typeof SEARCH_FIELDS)[number]

export const FIELD_WEIGHTS: Readonly<Record<SearchField, number>> = {
  name: 10,
  label: 6,
  variant: 4,
  keywords: 5,
  skills: 5,
  clients: 4,
  industries: 3,
  roles: 3,
  body: 1,
}

export const FACET_KINDS = ['skillCategory', 'skill', 'industry', 'role', 'client', 'variant', 'tag'] as const
export type FacetKind = (typeof FACET_KINDS)[number]

export const FACET_LABELS: Readonly<Record<FacetKind, string>> = {
  skillCategory: 'Skill category',
  skill: 'Skill',
  industry: 'Industry',
  role: 'Role',
  client: 'Client',
  variant: 'CV version',
  tag: 'Tag',
}

const compact = (values: ReadonlyArray<string | undefined>): string[] =>
  values.filter((v): v is string => typeof v === 'string' && v.trim() !== '')

const unique = (values: readonly string[]): string[] => [...new Map(values.map((v) => [v.toLowerCase(), v])).values()]

const GENERIC_CLIENTS = new Set(['multiple clients'])

export const extractSearchFields = (cv: CvDocument): Readonly<Record<SearchField, string>> => {
  const { basics, skills, projects, work = [], certificates = [] } = cv
  return {
    name: basics.name,
    label: basics.label,
    variant: cv.meta.variant,
    keywords: compact([...(basics['x-keywords'] ?? []), ...(basics['x-keySkills'] ?? []).map((s) => s.title)]).join(
      ' ',
    ),
    skills: compact([
      ...skills.flatMap((s) => [s.name, ...(s.keywords ?? []), ...(s['x-skillDetails'] ?? []).map((d) => d.name)]),
      ...projects.flatMap((p) => p.keywords ?? []),
    ]).join(' '),
    clients: compact(projects.map((p) => p.entity)).join(' '),
    industries: compact([...(basics['x-industries'] ?? []), ...projects.map((p) => p['x-industry'])]).join(' '),
    roles: compact([
      ...(basics['x-keyRoles'] ?? []).map((r) => r.title),
      ...projects.flatMap((p) => p.roles ?? []),
      ...work.map((w) => w.position),
    ]).join(' '),
    // Prose only, one passage per line: search snippets are cut from a single line.
    body: compact([
      basics.summary,
      basics['x-experienceSummary'],
      basics['x-tagline'],
      ...(basics['x-strengths'] ?? []).flatMap((s) => [s.title, s.description]),
      ...projects.flatMap((p) => [p.name, p.description]),
      ...work.flatMap((w) => [w.name, w.summary]),
      ...certificates.flatMap((c) => [c.name, c.issuer]),
    ]).join('\n'),
  }
}

export const extractFacets = (cv: CvDocument, tags: readonly string[] = []): Readonly<Record<FacetKind, string[]>> => {
  const { basics, skills, projects } = cv
  return {
    skillCategory: unique(compact(skills.map((s) => s.name))),
    skill: unique(compact(skills.flatMap(skillNames))),
    industry: unique(compact(basics['x-industries'] ?? [])),
    role: unique(compact((basics['x-keyRoles'] ?? []).map((r) => r.title))),
    client: unique(compact(projects.map((p) => p.entity)).filter((c) => !GENERIC_CLIENTS.has(c.toLowerCase()))),
    variant: [cv.meta.variant],
    tag: unique(compact(tags)),
  }
}
