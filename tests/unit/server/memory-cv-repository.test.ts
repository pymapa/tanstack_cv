import { describe, expect, it } from 'vitest'
import type { ImportedPerson } from '~/server/import/sample-data'
import { createMemoryCvRepository } from '~/server/repositories/memory-cv-repository'
import { buildCv } from '../../fixtures/cv'

const clock = () => new Date('2026-09-25T10:00:00.000Z')
let counter = 0
const idGen = () => `id-${String(++counter).padStart(4, '0')}`

const seed: ImportedPerson[] = [
  {
    legacyId: 'p99',
    fullName: 'Anna Example',
    versions: [
      { document: buildCv(), isPrimary: true },
      { document: buildCv({ meta: { variant: 'PM' }, basics: { label: 'Project Manager' } }), isPrimary: false },
    ],
  },
]

const setup = () => createMemoryCvRepository(seed, { clock, idGen })

describe('memory CV repository', () => {
  it('should expose every CV as searchable when seeded', () => {
    const repo = setup()

    expect(repo.listSearchable().map((s) => s.variant)).toEqual(['default', 'PM'])
  })

  it('should return the person with CV summaries, primary first', () => {
    const repo = setup()
    const personId = repo.listSearchable()[0]?.personId ?? ''

    const person = repo.getPerson(personId)

    expect(person?.fullName).toBe('Anna Example')
    expect(person?.cvs.map((c) => [c.variant, c.isPrimary])).toEqual([
      ['default', true],
      ['PM', false],
    ])
  })

  it('should return null when the person does not exist', () => {
    expect(setup().getPerson('missing')).toBeNull()
  })

  it('should create revision 2 when saving against the current revision', () => {
    const repo = setup()
    const cvId = repo.listSearchable()[0]?.cvId ?? ''
    const before = repo.getCv(cvId)
    if (before === null) throw new Error('missing cv')
    const data = { ...before.revision.data, basics: { ...before.revision.data.basics, label: 'Principal Architect' } }

    const result = repo.saveRevision({
      cvId,
      baseRevisionId: before.revision.id,
      data,
      message: 'Retitle',
      authorName: 'Tester',
    })

    expect(result.ok).toBe(true)
    const after = repo.getCv(cvId)
    expect(after?.revision.number).toBe(2)
    expect(after?.revision.data.basics.label).toBe('Principal Architect')
    expect(after?.revisions.map((r) => r.number)).toEqual([2, 1])
  })

  it('should keep app-managed meta fields when the client sends different ones', () => {
    const repo = setup()
    const cvId = repo.listSearchable()[0]?.cvId ?? ''
    const before = repo.getCv(cvId)
    if (before === null) throw new Error('missing cv')
    const tampered = { ...before.revision.data, meta: { ...before.revision.data.meta, personId: 'p01' } }

    repo.saveRevision({ cvId, baseRevisionId: before.revision.id, data: tampered, authorName: 'Tester' })

    expect(repo.getCv(cvId)?.revision.data.meta.personId).toBe('p99')
  })

  it('should return CONFLICT when the base revision is stale', () => {
    const repo = setup()
    const cvId = repo.listSearchable()[0]?.cvId ?? ''
    const before = repo.getCv(cvId)
    if (before === null) throw new Error('missing cv')
    const save = () =>
      repo.saveRevision({ cvId, baseRevisionId: before.revision.id, data: before.revision.data, authorName: 'T' })
    save()

    const second = save()

    expect(second).toEqual({ ok: false, error: 'CONFLICT' })
  })

  it('should return NOT_FOUND when saving an unknown CV', () => {
    const result = setup().saveRevision({ cvId: 'x', baseRevisionId: 'y', data: buildCv(), authorName: 'T' })

    expect(result).toEqual({ ok: false, error: 'NOT_FOUND' })
  })
})
