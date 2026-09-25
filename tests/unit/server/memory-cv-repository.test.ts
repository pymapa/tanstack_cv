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

describe('memory CV repository createPerson', () => {
  const seededWith = (legacyIds: readonly string[]) =>
    createMemoryCvRepository(
      legacyIds.map((legacyId) => ({
        legacyId,
        fullName: `Person ${legacyId}`,
        versions: [{ document: buildCv({ meta: { personId: legacyId } }), isPrimary: true }],
      })),
      { clock, idGen },
    )
  const newCv = buildCv({
    basics: { name: 'Mia Newcomer', label: 'Data Engineer' },
    meta: { personId: 'p01', variant: 'hacked', sourceFormat: 'pptx', 'x-cvYear': '1999', 'x-conversionNotes': ['x'] },
  })

  it('should create a person whose primary CV is revision 1 of the given data', () => {
    const repo = seededWith(['p07', 'p03'])

    const result = repo.createPerson({ data: newCv, authorName: 'Tester' })

    if (!result.ok) throw new Error(result.error)
    const person = repo.getPerson(result.value.personId)
    expect(person).toMatchObject({ fullName: 'Mia Newcomer', legacyId: 'p08', employmentType: 'employee' })
    expect(person?.cvs).toEqual([
      expect.objectContaining({ id: result.value.cvId, variant: 'default', isPrimary: true }),
    ])
    const cv = repo.getCv(result.value.cvId)
    expect(cv?.revision).toMatchObject({ number: 1, source: 'manual', authorName: 'Tester', message: 'Created' })
    expect(cv?.revision.data.basics).toEqual(newCv.basics)
  })

  it('should set meta on the server, ignoring the client values', () => {
    const repo = seededWith(['p07'])

    const result = repo.createPerson({ data: newCv, authorName: 'Tester' })

    if (!result.ok) throw new Error(result.error)
    expect(repo.getCv(result.value.cvId)?.revision.data.meta).toEqual({
      personId: 'p08',
      variant: 'default',
      sourceFormat: 'pdf',
      'x-cvYear': '2026',
    })
  })

  it('should make the new CV searchable', () => {
    const repo = seededWith(['p07'])

    repo.createPerson({ data: newCv, authorName: 'Tester' })

    expect(repo.listSearchable().map((s) => s.personName)).toContain('Mia Newcomer')
  })

  it('should fail with ID_EXHAUSTED when no two-digit person id is left', () => {
    const repo = seededWith(['p99'])

    const result = repo.createPerson({ data: newCv, authorName: 'Tester' })

    expect(result).toEqual({ ok: false, error: 'ID_EXHAUSTED' })
  })
})
