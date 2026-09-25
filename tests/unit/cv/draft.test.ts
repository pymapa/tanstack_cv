import { describe, expect, it } from 'vitest'
import { applyDraftUpdate, DraftUpdate, emptyCv, toModelDraft } from '~/cv/draft'
import { CvDocument } from '~/cv/schema'
import { buildCv, buildProject } from '../../fixtures/cv'

describe('emptyCv', () => {
  it('should be a valid CV document apart from the missing name', () => {
    const result = CvDocument.safeParse(emptyCv('2026'))

    expect(result.error?.issues.map((i) => i.path.join('.'))).toEqual(['basics.name'])
  })
})

describe('DraftUpdate', () => {
  it.each(['email', 'phone', 'url', 'profiles'])('should reject contact field basics.%s', (field) => {
    const result = DraftUpdate.safeParse({ basics: { [field]: 'x' } })

    expect(result.success).toBe(false)
  })

  it('should reject meta', () => {
    expect(DraftUpdate.safeParse({ meta: { personId: 'p01' } }).success).toBe(false)
  })

  it('should accept a partial basics and whole sections', () => {
    const result = DraftUpdate.safeParse({ basics: { label: 'Data engineer' }, projects: [buildProject()] })

    expect(result.success).toBe(true)
  })
})

describe('applyDraftUpdate', () => {
  it('should merge basics and replace the given sections only', () => {
    const cv = buildCv({ basics: { summary: 'Old summary' }, skills: [{ name: 'Cloud' }] })

    const next = applyDraftUpdate(cv, { basics: { label: 'Data engineer' }, projects: [buildProject()] })

    expect(next.basics).toEqual({ ...cv.basics, label: 'Data engineer' })
    expect(next.projects).toEqual([buildProject()])
    expect(next.skills).toEqual([{ name: 'Cloud' }])
    expect(next.meta).toEqual(cv.meta)
  })

  it('should not mutate the input', () => {
    const cv = buildCv()
    const before = structuredClone(cv)

    applyDraftUpdate(cv, { basics: { name: 'Other Name' }, skills: [] })

    expect(cv).toEqual(before)
  })
})

describe('toModelDraft', () => {
  it('should leave out contact details, meta and conversion notes', () => {
    const cv = buildCv({
      basics: { email: 'anna@example.com', phone: '+358 40 000 0000', url: 'https://example.com', profiles: [] },
      projects: [buildProject({ 'x-note': 'Converted from a table' })],
      work: [{ name: 'Example Oy', 'x-note': 'Dates guessed' }],
    })

    const draft = toModelDraft(cv)

    expect(draft.basics).toEqual({ name: 'Anna Example', label: 'Software Architect', summary: cv.basics.summary })
    expect(draft).not.toHaveProperty('meta')
    expect(JSON.stringify(draft)).not.toMatch(/x-note|@|\+358|https/)
  })
})
