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

  describe('createVariant', () => {
    const sourceOf = (repo: ReturnType<typeof setup>) => {
      const cvId = repo.listSearchable()[0]?.cvId ?? ''
      const source = repo.getCv(cvId)
      if (source === null) throw new Error('missing cv')
      return source
    }

    it('should add a new CV version for the same person from the given data', () => {
      const repo = setup()
      const source = sourceOf(repo)
      const data = { ...source.revision.data, basics: { ...source.revision.data.basics, label: 'Client Architect' } }

      const result = repo.createVariant({ sourceCvId: source.id, variant: 'Client X', data, authorName: 'Tester' })

      if (!result.ok) throw new Error(result.error)
      const created = repo.getCv(result.value.cvId)
      expect(created?.person.id).toBe(source.person.id)
      expect(created?.variant).toBe('Client X')
      expect(created?.isPrimary).toBe(false)
      expect(created?.revision).toMatchObject({ number: 1, source: 'duplicate', authorName: 'Tester' })
      expect(created?.revision.data.basics.label).toBe('Client Architect')
      expect(created?.revision.data.meta.variant).toBe('Client X')
      expect(repo.getPerson(source.person.id)?.cvs.map((c) => c.variant)).toEqual(['default', 'Client X', 'PM'])
    })

    it('should record the source version in the revision message', () => {
      const repo = setup()
      const source = sourceOf(repo)

      const result = repo.createVariant({
        sourceCvId: source.id,
        variant: 'Client X',
        data: source.revision.data,
        authorName: 'Tester',
      })

      if (!result.ok) throw new Error(result.error)
      expect(repo.getCv(result.value.cvId)?.revision.message).toBe('Created from default, revision 1')
    })

    it('should leave the source CV unchanged', () => {
      const repo = setup()
      const source = sourceOf(repo)
      const data = { ...source.revision.data, basics: { ...source.revision.data.basics, label: 'Client Architect' } }

      repo.createVariant({ sourceCvId: source.id, variant: 'Client X', data, authorName: 'Tester' })

      expect(repo.getCv(source.id)).toEqual(source)
    })

    it('should keep app-managed meta fields from the source CV', () => {
      const repo = setup()
      const source = sourceOf(repo)
      const tampered = { ...source.revision.data, meta: { ...source.revision.data.meta, personId: 'p01' } }

      const result = repo.createVariant({ sourceCvId: source.id, variant: 'Client X', data: tampered, authorName: 'T' })

      if (!result.ok) throw new Error(result.error)
      expect(repo.getCv(result.value.cvId)?.revision.data.meta.personId).toBe('p99')
    })

    it.each(['PM', 'pm', ' PM '])('should return VARIANT_TAKEN when the person already has "%s"', (variant) => {
      const repo = setup()
      const source = sourceOf(repo)

      const result = repo.createVariant({ sourceCvId: source.id, variant, data: source.revision.data, authorName: 'T' })

      expect(result).toEqual({ ok: false, error: 'VARIANT_TAKEN' })
    })

    it('should return NOT_FOUND when the source CV does not exist', () => {
      const result = setup().createVariant({ sourceCvId: 'x', variant: 'Client X', data: buildCv(), authorName: 'T' })

      expect(result).toEqual({ ok: false, error: 'NOT_FOUND' })
    })
  })

  describe('createCvFrom', () => {
    const create = (
      repo: ReturnType<typeof setup>,
      overrides: Partial<Parameters<typeof repo.createCvFrom>[0]> = {},
    ) => {
      const sourceCvId = repo.listSearchable()[0]?.cvId ?? ''
      return repo.createCvFrom({
        sourceCvId,
        variant: 'default-fi',
        data: buildCv({ basics: { label: 'Ohjelmistoarkkitehti' } }),
        source: 'ai',
        message: 'Translated to Finnish',
        authorName: 'Tester',
        ...overrides,
      })
    }

    it('should add a new CV version for the same person, with one revision', () => {
      const repo = setup()

      const result = create(repo)

      if (!result.ok) throw new Error(result.error)
      const cv = repo.getCv(result.value.cvId)
      expect(cv?.person.fullName).toBe('Anna Example')
      expect(cv?.variant).toBe('default-fi')
      expect(cv?.isPrimary).toBe(false)
      expect(cv?.revision).toMatchObject({ number: 1, source: 'ai', message: 'Translated to Finnish' })
      expect(cv?.revision.data.basics.label).toBe('Ohjelmistoarkkitehti')
      expect(repo.getPerson(cv?.person.id ?? '')?.cvs).toHaveLength(3)
    })

    it('should take the variant and app-managed meta from the server, not the client data', () => {
      const repo = setup()

      const result = create(repo, {
        data: buildCv({ meta: { personId: 'p01', variant: 'other', sourceFormat: 'pdf' } }),
      })

      if (!result.ok) throw new Error(result.error)
      expect(repo.getCv(result.value.cvId)?.revision.data.meta).toMatchObject({
        personId: 'p99',
        variant: 'default-fi',
        sourceFormat: 'pptx',
      })
    })

    it('should return VARIANT_TAKEN when the person already has a CV with that name', () => {
      const repo = setup()

      expect(create(repo, { variant: 'pm' })).toEqual({ ok: false, error: 'VARIANT_TAKEN' })
    })

    it('should return NOT_FOUND when the source CV does not exist', () => {
      expect(create(setup(), { sourceCvId: 'missing' })).toEqual({ ok: false, error: 'NOT_FOUND' })
    })
  })

  describe('restoreRevision', () => {
    const editedCv = () => {
      const repo = setup()
      const cvId = repo.listSearchable()[0]?.cvId ?? ''
      const first = repo.getCv(cvId)?.revision
      if (first === undefined) throw new Error('missing cv')
      const data = { ...first.data, basics: { ...first.data.basics, label: 'Principal Architect' } }
      const second = repo.saveRevision({ cvId, baseRevisionId: first.id, data, authorName: 'Tester' })
      if (!second.ok) throw new Error('save failed')
      return { repo, cvId, first, second: second.value }
    }

    it('should add a new revision with the content of the restored one', () => {
      const { repo, cvId, first, second } = editedCv()

      const result = repo.restoreRevision({
        cvId,
        revisionId: first.id,
        baseRevisionId: second.id,
        authorName: 'Tester',
      })

      expect(result.ok && result.value.number).toBe(3)
      expect(result.ok && result.value.source).toBe('restore')
      expect(result.ok && result.value.message).toBe('Restored revision 1')
      expect(repo.getCv(cvId)?.revision.data.basics.label).toBe(first.data.basics.label)
    })

    it('should keep every earlier revision', () => {
      const { repo, cvId, first, second } = editedCv()

      repo.restoreRevision({ cvId, revisionId: first.id, baseRevisionId: second.id, authorName: 'Tester' })

      expect(repo.getCv(cvId)?.revisions.map((r) => r.number)).toEqual([3, 2, 1])
    })

    it('should return CONFLICT when the base revision is stale', () => {
      const { repo, cvId, first } = editedCv()

      const result = repo.restoreRevision({
        cvId,
        revisionId: first.id,
        baseRevisionId: first.id,
        authorName: 'Tester',
      })

      expect(result).toEqual({ ok: false, error: 'CONFLICT' })
    })

    it('should return NOT_FOUND when the revision belongs to another CV', () => {
      const { repo, cvId, second } = editedCv()
      const otherCv = repo.listSearchable()[1]?.cvId ?? ''
      const otherRevision = repo.getCv(otherCv)?.revision.id ?? ''

      const result = repo.restoreRevision({
        cvId,
        revisionId: otherRevision,
        baseRevisionId: second.id,
        authorName: 'Tester',
      })

      expect(result).toEqual({ ok: false, error: 'NOT_FOUND' })
    })
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
