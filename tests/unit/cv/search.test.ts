import { describe, expect, it } from 'vitest'
import { normalize, parseQuery, searchCvs, type SearchableCv } from '~/cv/search'
import { buildCv, buildProject } from '../../fixtures/cv'

const entry = (id: string, personId: string, cv = buildCv(), extra: Partial<SearchableCv> = {}): SearchableCv => ({
  cvId: id,
  personId,
  personName: cv.basics.name,
  variant: cv.meta.variant,
  isPrimary: true,
  updatedAt: '2026-01-01T00:00:00.000Z',
  document: cv,
  tags: [],
  ...extra,
})

const anna = entry(
  'cv-anna',
  'person-anna',
  buildCv({
    basics: { name: 'Anna Mäkelä', label: 'Scrum Master', 'x-industries': ['Finance'] },
    skills: [{ name: 'Agile Frameworks', keywords: ['Scrum', 'Kanban'] }],
    projects: [
      buildProject({ entity: 'Example Bank', roles: ['Scrum Master'], description: 'Led a mortgage renewal.' }),
    ],
  }),
)
const bob = entry(
  'cv-bob',
  'person-bob',
  buildCv({
    basics: { name: 'Bob Builder', label: 'Cloud Engineer', 'x-industries': ['Telecom'] },
    skills: [{ name: 'Cloud', keywords: ['Azure', 'Terraform'] }],
    projects: [buildProject({ entity: 'Example Telco', roles: ['DevOps Engineer'], keywords: ['Azure DevOps'] })],
  }),
)
const annaPm = entry(
  'cv-anna-pm',
  'person-anna',
  buildCv({ basics: { name: 'Anna Mäkelä', label: 'Project Manager' }, meta: { variant: 'PM' } }),
  { isPrimary: false },
)
const ALL = [anna, bob, annaPm]

describe('normalize', () => {
  it('should fold case and diacritics when normalizing', () => {
    expect(normalize('  Mäkelä ÅÖ ')).toBe('makela ao')
  })
})

describe('parseQuery', () => {
  it('should strip operators and punctuation when parsing adversarial input', () => {
    expect(parseQuery('"NEAR(a b)" OR -c* name:^d')).toEqual(['near', 'a', 'b', 'or', 'c', 'name', 'd'])
  })

  it('should cap terms at 10 and 64 characters when input is huge', () => {
    const terms = parseQuery(`${'x'.repeat(100)} ${Array.from({ length: 20 }, (_, i) => `t${i}`).join(' ')}`)

    expect(terms).toHaveLength(10)
    expect(terms[0]).toHaveLength(64)
  })

  it('should return no terms when the query is only whitespace', () => {
    expect(parseQuery('   ')).toEqual([])
  })
})

describe('searchCvs', () => {
  it('should return every person grouped when the query is empty', () => {
    const result = searchCvs(ALL, { q: '', facets: {} })

    expect(result.people.map((p) => p.personId)).toEqual(['person-anna', 'person-bob'])
    expect(result.people[0]?.cvs.map((c) => c.cvId)).toEqual(['cv-anna', 'cv-anna-pm'])
    expect(result.totalCvs).toBe(3)
  })

  it('should match names without diacritics when the user types plain letters', () => {
    const result = searchCvs(ALL, { q: 'makela', facets: {} })

    expect(result.people.map((p) => p.personId)).toEqual(['person-anna'])
  })

  it('should require every term to match when the query has several terms', () => {
    expect(searchCvs(ALL, { q: 'scrum example bank', facets: {} }).people).toHaveLength(1)
    expect(searchCvs(ALL, { q: 'scrum terraform', facets: {} }).people).toHaveLength(0)
  })

  it('should match term prefixes when the user is still typing', () => {
    expect(searchCvs(ALL, { q: 'terra', facets: {} }).people.map((p) => p.personId)).toEqual(['person-bob'])
  })

  it('should rank a name match above a description match', () => {
    const carol = entry('cv-carol', 'person-carol', buildCv({ basics: { name: 'Carol Mortgage', label: 'Analyst' } }))

    const result = searchCvs([anna, carol], { q: 'mortgage', facets: {} })

    expect(result.people.map((p) => p.personId)).toEqual(['person-carol', 'person-anna'])
  })

  it('should OR values within a facet and AND across facets', () => {
    const industryOr = searchCvs(ALL, { q: '', facets: { industry: ['finance', 'telecom'] } })
    const andAcross = searchCvs(ALL, { q: '', facets: { industry: ['finance'], skill: ['azure'] } })

    expect(industryOr.people).toHaveLength(2)
    expect(andAcross.people).toHaveLength(0)
  })

  it('should count facet values over the query matches', () => {
    const result = searchCvs(ALL, { q: 'scrum', facets: {} })

    expect(result.facets.industry).toEqual([{ value: 'Finance', key: 'finance', count: 1 }])
  })

  it('should return a snippet with marked segments when the body matches', () => {
    const result = searchCvs(ALL, { q: 'mortgage', facets: {} })
    const snippet = result.people[0]?.cvs[0]?.snippet ?? []

    expect(snippet.filter((s) => s.match).map((s) => s.text.toLowerCase())).toContain('mortgage')
  })

  it('should build the snippet from one prose passage, not from keyword lists', () => {
    const cv = entry(
      'cv-dan',
      'person-dan',
      buildCv({
        basics: { name: 'Dan Example', summary: 'Dan coaches teams.' },
        projects: [
          buildProject({
            description: 'Coached two Scrum teams through a renewal.',
            keywords: ['Scrum', 'Jira', 'Kanban'],
          }),
        ],
      }),
    )

    const snippet = searchCvs([cv], { q: 'scrum', facets: {} }).people[0]?.cvs[0]?.snippet ?? []
    const text = snippet.map((s) => s.text).join('')

    expect(text).toBe('Coached two Scrum teams through a renewal.')
  })

  it('should find project technologies through the skills field', () => {
    const cv = entry('cv-eve', 'person-eve', buildCv({ projects: [buildProject({ keywords: ['Kubernetes'] })] }))

    expect(searchCvs([cv], { q: 'kubernetes', facets: {} }).people).toHaveLength(1)
  })

  it('should filter by variant when the variant facet is set', () => {
    const result = searchCvs(ALL, { q: '', facets: { variant: ['pm'] } })

    expect(result.people[0]?.cvs.map((c) => c.cvId)).toEqual(['cv-anna-pm'])
  })
})
