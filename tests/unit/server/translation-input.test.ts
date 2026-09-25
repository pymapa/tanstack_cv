import { describe, expect, it } from 'vitest'
import { SaveTranslationInput } from '~/server/functions/cv'
import { buildCv } from '../../fixtures/cv'

const valid = { sourceCvId: '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b', variant: 'PM-fi', to: 'fi', data: buildCv() }

describe('SaveTranslationInput', () => {
  it('should accept a reviewed translation', () => {
    expect(SaveTranslationInput.safeParse(valid).success).toBe(true)
  })

  it.each([
    ['an extra field', { ...valid, personId: 'p01' }],
    ['an empty version name', { ...valid, variant: '  ' }],
    ['a version name with markup', { ...valid, variant: '<b>fi</b>' }],
    ['a version name over 60 characters', { ...valid, variant: 'x'.repeat(61) }],
    ['an unsupported language', { ...valid, to: 'sv' }],
    ['an invalid CV', { ...valid, data: { ...buildCv(), basics: { name: '' } } }],
  ])('should reject %s', (_case, input) => {
    expect(SaveTranslationInput.safeParse(input).success).toBe(false)
  })
})
