import { describe, expect, it } from 'vitest'
import { CreateVariantInput, RestoreRevisionInput } from '~/server/functions/cv'
import { buildCv } from '../../fixtures/cv'

const valid = { sourceCvId: '0199aa00-0000-7000-8000-000000000001', variant: 'Client X', data: buildCv() }

describe('CreateVariantInput', () => {
  it('should accept a source CV, a variant name and a CV document', () => {
    expect(CreateVariantInput.safeParse(valid).success).toBe(true)
  })

  it.each([
    { case: 'an invalid variant name', input: { ...valid, variant: 'Client/X' } },
    { case: 'a malformed source id', input: { ...valid, sourceCvId: '../x' } },
    { case: 'an unknown key', input: { ...valid, personId: 'p01' } },
    { case: 'a missing document', input: { sourceCvId: valid.sourceCvId, variant: 'Client X' } },
  ])('should reject $case', ({ input }) => {
    expect(CreateVariantInput.safeParse(input).success).toBe(false)
  })
})

describe('RestoreRevisionInput', () => {
  const restore = {
    cvId: '0199aa00-0000-7000-8000-000000000001',
    revisionId: '0199aa00-0000-7000-8000-000000000002',
    baseRevisionId: '0199aa00-0000-7000-8000-000000000003',
  }

  it('should accept a CV, the revision to restore and the base revision', () => {
    expect(RestoreRevisionInput.safeParse(restore).success).toBe(true)
  })

  it.each([
    { case: 'a malformed revision id', input: { ...restore, revisionId: '../x' } },
    { case: 'a missing base revision', input: { cvId: restore.cvId, revisionId: restore.revisionId } },
    { case: 'an unknown key', input: { ...restore, data: buildCv() } },
  ])('should reject $case', ({ input }) => {
    expect(RestoreRevisionInput.safeParse(input).success).toBe(false)
  })
})
