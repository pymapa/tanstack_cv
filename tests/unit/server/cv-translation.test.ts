import { describe, expect, it, vi } from 'vitest'
import { fakeTranslator, type CvTranslator } from '~/lib/ai/cv-translator'
import { ok } from '~/lib/result'
import { createMemoryCvRepository } from '~/server/repositories/memory-cv-repository'
import { saveTranslation, translateCv } from '~/server/services/cv-translation'
import { buildCv, buildProject } from '../../fixtures/cv'

const clock = () => new Date('2026-09-25T10:00:00.000Z')

const setup = (translator: CvTranslator | null = fakeTranslator) => {
  let counter = 0
  const repo = createMemoryCvRepository(
    [
      {
        legacyId: 'p99',
        fullName: 'Anna Example',
        versions: [
          {
            document: buildCv({ basics: { email: 'anna@example.test' }, projects: [buildProject()] }),
            isPrimary: true,
          },
        ],
      },
    ],
    { clock, idGen: () => `id-${String(++counter).padStart(4, '0')}` },
  )
  const cvId = repo.listSearchable()[0]?.cvId ?? ''
  return { repo, cvId, deps: { repo, translator, signal: new AbortController().signal } }
}

describe('translateCv', () => {
  it('should return an unsaved Finnish draft of an English CV', async () => {
    const { repo, cvId, deps } = setup()

    const result = await translateCv(deps, { cvId })

    if (!result.ok) throw new Error(result.error)
    expect(result.value).toMatchObject({ from: 'en', to: 'fi', variant: 'default-fi', sourceRevisionNumber: 1 })
    expect(result.value.data.basics.label).toBe('[FI] Software Architect')
    expect(result.value.data.basics.name).toBe('Anna Example')
    expect(result.value.data.projects[0]?.entity).toBe('Example Bank')
    expect(result.value.data.meta.variant).toBe('default-fi')
    expect(repo.getPerson(repo.getCv(cvId)?.person.id ?? '')?.cvs).toHaveLength(1)
  })

  it('should send only translatable text to the translator, never contact details or names', async () => {
    const translator = vi.fn(fakeTranslator)
    const { cvId, deps } = setup(translator)

    await translateCv(deps, { cvId })

    const sent = JSON.stringify(translator.mock.calls[0]?.[0])
    expect(sent).not.toContain('anna@example.test')
    expect(sent).not.toContain('Anna Example')
    expect(sent).not.toContain('Example Bank')
    expect(sent).not.toContain('p99')
  })

  it('should fail with NOT_FOUND when the CV does not exist', async () => {
    const { deps } = setup()

    expect(await translateCv(deps, { cvId: 'missing' })).toEqual({ ok: false, error: 'NOT_FOUND' })
  })

  it('should fail with AI_UNAVAILABLE when no translator is configured', async () => {
    const { cvId, deps } = setup(null)

    expect(await translateCv(deps, { cvId })).toEqual({ ok: false, error: 'AI_UNAVAILABLE' })
  })

  it('should fail with AI_INVALID_OUTPUT when the translator writes to a field it was not given', async () => {
    const { cvId, deps } = setup(() => Promise.resolve(ok([{ id: '/basics/name', text: 'Someone Else' }])))

    expect(await translateCv(deps, { cvId })).toEqual({ ok: false, error: 'AI_INVALID_OUTPUT' })
  })

  it('should return a translation that is too long for a field, so the user can shorten it in review', async () => {
    const { cvId, deps } = setup(() => Promise.resolve(ok([{ id: '/basics/label', text: 'x'.repeat(400) }])))

    const result = await translateCv(deps, { cvId })

    expect(result.ok && result.value.data.basics.label).toBe('x'.repeat(400))
  })
})

describe('saveTranslation', () => {
  it('should save the reviewed translation as a new CV version of the same person', async () => {
    const { repo, cvId, deps } = setup()
    const draft = await translateCv(deps, { cvId })
    if (!draft.ok) throw new Error(draft.error)

    const result = saveTranslation(
      { repo },
      { sourceCvId: cvId, variant: 'default-fi', to: 'fi', data: draft.value.data, authorName: 'Tester' },
    )

    if (!result.ok) throw new Error(result.error)
    const saved = repo.getCv(result.value.cvId)
    expect(saved?.variant).toBe('default-fi')
    expect(saved?.revision).toMatchObject({ source: 'ai', message: 'Finnish translation of "default", reviewed' })
    expect(saved?.revision.data.basics.label).toBe('[FI] Software Architect')
  })

  it('should fail with VARIANT_TAKEN when the name is already used', () => {
    const { repo, cvId } = setup()

    const result = saveTranslation(
      { repo },
      { sourceCvId: cvId, variant: 'Default', to: 'fi', data: buildCv(), authorName: 'Tester' },
    )

    expect(result).toEqual({ ok: false, error: 'VARIANT_TAKEN' })
  })
})
