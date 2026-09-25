import { defaultParseSearch } from '@tanstack/react-router'
import { describe, expect, it } from 'vitest'
import type { SearchableCv } from '~/cv/search'
import type { IndexPerson } from '~/lib/cv-data'
import { buildCvLinks } from '~/lib/cv-links'
import { buildCv } from '../../fixtures/cv'

const entry = (cvId: string, legacyPersonId: string, variant: string, personName: string): SearchableCv => ({
  cvId,
  personId: `person-${legacyPersonId}`,
  personName,
  variant,
  isPrimary: variant === 'default',
  updatedAt: null,
  document: buildCv({ basics: { name: personName }, meta: { personId: legacyPersonId, variant } }),
  tags: [],
})

const people: IndexPerson[] = [
  {
    personId: 'p98',
    name: 'Anna Example',
    primary: 'p98-v1.json',
    versions: [
      { file: 'p98-v1.json', variant: 'default' },
      { file: 'p98-v2.json', variant: 'PM' },
    ],
  },
  {
    personId: 'p99',
    name: 'Bob Example',
    primary: 'p99-v1.json',
    versions: [{ file: 'p99-v1.json', variant: 'default' }],
  },
]

const entries = [
  entry('aaaa-0001', 'p98', 'default', 'Anna Example'),
  entry('aaaa-0002', 'p98', 'PM', 'Anna Example'),
  entry('bbbb-0001', 'p99', 'default', 'Bob Example'),
]

describe('buildCvLinks', () => {
  it('should link each CV file to its page in the app', () => {
    const result = buildCvLinks(people, entries, ['p98-v2.json', 'p99-v1.json'])

    expect(result.cvs).toEqual([
      { file: 'p98-v2.json', name: 'Anna Example', variant: 'PM', url: '/cvs/aaaa-0002' },
      { file: 'p99-v1.json', name: 'Bob Example', variant: 'default', url: '/cvs/bbbb-0001' },
    ])
  })

  it('should build one search link that shows exactly the linked CVs', () => {
    const result = buildCvLinks(people, entries, ['p98-v2.json', 'p99-v1.json'])

    const [path, query = ''] = (result.filterUrl ?? '').split('?')
    expect(path).toBe('/')
    expect(defaultParseSearch(`?${query}`)).toEqual({ cv: ['aaaa-0002', 'bbbb-0001'] })
  })

  it('should report files it cannot find instead of linking them', () => {
    const result = buildCvLinks(people, entries, ['p98-v1.json', 'p42-v1.json'])

    expect(result.cvs.map((c) => c.file)).toEqual(['p98-v1.json'])
    expect(result.notFound).toEqual(['p42-v1.json'])
  })

  it('should link a CV once when the same file is passed twice', () => {
    const result = buildCvLinks(people, entries, ['p99-v1.json', 'p99-v1.json'])

    expect(result.cvs).toHaveLength(1)
  })

  it('should return no filter link when no file is found', () => {
    const result = buildCvLinks(people, entries, ['p42-v1.json'])

    expect(result.filterUrl).toBeNull()
  })
})
